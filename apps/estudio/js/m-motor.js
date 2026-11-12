/* =====================================================================
   ESTÚDIO · MOTOR DE CONSULTAS EM M (E1 · 12/11/2026)
   O que este arquivo faz, no mesmo espírito do Power Query:
   1) guarda cada consulta como uma lista de ETAPAS (Fonte, Tipo Alterado,
      Linhas Filtradas...);
   2) escreve o código M de cada etapa (gerarM) — é o que aparece no
      "Código M" da tela;
   3) executa as etapas uma a uma sobre os dados (executar), em JavaScript,
      direto no navegador;
   4) entende as expressões do M usadas em "each ..." (filtros e colunas
      personalizadas): [Coluna], contas, comparações, if/then/else e as
      funções do catálogo FUNCOES_M.
   Não depende de nenhum outro arquivo. Funciona no navegador (window.MMotor)
   e no Node (require), para os testes automáticos em testes/.
   ===================================================================== */
(function (raiz) {
  'use strict';

  /* ---------------- tipos de coluna ---------------- */
  // chave interna → como se escreve no M, rótulo na tela e ícone do cabeçalho
  const TIPOS = {
    texto:    { m: 'type text',     rotulo: 'Texto',             icone: 'ABC' },
    inteiro:  { m: 'Int64.Type',    rotulo: 'Número inteiro',    icone: '123' },
    decimal:  { m: 'type number',   rotulo: 'Número decimal',    icone: '1.2' },
    data:     { m: 'type date',     rotulo: 'Data',              icone: 'DATA' },
    dataHora: { m: 'type datetime', rotulo: 'Data e hora',       icone: 'D+H' },
    hora:     { m: 'type time',     rotulo: 'Hora',              icone: 'HORA' },
    logico:   { m: 'type logical',  rotulo: 'Verdadeiro/Falso',  icone: 'V/F' },
    qualquer: { m: 'type any',      rotulo: 'Qualquer',          icone: 'ABC 123' },
    tabela:   { m: 'type table',    rotulo: 'Tabela',            icone: 'TAB' },
  };
  const TIPO_DO_M = Object.fromEntries(Object.entries(TIPOS).map(([k, t]) => [t.m, k]));

  // Valor de erro numa célula (o "Error" do Power Query). A linha continua; só a célula fica com erro.
  class ErroM {
    constructor(mensagem) { this.mensagem = mensagem; }
    toString() { return 'Error'; }
  }
  const ehErro = v => v instanceof ErroM;
  // Erro que interrompe a etapa inteira (ex.: coluna que não existe)
  class FalhaEtapa extends Error {}

  /* ---------------- conversões ---------------- */
  const pad = (n, t = 2) => String(n).padStart(t, '0');
  function dataValida(a, m, d) {
    const dt = new Date(Date.UTC(a, m - 1, d));
    return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }
  // Número no padrão brasileiro (1.234,5) ou com ponto decimal (1234.5)
  function lerNumero(s) {
    if (typeof s === 'number') return s;
    const t = String(s).trim().replace(/\s/g, '');
    if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) || /^[-+]?\d+,\d+$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
    if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return Number(t);
    return NaN;
  }
  // Data em texto → 'AAAA-MM-DD' (aceita 03/11/2026 e 2026-11-03)
  function lerData(s) {
    const t = String(s).trim();
    let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/.exec(t);
    if (m && dataValida(+m[3], +m[2], +m[1])) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
    m = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s]|$)/.exec(t);
    if (m && dataValida(+m[1], +m[2], +m[3])) return `${m[1]}-${m[2]}-${m[3]}`;
    return null;
  }
  function lerHora(s) {
    const m = /(?:^|[T\s])(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/.exec(String(s).trim()) || /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(s).trim());
    if (!m || +m[1] > 23 || +m[2] > 59 || +(m[3] || 0) > 59) return null;
    return `${pad(m[1])}:${m[2]}:${pad(m[3] || 0)}`;
  }
  const nomeTipoM = v => v === null ? 'Null' : typeof v === 'number' ? 'Number' : typeof v === 'boolean' ? 'Logical' : 'Text';

  // Converte um valor para o tipo pedido. Vazio vira null; o que não dá, vira Error.
  function converter(v, tipo) {
    if (v === null || v === undefined || ehErro(v)) return v ?? null;
    if (tipo === 'qualquer') return v;
    if (tipo === 'texto') {
      if (typeof v === 'number') return String(v).replace('.', ',');
      if (typeof v === 'boolean') return v ? 'true' : 'false';
      return String(v);
    }
    if (typeof v === 'string' && v.trim() === '') return null;
    const falha = rot => new ErroM(`DataFormat.Error: não foi possível converter "${v}" em ${rot}.`);
    switch (tipo) {
      case 'inteiro': { const n = lerNumero(v); return isNaN(n) ? falha('Número inteiro') : Math.round(n); }
      case 'decimal': { const n = lerNumero(v); return isNaN(n) ? falha('Número') : n; }
      case 'data': { const d = lerData(v); return d || falha('Data'); }
      case 'dataHora': { const d = lerData(v); if (!d) return falha('Data e hora'); return `${d}T${lerHora(v) || '00:00:00'}`; }
      case 'hora': { const h = lerHora(v); return h || falha('Hora'); }
      case 'logico': {
        if (typeof v === 'boolean') return v;
        const t = String(v).trim().toLowerCase();
        if (['true', 'verdadeiro', 'sim', '1'].includes(t)) return true;
        if (['false', 'falso', 'não', 'nao', '0'].includes(t)) return false;
        return falha('Verdadeiro/Falso');
      }
    }
    return v;
  }

  // Como a célula aparece na grade
  function formatar(v, tipo) {
    if (v === null || v === undefined) return 'null';
    if (ehErro(v)) return 'Error';
    if (v && v.aninhada) return 'Table';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'number') return v.toLocaleString('pt-BR', { maximumFractionDigits: 6, useGrouping: false }); // 900102, como no Power Query
    if (tipo === 'data' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split('-').reverse().join('/');
    if (tipo === 'dataHora' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 10).split('-').reverse().join('/') + ' ' + v.slice(11);
    return String(v);
  }

  // Descobre o tipo de uma coluna pelos valores (como o "Tipo Alterado" automático do Power Query)
  function detectarTipo(valores) {
    const amostra = valores.filter(v => v !== null && v !== undefined && String(v).trim() !== '').slice(0, 200);
    if (!amostra.length) return 'texto';
    const todos = teste => amostra.every(v => teste(String(v).trim()));
    if (todos(s => /^[-+]?\d+$/.test(s) && s.length < 16 && !/^0\d/.test(s))) return 'inteiro';
    if (todos(s => !isNaN(lerNumero(s)) && !/^0\d/.test(s))) return 'decimal';
    if (todos(s => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s) || /^\d{4}-\d{2}-\d{2}$/.test(s)) && todos(s => lerData(s))) return 'data';
    if (todos(s => lerData(s) && lerHora(s))) return 'dataHora';
    if (todos(s => /^\d{1,2}:\d{2}(:\d{2})?$/.test(s) && lerHora(s))) return 'hora';
    return 'texto';
  }

  /* ---------------- CSV ---------------- */
  function lerCsv(texto, delimitador) {
    texto = String(texto).replace(/^﻿/, '');
    if (!delimitador) {
      const linha1 = texto.split(/\r?\n/, 1)[0];
      delimitador = [';', '\t', ','].map(d => [d, linha1.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    }
    const linhas = []; let linha = [], campo = '', aspas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (aspas) {
        if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
        else campo += c;
      } else if (c === '"' && campo === '') aspas = true;
      else if (c === delimitador) { linha.push(campo); campo = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && texto[i + 1] === '\n') i++;
        linha.push(campo); campo = '';
        if (linha.length > 1 || linha[0] !== '') linhas.push(linha);
        linha = [];
      } else campo += c;
    }
    if (campo !== '' || linha.length) { linha.push(campo); if (linha.length > 1 || linha[0] !== '') linhas.push(linha); }
    const n = Math.max(0, ...linhas.map(l => l.length));
    return { delimitador, linhas: linhas.map(l => { while (l.length < n) l.push(''); return l; }), nColunas: n };
  }

  /* ---------------- expressões do M (each ...) ---------------- */
  const PALAVRAS = new Set(['each', 'if', 'then', 'else', 'and', 'or', 'not', 'true', 'false', 'null']);
  function tokens(fonte) {
    const out = []; let i = 0; const s = String(fonte);
    const erro = msg => { throw new FalhaEtapa(`Expression.SyntaxError: ${msg} (posição ${i + 1}).`); };
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
      if (c === '"') {
        let v = ''; i++;
        while (true) {
          if (i >= s.length) erro('texto sem as aspas de fechamento');
          if (s[i] === '"') { if (s[i + 1] === '"') { v += '"'; i += 2; continue; } i++; break; }
          v += s[i++];
        }
        out.push({ t: 'txt', v }); continue;
      }
      if (c === '[') {
        const fim = s.indexOf(']', i);
        if (fim < 0) erro('coluna sem o "]" de fechamento');
        out.push({ t: 'col', v: s.slice(i + 1, fim).trim() }); i = fim + 1; continue;
      }
      if (/\d/.test(c) || (c === '.' && /\d/.test(s[i + 1]))) {
        const m = /^(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i.exec(s.slice(i));
        out.push({ t: 'num', v: Number(m[0]) }); i += m[0].length; continue;
      }
      if (c === '#' && /^#(date|datetime|time)\b/.test(s.slice(i))) {
        const m = /^#(date|datetime|time)/.exec(s.slice(i));
        out.push({ t: 'id', v: m[0] }); i += m[0].length; continue;
      }
      if (/[A-Za-zÀ-ÿ_]/.test(c)) {
        const m = /^[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]*(\.[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]*)*/.exec(s.slice(i));
        const w = m[0]; i += w.length;
        out.push(PALAVRAS.has(w) ? { t: 'kw', v: w } : { t: 'id', v: w }); continue;
      }
      const dois = s.slice(i, i + 2);
      if (['<=', '>=', '<>'].includes(dois)) { out.push({ t: 'op', v: dois }); i += 2; continue; }
      if ('+-*/&=<>(),'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
      erro(`caractere inesperado "${c}"`);
    }
    out.push({ t: 'fim' });
    return out;
  }

  // Monta a árvore da expressão. Precedência (do mais fraco ao mais forte):
  // if/then/else → or → and → not → = <> → < <= > >= → + - & → * / → sinal → valor
  function analisar(fonte) {
    const tk = tokens(fonte); let p = 0;
    const olha = () => tk[p];
    const ehOp = v => tk[p].t === 'op' && tk[p].v === v;
    const ehKw = v => tk[p].t === 'kw' && tk[p].v === v;
    const espera = (t, v) => {
      const k = tk[p];
      if (k.t !== t || (v !== undefined && k.v !== v)) throw new FalhaEtapa(`Expression.SyntaxError: era esperado "${v ?? t}" e veio "${k.t === 'fim' ? 'o fim da expressão' : k.v}".`);
      p++; return k;
    };
    function expr() {
      if (ehKw('each')) { p++; return expr(); }
      if (ehKw('if')) {
        p++; const c = expr(); espera('kw', 'then'); const a = expr(); espera('kw', 'else'); const b = expr();
        return { k: 'se', c, a, b };
      }
      return ou();
    }
    function ou() { let e = e_(); while (ehKw('or')) { p++; e = { k: 'bin', op: 'or', a: e, b: e_() }; } return e; }
    function e_() { let e = nao(); while (ehKw('and')) { p++; e = { k: 'bin', op: 'and', a: e, b: nao() }; } return e; }
    function nao() { if (ehKw('not')) { p++; return { k: 'not', a: nao() }; } return igual(); }
    function igual() { let e = rel(); while (ehOp('=') || ehOp('<>')) { const op = tk[p++].v; e = { k: 'bin', op, a: e, b: rel() }; } return e; }
    function rel() { let e = soma(); while (['<', '<=', '>', '>='].some(ehOp)) { const op = tk[p++].v; e = { k: 'bin', op, a: e, b: soma() }; } return e; }
    function soma() { let e = mult(); while (['+', '-', '&'].some(ehOp)) { const op = tk[p++].v; e = { k: 'bin', op, a: e, b: mult() }; } return e; }
    function mult() { let e = unario(); while (ehOp('*') || ehOp('/')) { const op = tk[p++].v; e = { k: 'bin', op, a: e, b: unario() }; } return e; }
    function unario() { if (ehOp('-')) { p++; return { k: 'neg', a: unario() }; } if (ehOp('+')) { p++; return unario(); } return valor(); }
    function valor() {
      const k = olha();
      if (k.t === 'num') { p++; return { k: 'lit', v: k.v }; }
      if (k.t === 'txt') { p++; return { k: 'lit', v: k.v }; }
      if (k.t === 'col') { p++; return { k: 'col', nome: k.v }; }
      if (k.t === 'kw' && (k.v === 'true' || k.v === 'false')) { p++; return { k: 'lit', v: k.v === 'true' }; }
      if (k.t === 'kw' && k.v === 'null') { p++; return { k: 'lit', v: null }; }
      if (ehOp('(')) { p++; const e = expr(); espera('op', ')'); return e; }
      if (k.t === 'id') {
        p++;
        espera('op', '(');
        const args = [];
        if (!ehOp(')')) { do { args.push(expr()); } while (ehOp(',') && ++p); }
        espera('op', ')');
        if (!FUNCOES_M[k.v]) throw new FalhaEtapa(`Expression.Error: a função ${k.v} não existe (ou ainda não está disponível no Estúdio).`);
        return { k: 'fn', nome: k.v, args };
      }
      throw new FalhaEtapa(`Expression.SyntaxError: não esperava "${k.t === 'fim' ? 'o fim da expressão' : k.v}" aqui.`);
    }
    const arvore = expr();
    if (olha().t !== 'fim') throw new FalhaEtapa(`Expression.SyntaxError: sobrou "${olha().v}" no fim da expressão.`);
    return arvore;
  }

  // Lista as colunas usadas numa árvore (para avisar quando uma não existe)
  function colunasUsadas(no, out = new Set()) {
    if (!no || typeof no !== 'object') return out;
    if (no.k === 'col') out.add(no.nome);
    for (const f of ['a', 'b', 'c']) if (no[f]) colunasUsadas(no[f], out);
    if (no.args) no.args.forEach(a => colunasUsadas(a, out));
    return out;
  }

  function avaliar(no, linha) {
    switch (no.k) {
      case 'lit': return no.v;
      case 'col': {
        if (!(no.nome in linha)) throw new FalhaEtapa(`Expression.Error: a coluna "${no.nome}" da tabela não foi encontrada.`);
        return linha[no.nome];
      }
      case 'neg': { const a = avaliar(no.a, linha); if (ehErro(a) || a === null) return a; return typeof a === 'number' ? -a : new ErroM(`Expression.Error: não dá para usar o sinal "-" em ${nomeTipoM(a)}.`); }
      case 'not': { const a = avaliar(no.a, linha); if (ehErro(a) || a === null) return a; return typeof a === 'boolean' ? !a : new ErroM(`Expression.Error: "not" só funciona com verdadeiro/falso.`); }
      case 'se': { const c = avaliar(no.c, linha); if (ehErro(c)) return c; if (c !== true && c !== false) return new ErroM('Expression.Error: a condição do "if" precisa dar verdadeiro ou falso.'); return avaliar(c ? no.a : no.b, linha); }
      case 'fn': {
        const f = FUNCOES_M[no.nome];
        const args = no.args.map(a => avaliar(a, linha));
        const erro = args.find(ehErro); if (erro) return erro;
        try { return f.fn(...args); }
        catch (e) { return new ErroM(`Expression.Error: ${no.nome}: ${e.message}`); }
      }
      case 'bin': {
        if (no.op === 'and' || no.op === 'or') {
          const a = avaliar(no.a, linha); if (ehErro(a)) return a;
          if (no.op === 'and' && a === false) return false;
          if (no.op === 'or' && a === true) return true;
          const b = avaliar(no.b, linha); if (ehErro(b)) return b;
          if (a === null || b === null) return null;
          return b;
        }
        const a = avaliar(no.a, linha), b = avaliar(no.b, linha);
        if (ehErro(a)) return a; if (ehErro(b)) return b;
        const op = no.op;
        if (op === '=') return a === b;
        if (op === '<>') return a !== b;
        if (a === null || b === null) return null;
        if (['<', '<=', '>', '>='].includes(op)) {
          if (typeof a !== typeof b) return new ErroM(`Expression.Error: não dá para comparar ${nomeTipoM(a)} com ${nomeTipoM(b)} usando "${op}".`);
          return op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b;
        }
        if (op === '&') {
          if (typeof a !== 'string' || typeof b !== 'string') return new ErroM(`Expression.Error: o "&" junta textos; ${nomeTipoM(typeof a !== 'string' ? a : b)} precisa virar texto antes (use Text.From).`);
          return a + b;
        }
        if (typeof a !== 'number' || typeof b !== 'number') return new ErroM(`Expression.Error: não dá para aplicar "${op}" a ${nomeTipoM(a)} e ${nomeTipoM(b)}.`);
        if (op === '+') return a + b; if (op === '-') return a - b; if (op === '*') return a * b;
        if (op === '/') return b === 0 ? (a === 0 ? NaN : a > 0 ? Infinity : -Infinity) : a / b;
      }
    }
    throw new FalhaEtapa('Expression.Error: expressão que o Estúdio não entende.');
  }

  /* ---------------- funções do M disponíveis ----------------
     Cada uma: grupo, como escrever, para que serve, equivalente no Excel, exemplo e a conta em si. */
  const texto = v => { if (v === null) return null; if (typeof v !== 'string') throw new Error(`esperava Text e recebeu ${nomeTipoM(v)}`); return v; };
  const numero = v => { if (v === null) return null; if (typeof v !== 'number') throw new Error(`esperava Number e recebeu ${nomeTipoM(v)}`); return v; };
  const dataIso = v => { if (v === null) return null; const d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v : null; if (!d) throw new Error(`esperava Date e recebeu ${nomeTipoM(v)}`); return d; };
  const FUNCOES_M = {
    'Text.Upper':      { grupo: 'Texto', sintaxe: 'Text.Upper(texto)', descricao: 'Coloca o texto em letras MAIÚSCULAS.', excel: 'MAIÚSCULA', exemplo: 'Text.Upper("sac") → "SAC"', fn: t => texto(t) === null ? null : t.toUpperCase() },
    'Text.Lower':      { grupo: 'Texto', sintaxe: 'Text.Lower(texto)', descricao: 'Coloca o texto em letras minúsculas.', excel: 'MINÚSCULA', exemplo: 'Text.Lower("SAC") → "sac"', fn: t => texto(t) === null ? null : t.toLowerCase() },
    'Text.Trim':       { grupo: 'Texto', sintaxe: 'Text.Trim(texto)', descricao: 'Tira os espaços do começo e do fim.', excel: 'ARRUMAR', exemplo: 'Text.Trim("  SAC ") → "SAC"', fn: t => texto(t) === null ? null : t.trim() },
    'Text.Length':     { grupo: 'Texto', sintaxe: 'Text.Length(texto)', descricao: 'Quantos caracteres o texto tem.', excel: 'NÚM.CARACT', exemplo: 'Text.Length("SAC") → 3', fn: t => texto(t) === null ? null : t.length },
    'Text.Start':      { grupo: 'Texto', sintaxe: 'Text.Start(texto, n)', descricao: 'Os primeiros n caracteres.', excel: 'ESQUERDA', exemplo: 'Text.Start("900123", 3) → "900"', fn: (t, n) => texto(t) === null ? null : t.slice(0, numero(n)) },
    'Text.End':        { grupo: 'Texto', sintaxe: 'Text.End(texto, n)', descricao: 'Os últimos n caracteres.', excel: 'DIREITA', exemplo: 'Text.End("900123", 3) → "123"', fn: (t, n) => texto(t) === null ? null : t.slice(-numero(n)) },
    'Text.Contains':   { grupo: 'Texto', sintaxe: 'Text.Contains(texto, trecho)', descricao: 'Verdadeiro se o trecho aparece no texto (diferencia maiúsculas).', excel: 'ÉNÚM(LOCALIZAR(...))', exemplo: 'Text.Contains("Suporte Técnico", "Técnico") → true', fn: (t, s) => texto(t) === null ? null : t.includes(texto(s)) },
    'Text.StartsWith': { grupo: 'Texto', sintaxe: 'Text.StartsWith(texto, início)', descricao: 'Verdadeiro se o texto começa com o trecho.', excel: 'ESQUERDA(...)=...', exemplo: 'Text.StartsWith("900123", "90") → true', fn: (t, s) => texto(t) === null ? null : t.startsWith(texto(s)) },
    'Text.EndsWith':   { grupo: 'Texto', sintaxe: 'Text.EndsWith(texto, fim)', descricao: 'Verdadeiro se o texto termina com o trecho.', excel: 'DIREITA(...)=...', exemplo: 'Text.EndsWith("relatorio.csv", ".csv") → true', fn: (t, s) => texto(t) === null ? null : t.endsWith(texto(s)) },
    'Text.Replace':    { grupo: 'Texto', sintaxe: 'Text.Replace(texto, antigo, novo)', descricao: 'Troca todas as ocorrências de um trecho por outro.', excel: 'SUBSTITUIR', exemplo: 'Text.Replace("SUP_TEC", "_", " ") → "SUP TEC"', fn: (t, a, b) => texto(t) === null ? null : t.split(texto(a)).join(texto(b)) },
    'Text.From':       { grupo: 'Texto', sintaxe: 'Text.From(valor)', descricao: 'Transforma número, data ou verdadeiro/falso em texto. Necessário antes de juntar com "&".', excel: 'TEXTO', exemplo: 'Text.From(42) & " chamadas" → "42 chamadas"', fn: v => v === null ? null : converter(v, 'texto') },
    'Number.From':     { grupo: 'Número', sintaxe: 'Number.From(valor)', descricao: 'Transforma texto em número (aceita 1.234,5).', excel: 'VALOR', exemplo: 'Number.From("287,5") → 287,5', fn: v => { if (v === null || typeof v === 'number') return v; const n = lerNumero(v); if (isNaN(n)) throw new Error(`"${v}" não é um número`); return n; } },
    'Number.Round':    { grupo: 'Número', sintaxe: 'Number.Round(número, [casas])', descricao: 'Arredonda para o número de casas decimais (zero se omitido).', excel: 'ARRED', exemplo: 'Number.Round(287.456, 1) → 287,5', fn: (n, c = 0) => { if (numero(n) === null) return null; const f = 10 ** numero(c); return Math.round(n * f) / f; } },
    'Number.RoundUp':  { grupo: 'Número', sintaxe: 'Number.RoundUp(número, [casas])', descricao: 'Arredonda sempre para cima, como na necessidade de pessoas.', excel: 'ARREDONDAR.PARA.CIMA', exemplo: 'Number.RoundUp(5.1) → 6', fn: (n, c = 0) => { if (numero(n) === null) return null; const f = 10 ** numero(c); return Math.ceil(n * f - 1e-9) / f; } },
    'Number.RoundDown':{ grupo: 'Número', sintaxe: 'Number.RoundDown(número, [casas])', descricao: 'Arredonda sempre para baixo.', excel: 'ARREDONDAR.PARA.BAIXO', exemplo: 'Number.RoundDown(5.9) → 5', fn: (n, c = 0) => { if (numero(n) === null) return null; const f = 10 ** numero(c); return Math.floor(n * f + 1e-9) / f; } },
    'Number.Abs':      { grupo: 'Número', sintaxe: 'Number.Abs(número)', descricao: 'O valor sem o sinal de menos.', excel: 'ABS', exemplo: 'Number.Abs(-3) → 3', fn: n => numero(n) === null ? null : Math.abs(n) },
    'Date.Year':       { grupo: 'Data e hora', sintaxe: 'Date.Year(data)', descricao: 'O ano da data.', excel: 'ANO', exemplo: 'Date.Year(#date(2026, 11, 3)) → 2026', fn: d => dataIso(d) === null ? null : +d.slice(0, 4) },
    'Date.Month':      { grupo: 'Data e hora', sintaxe: 'Date.Month(data)', descricao: 'O mês da data (1 a 12).', excel: 'MÊS', exemplo: 'Date.Month(#date(2026, 11, 3)) → 11', fn: d => dataIso(d) === null ? null : +d.slice(5, 7) },
    'Date.Day':        { grupo: 'Data e hora', sintaxe: 'Date.Day(data)', descricao: 'O dia do mês.', excel: 'DIA', exemplo: 'Date.Day(#date(2026, 11, 3)) → 3', fn: d => dataIso(d) === null ? null : +d.slice(8, 10) },
    'Date.DayOfWeek':  { grupo: 'Data e hora', sintaxe: 'Date.DayOfWeek(data)', descricao: 'O dia da semana, de 0 (domingo) a 6 (sábado).', excel: 'DIA.DA.SEMANA(...)-1', exemplo: 'Date.DayOfWeek(#date(2026, 11, 2)) → 1 (segunda)', fn: d => dataIso(d) === null ? null : new Date(d.slice(0, 10) + 'T00:00:00Z').getUTCDay() },
    'Time.Hour':       { grupo: 'Data e hora', sintaxe: 'Time.Hour(hora)', descricao: 'A hora (0 a 23) de uma hora ou data e hora.', excel: 'HORA', exemplo: 'Time.Hour(#time(14, 30, 0)) → 14', fn: t => { if (t === null) return null; const h = lerHora(t); if (!h) throw new Error('esperava Time'); return +h.slice(0, 2); } },
    '#date':           { grupo: 'Data e hora', sintaxe: '#date(ano, mês, dia)', descricao: 'Escreve uma data fixa, para comparar ou filtrar.', excel: 'DATA', exemplo: '[DATA] >= #date(2026, 11, 1)', fn: (a, m, d) => { if (!dataValida(a, m, d)) throw new Error('data inválida'); return `${a}-${pad(m)}-${pad(d)}`; } },
    '#time':           { grupo: 'Data e hora', sintaxe: '#time(hora, minuto, segundo)', descricao: 'Escreve uma hora fixa.', excel: 'TEMPO', exemplo: '[HORA] < #time(12, 0, 0)', fn: (h, m, s) => `${pad(h)}:${pad(m)}:${pad(s)}` },
  };

  /* ---------------- etapas ----------------
     Cada etapa da consulta é { id, tipo, nome, ...dados }. O catálogo diz como escrever o M
     de cada tipo e como executar a etapa sobre a tabela anterior.
     Tabela = { colunas: [{ nome, tipo }], linhas: [[...]] } */
  const aspas = s => '"' + String(s).replace(/"/g, '""') + '"';
  const listaM = itens => '{' + itens.join(', ') + '}';
  const idM = nome => /^[A-Za-z_][A-Za-z0-9_]*$/.test(nome) && !PALAVRAS.has(nome) ? nome : '#' + aspas(nome);
  const exigeColuna = (tab, nome) => {
    const i = tab.colunas.findIndex(c => c.nome === nome);
    if (i < 0) throw new FalhaEtapa(`Expression.Error: a coluna "${nome}" da tabela não foi encontrada.`);
    return i;
  };
  const objetoLinha = (tab, linha) => { const o = {}; tab.colunas.forEach((c, i) => { o[c.nome] = linha[i]; }); return o; };
  const semEach = e => String(e).trim().replace(/^each\s+/, '');

  // Tipos de junção do Mesclar (os mesmos do Power Query)
  const JUNCOES = {
    LeftOuter:  { rotulo: 'Externa esquerda', ajuda: 'Todas as linhas desta consulta e, da outra, só as que combinam.' },
    Inner:      { rotulo: 'Interna', ajuda: 'Só as linhas que combinam nas duas consultas.' },
    FullOuter:  { rotulo: 'Externa total', ajuda: 'Todas as linhas das duas consultas, combinando quando dá.' },
    RightOuter: { rotulo: 'Externa direita', ajuda: 'Todas as linhas da outra consulta e, desta, só as que combinam.' },
    LeftAnti:   { rotulo: 'Anti esquerda', ajuda: 'Só as linhas desta consulta que NÃO acharam par na outra (bom para achar quem falta).' },
    RightAnti:  { rotulo: 'Anti direita', ajuda: 'Só as linhas da outra consulta que NÃO acharam par nesta.' },
  };
  // Operações do Agrupar: como se escreve em M e o tipo do resultado
  const AGREGACOES = {
    soma:      { rotulo: 'Soma',                     m: c => `List.Sum([${c}])`,                  tipo: () => 'decimal', excel: 'SOMA' },
    media:     { rotulo: 'Média',                    m: c => `List.Average([${c}])`,              tipo: () => 'decimal', excel: 'MÉDIA' },
    mediana:   { rotulo: 'Mediana',                  m: c => `List.Median([${c}])`,               tipo: () => 'decimal', excel: 'MED' },
    minimo:    { rotulo: 'Mínimo',                   m: c => `List.Min([${c}])`,                  tipo: t => t || 'qualquer', excel: 'MÍNIMO' },
    maximo:    { rotulo: 'Máximo',                   m: c => `List.Max([${c}])`,                  tipo: t => t || 'qualquer', excel: 'MÁXIMO' },
    contar:    { rotulo: 'Contar linhas',            m: () => 'Table.RowCount(_)',                tipo: () => 'inteiro', excel: 'CONT.VALORES', semColuna: true },
    distintos: { rotulo: 'Contar valores distintos', m: c => `List.Count(List.Distinct([${c}]))`, tipo: () => 'inteiro', excel: 'CONT.ÚNICO (Excel 365)' },
  };
  // Resultado de outra consulta, para Mesclar e Acrescentar. Avisa se ela não existe, tem erro ou é circular.
  function tabelaDeOutraConsulta(nome, ctx) {
    const outra = (ctx.todas || []).find(q => q.nome === nome);
    if (!outra) throw new FalhaEtapa(`Expression.Error: a consulta "${nome}" não existe (foi excluída ou renomeada?).`);
    if (ctx.pilha.includes(nome)) throw new FalhaEtapa(`Expression.Error: referência circular: ${[...ctx.pilha, nome].join(' → ')}. Uma consulta não pode depender dela mesma.`);
    const r = executar(outra, undefined, ctx.todas, ctx.pilha);
    if (r.erro && /referência circular/.test(r.erro.mensagem)) throw new FalhaEtapa(r.erro.mensagem); // mostra o ciclo inteiro, não só o vizinho
    if (r.erro) throw new FalhaEtapa(`Expression.Error: a consulta "${nome}" está com erro na etapa "${r.erro.etapa}". Corrija-a primeiro.`);
    return r.tabela;
  }

  // Em M puro: separa o texto nos espaços, joga fora os pedaços vazios e junta de novo com um espaço só
  const M_LIMPAR = 'each Text.Combine(List.Select(Text.Split(_, " "), each _ <> ""), " ")';
  const ETAPAS = {
    fonte: {
      nome: 'Fonte', descricao: 'Lê o arquivo CSV',
      m: e => `Csv.Document(File.Contents(${aspas(e.arquivo)}), [Delimiter=${aspas(e.delimitador === '\t' ? '#(tab)' : e.delimitador)}, Encoding=65001])`,
      executar: (_, e, ctx) => {
        const csv = lerCsv(ctx.textoFonte, e.delimitador);
        return { colunas: Array.from({ length: csv.nColunas }, (_, i) => ({ nome: 'Column' + (i + 1), tipo: 'qualquer' })), linhas: csv.linhas };
      },
    },
    promover: {
      nome: 'Cabeçalhos Promovidos', descricao: 'Usa a primeira linha como nome das colunas',
      m: (e, ant) => `Table.PromoteHeaders(${ant}, [PromoteAllScalars=true])`,
      executar: tab => {
        if (!tab.linhas.length) return tab;
        const usados = {};
        const nomes = tab.linhas[0].map((v, i) => {
          let n = String(v ?? '').trim() || 'Column' + (i + 1);
          if (usados[n]) n = n + '_' + (++usados[n]); else usados[n] = 1;
          return n;
        });
        return { colunas: nomes.map(nome => ({ nome, tipo: 'qualquer' })), linhas: tab.linhas.slice(1) };
      },
    },
    tipos: {
      nome: 'Tipo Alterado', descricao: 'Define o tipo de cada coluna',
      m: (e, ant) => `Table.TransformColumnTypes(${ant}, ${listaM(e.lista.map(([c, t]) => `{${aspas(c)}, ${TIPOS[t].m}}`))})`,
      executar: (tab, e) => {
        const idx = e.lista.map(([c, t]) => [exigeColuna(tab, c), t]);
        const colunas = tab.colunas.map(c => ({ ...c }));
        idx.forEach(([i, t]) => { colunas[i].tipo = t; });
        const linhas = tab.linhas.map(l => { const n = l.slice(); idx.forEach(([i, t]) => { n[i] = converter(n[i], t); }); return n; });
        return { colunas, linhas };
      },
    },
    limparEspacos: {
      nome: 'Espaços Removidos', descricao: 'Tira os espaços do começo e do fim e deixa um espaço só entre as palavras',
      m: (e, ant) => `Table.TransformColumns(${ant}, ${listaM(e.colunas.map(c => `{${aspas(c)}, ${M_LIMPAR}, type text}`))})`,
      executar: (tab, e) => {
        const idx = e.colunas.map(c => exigeColuna(tab, c));
        const colunas = tab.colunas.map(c => ({ ...c }));
        idx.forEach(i => { colunas[i].tipo = 'texto'; });
        const linhas = tab.linhas.map(l => { const n = l.slice(); idx.forEach(i => { if (typeof n[i] === 'string') n[i] = n[i].replace(/\s+/g, ' ').trim(); }); return n; });
        return { colunas, linhas };
      },
    },
    mesclar: {
      nome: 'Consultas Mescladas', descricao: 'Junta com outra consulta pelas colunas-chave (vira uma coluna de tabelas)',
      m: (e, ant) => `Table.NestedJoin(${ant}, ${listaM(e.chaves.map(aspas))}, ${idM(e.consulta)}, ${listaM(e.chavesOutra.map(aspas))}, ${aspas(e.coluna)}, JoinKind.${e.juncao})`,
      executar: (tab, e, ctx) => {
        const dir = tabelaDeOutraConsulta(e.consulta, ctx);
        if (e.chaves.length !== e.chavesOutra.length || !e.chaves.length) throw new FalhaEtapa('Expression.Error: as duas consultas precisam ter o mesmo número de colunas-chave.');
        if (tab.colunas.some(c => c.nome === e.coluna)) throw new FalhaEtapa(`Expression.Error: já existe uma coluna chamada "${e.coluna}".`);
        const ie = e.chaves.map(k => exigeColuna(tab, k));
        const id = e.chavesOutra.map(k => { const i = dir.colunas.findIndex(c => c.nome === k); if (i < 0) throw new FalhaEtapa(`Expression.Error: a coluna "${k}" não existe na consulta "${e.consulta}".`); return i; });
        const chave = (l, idx) => { const vs = idx.map(i => l[i]); return vs.some(v => v === null || ehErro(v)) ? null : JSON.stringify(vs); };
        const mapa = new Map();
        dir.linhas.forEach((l, j) => { const k = chave(l, id); if (k === null) return; if (!mapa.has(k)) mapa.set(k, []); mapa.get(k).push(j); });
        const sub = js => ({ aninhada: { colunas: dir.colunas, linhas: js.map(j => dir.linhas[j]) } });
        const usadas = new Set(); const linhas = []; const tipo = e.juncao;
        tab.linhas.forEach(l => {
          const k = chave(l, ie); const js = k === null ? [] : (mapa.get(k) || []);
          js.forEach(j => usadas.add(j));
          if ((tipo === 'Inner' || tipo === 'RightOuter') && !js.length) return;
          if (tipo === 'LeftAnti' && js.length) return;
          if (tipo === 'RightAnti') return;
          linhas.push([...l, sub(tipo === 'LeftAnti' ? [] : js)]);
        });
        if (['FullOuter', 'RightOuter', 'RightAnti'].includes(tipo)) dir.linhas.forEach((l, j) => { if (!usadas.has(j)) linhas.push([...tab.colunas.map(() => null), sub([j])]); });
        return { colunas: [...tab.colunas, { nome: e.coluna, tipo: 'tabela', origem: dir.colunas }], linhas };
      },
    },
    expandir: {
      nome: 'Expandido', descricao: 'Abre a coluna de tabelas e traz as colunas escolhidas',
      m: (e, ant) => `Table.ExpandTableColumn(${ant}, ${aspas(e.coluna)}, ${listaM(e.colunas.map(aspas))}, ${listaM(e.novos.map(aspas))})`,
      executar: (tab, e) => {
        const i = exigeColuna(tab, e.coluna);
        const origem = tab.colunas[i].origem || ((tab.linhas.find(l => l[i] && l[i].aninhada) || [])[i] || { aninhada: { colunas: [] } }).aninhada.colunas;
        const idx = e.colunas.map(c => { const k = origem.findIndex(x => x.nome === c); if (k < 0) throw new FalhaEtapa(`Expression.Error: a coluna "${c}" não existe dentro de "${e.coluna}".`); return k; });
        const novos = e.colunas.map((_, k) => ({ nome: e.novos[k] || e.colunas[k], tipo: origem[idx[k]].tipo }));
        const colunas = [...tab.colunas.slice(0, i), ...novos, ...tab.colunas.slice(i + 1)];
        const nomes = colunas.map(c => c.nome); const rep = nomes.find((n, k) => nomes.indexOf(n) !== k);
        if (rep) throw new FalhaEtapa(`Expression.Error: a coluna "${rep}" ficaria repetida. Use outro nome (ou o prefixo da consulta).`);
        const linhas = [];
        tab.linhas.forEach(l => {
          const n = l[i]; const filhas = n && n.aninhada && n.aninhada.linhas.length ? n.aninhada.linhas : [null];
          filhas.forEach(f => linhas.push([...l.slice(0, i), ...idx.map(k => (f ? f[k] : null)), ...l.slice(i + 1)]));
        });
        return { colunas, linhas };
      },
    },
    acrescentar: {
      nome: 'Consulta Acrescentada', descricao: 'Põe as linhas de outras consultas embaixo desta',
      m: (e, ant) => `Table.Combine({${[ant, ...e.consultas.map(idM)].join(', ')}})`,
      executar: (tab, e, ctx) => {
        const tabelas = [tab, ...e.consultas.map(n => tabelaDeOutraConsulta(n, ctx))];
        const colunas = [];
        tabelas.forEach(t => t.colunas.forEach(c => { const x = colunas.find(y => y.nome === c.nome); if (!x) colunas.push({ ...c, n: 1 }); else { x.n++; if (x.tipo !== c.tipo) x.tipo = 'qualquer'; } }));
        const linhas = [];
        tabelas.forEach(t => { const idx = colunas.map(c => t.colunas.findIndex(x => x.nome === c.nome)); t.linhas.forEach(l => linhas.push(idx.map(k => (k < 0 ? null : l[k])))); });
        return { colunas: colunas.map(({ nome, tipo }) => ({ nome, tipo })), linhas };
      },
    },
    agrupar: {
      nome: 'Linhas Agrupadas', descricao: 'Resume as linhas por grupo (soma, média, contagem...)',
      m: (e, ant) => `Table.Group(${ant}, ${listaM(e.chaves.map(aspas))}, ${listaM(e.agregacoes.map(a => `{${aspas(a.nome)}, each ${AGREGACOES[a.op].m(a.coluna)}, ${TIPOS[a.tipo].m}}`))})`,
      executar: (tab, e) => {
        const ic = e.chaves.map(k => exigeColuna(tab, k));
        const ia = e.agregacoes.map(a => (AGREGACOES[a.op].semColuna ? -1 : exigeColuna(tab, a.coluna)));
        const grupos = new Map();
        tab.linhas.forEach(l => { const k = JSON.stringify(ic.map(i => (ehErro(l[i]) ? '§erro' : l[i]))); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(l); });
        const calc = (op, vals) => {
          if (op === 'contar') return vals.length;
          const erro = vals.find(ehErro); if (erro) return erro;
          const v = vals.filter(x => x !== null && x !== '');
          if (op === 'distintos') return new Set(v.map(x => JSON.stringify(x))).size;
          if (!v.length) return null;
          if (op === 'minimo' || op === 'maximo') return v.reduce((a, b) => ((op === 'minimo' ? b < a : b > a) ? b : a));
          if (v.some(x => typeof x !== 'number')) return new ErroM(`Expression.Error: ${AGREGACOES[op].rotulo} só funciona com números, e a coluna tem texto.`);
          if (op === 'soma') return v.reduce((a, b) => a + b, 0);
          if (op === 'media') return v.reduce((a, b) => a + b, 0) / v.length;
          if (op === 'mediana') { const o = v.slice().sort((a, b) => a - b); const m = Math.floor(o.length / 2); return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2; }
        };
        const linhas = [...grupos.values()].map(ls => [...ic.map(i => ls[0][i]), ...e.agregacoes.map((a, k) => calc(a.op, ia[k] < 0 ? ls : ls.map(l => l[ia[k]])))]);
        return { colunas: [...ic.map(i => tab.colunas[i]), ...e.agregacoes.map(a => ({ nome: a.nome, tipo: a.tipo }))], linhas };
      },
    },
    escolher: {
      nome: 'Outras Colunas Removidas', descricao: 'Fica só com as colunas escolhidas',
      m: (e, ant) => `Table.SelectColumns(${ant}, ${listaM(e.colunas.map(aspas))})`,
      executar: (tab, e) => {
        const idx = e.colunas.map(c => exigeColuna(tab, c));
        return { colunas: idx.map(i => tab.colunas[i]), linhas: tab.linhas.map(l => idx.map(i => l[i])) };
      },
    },
    remover: {
      nome: 'Colunas Removidas', descricao: 'Tira as colunas escolhidas',
      m: (e, ant) => `Table.RemoveColumns(${ant}, ${listaM(e.colunas.map(aspas))})`,
      executar: (tab, e) => {
        const fora = new Set(e.colunas.map(c => exigeColuna(tab, c)));
        const ficam = tab.colunas.map((_, i) => i).filter(i => !fora.has(i));
        return { colunas: ficam.map(i => tab.colunas[i]), linhas: tab.linhas.map(l => ficam.map(i => l[i])) };
      },
    },
    filtrar: {
      nome: 'Linhas Filtradas', descricao: 'Fica só com as linhas que atendem à condição',
      m: (e, ant) => `Table.SelectRows(${ant}, each ${semEach(e.expr)})`,
      executar: (tab, e) => {
        const arvore = analisar(semEach(e.expr));
        colunasUsadas(arvore).forEach(c => exigeColuna(tab, c));
        const linhas = tab.linhas.filter(l => {
          const r = avaliar(arvore, objetoLinha(tab, l));
          if (ehErro(r)) throw new FalhaEtapa(r.mensagem);
          return r === true;
        });
        return { colunas: tab.colunas, linhas };
      },
    },
    renomear: {
      nome: 'Colunas Renomeadas', descricao: 'Troca o nome das colunas',
      m: (e, ant) => `Table.RenameColumns(${ant}, ${listaM(e.pares.map(([a, b]) => `{${aspas(a)}, ${aspas(b)}}`))})`,
      executar: (tab, e) => {
        const colunas = tab.colunas.map(c => ({ ...c }));
        e.pares.forEach(([a, b]) => { colunas[exigeColuna(tab, a)].nome = b; });
        const nomes = colunas.map(c => c.nome);
        const repetido = nomes.find((n, i) => nomes.indexOf(n) !== i);
        if (repetido) throw new FalhaEtapa(`Expression.Error: já existe uma coluna chamada "${repetido}".`);
        return { colunas, linhas: tab.linhas };
      },
    },
    adicionar: {
      nome: 'Personalização Adicionada', descricao: 'Cria uma coluna com uma fórmula',
      m: (e, ant) => `Table.AddColumn(${ant}, ${aspas(e.coluna)}, each ${semEach(e.expr)}${e.tipoColuna && e.tipoColuna !== 'qualquer' ? ', ' + TIPOS[e.tipoColuna].m : ''})`,
      executar: (tab, e) => {
        if (tab.colunas.some(c => c.nome === e.coluna)) throw new FalhaEtapa(`Expression.Error: já existe uma coluna chamada "${e.coluna}".`);
        const arvore = analisar(semEach(e.expr));
        colunasUsadas(arvore).forEach(c => exigeColuna(tab, c));
        const tipo = e.tipoColuna || 'qualquer';
        return {
          colunas: [...tab.colunas, { nome: e.coluna, tipo }],
          linhas: tab.linhas.map(l => { let v = avaliar(arvore, objetoLinha(tab, l)); if (Number.isNaN(v)) v = new ErroM('Expression.Error: 0 dividido por 0 não tem resultado.'); return [...l, tipo === 'qualquer' ? v : converter(v, tipo)]; }),
        };
      },
    },
  };

  // Nome novo e único para uma etapa (Tipo Alterado, Tipo Alterado1, Tipo Alterado2...)
  function nomeUnico(etapas, base) {
    const usados = new Set(etapas.map(e => e.nome));
    if (!usados.has(base)) return base;
    let n = 1; while (usados.has(base + n)) n++;
    return base + n;
  }

  // Código M completo da consulta (let ... in ...)
  function gerarM(consulta) {
    const et = consulta.etapas;
    if (!et.length) return 'let\n    Fonte = #table({}, {})\nin\n    Fonte';
    const linhas = et.map((e, i) => `    ${idM(e.nome)} = ${ETAPAS[e.tipo].m(e, i ? idM(et[i - 1].nome) : null)}`);
    return `let\n${linhas.join(',\n')}\nin\n    ${idM(et[et.length - 1].nome)}`;
  }
  // Só a linha de uma etapa (para a barra de fórmula)
  function gerarMEtapa(consulta, i) {
    const e = consulta.etapas[i];
    return '= ' + ETAPAS[e.tipo].m(e, i ? idM(consulta.etapas[i - 1].nome) : null);
  }

  // Executa as etapas até a de índice "ate". Devolve a tabela ou o erro da primeira etapa que falhou.
  // "todas" = todas as consultas (para Mesclar e Acrescentar); "pilha" = quem está chamando (para achar referência circular)
  function executar(consulta, ate = consulta.etapas.length - 1, todas = [], pilha = []) {
    let tab = { colunas: [], linhas: [] };
    const ctx = { textoFonte: consulta.fonte ? consulta.fonte.texto : '', todas, pilha: [...pilha, consulta.nome] };
    for (let i = 0; i <= ate && i < consulta.etapas.length; i++) {
      const e = consulta.etapas[i];
      try { tab = ETAPAS[e.tipo].executar(tab, e, ctx); }
      catch (err) {
        const msg = err instanceof FalhaEtapa ? err.message : 'Erro inesperado: ' + err.message;
        return { tabela: null, erro: { indice: i, etapa: e.nome, mensagem: msg } };
      }
    }
    return { tabela: tab, erro: null };
  }

  // Qualidade da coluna (a barrinha verde/vermelha/cinza do Power Query)
  function qualidade(tab, i) {
    let validos = 0, erros = 0, vazios = 0;
    for (const l of tab.linhas) { const v = l[i]; if (ehErro(v)) erros++; else if (v === null || v === '') vazios++; else validos++; }
    return { validos, erros, vazios, total: tab.linhas.length };
  }

  // Monta uma consulta nova a partir do texto de um CSV: Fonte → Cabeçalhos Promovidos → Tipo Alterado
  function consultaDeCsv(nome, arquivo, textoCsv) {
    const csv = lerCsv(textoCsv);
    const consulta = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), nome, fonte: { arquivo, texto: textoCsv }, etapas: [] };
    let seq = 0; const novoId = () => 'e' + (++seq);
    consulta.etapas.push({ id: novoId(), tipo: 'fonte', nome: 'Fonte', arquivo, delimitador: csv.delimitador });
    consulta.etapas.push({ id: novoId(), tipo: 'promover', nome: 'Cabeçalhos Promovidos' });
    const tab = executar(consulta).tabela;
    if (tab && tab.colunas.length) {
      const lista = tab.colunas.map((c, i) => [c.nome, detectarTipo(tab.linhas.map(l => l[i]))]);
      consulta.etapas.push({ id: novoId(), tipo: 'tipos', nome: 'Tipo Alterado', lista });
      const textos = lista.filter(([, t]) => t === 'texto').map(([c]) => c);
      if (textos.length) consulta.etapas.push({ id: novoId(), tipo: 'limparEspacos', nome: 'Espaços Removidos', colunas: textos });
    }
    return consulta;
  }

  // Insere uma etapa depois da posição "depoisDe" (ou no fim), já com nome único
  function inserirEtapa(consulta, etapa, depoisDe = consulta.etapas.length - 1) {
    const nova = { id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ...etapa, nome: nomeUnico(consulta.etapas, etapa.nomeBase || ETAPAS[etapa.tipo].nome) };
    delete nova.nomeBase;
    consulta.etapas.splice(depoisDe + 1, 0, nova);
    return depoisDe + 1;
  }

  // Monta a expressão do filtro a partir do formulário (coluna, operador, valor)
  const OPERADORES = {
    igual:       { rotulo: 'é igual a',          expr: (c, v) => `${c} = ${v}` },
    diferente:   { rotulo: 'não é igual a',      expr: (c, v) => `${c} <> ${v}` },
    maior:       { rotulo: 'é maior que',        expr: (c, v) => `${c} > ${v}` },
    maiorIgual:  { rotulo: 'é maior ou igual a', expr: (c, v) => `${c} >= ${v}` },
    menor:       { rotulo: 'é menor que',        expr: (c, v) => `${c} < ${v}` },
    menorIgual:  { rotulo: 'é menor ou igual a', expr: (c, v) => `${c} <= ${v}` },
    contem:      { rotulo: 'contém',             expr: (c, v) => `Text.Contains(${c}, ${v})`, soTexto: true },
    naoContem:   { rotulo: 'não contém',         expr: (c, v) => `not Text.Contains(${c}, ${v})`, soTexto: true },
    comeca:      { rotulo: 'começa com',         expr: (c, v) => `Text.StartsWith(${c}, ${v})`, soTexto: true },
    termina:     { rotulo: 'termina com',        expr: (c, v) => `Text.EndsWith(${c}, ${v})`, soTexto: true },
    vazio:       { rotulo: 'está vazio',         expr: c => `${c} = null`, semValor: true },
    naoVazio:    { rotulo: 'não está vazio',     expr: c => `${c} <> null and ${c} <> ""`, semValor: true },
  };
  function literalM(valor, tipo) {
    const s = String(valor ?? '').trim();
    if (tipo === 'inteiro' || tipo === 'decimal') { const n = lerNumero(s); if (isNaN(n)) throw new FalhaEtapa(`"${s}" não é um número.`); return String(n); }
    if (tipo === 'data') { const d = lerData(s); if (!d) throw new FalhaEtapa(`"${s}" não é uma data (use dd/mm/aaaa).`); const [a, m, dd] = d.split('-'); return `#date(${+a}, ${+m}, ${+dd})`; }
    if (tipo === 'hora') { const h = lerHora(s); if (!h) throw new FalhaEtapa(`"${s}" não é uma hora (use hh:mm).`); const [hh, mm, ss] = h.split(':'); return `#time(${+hh}, ${+mm}, ${+ss})`; }
    if (tipo === 'logico') return /^(true|verdadeiro|sim|1)$/i.test(s) ? 'true' : 'false';
    return aspas(s);
  }
  function exprCondicao(coluna, operador, valor, tipo) {
    const op = OPERADORES[operador]; const c = '[' + coluna + ']';
    return op.semValor ? op.expr(c) : op.expr(c, literalM(valor, op.soTexto ? 'texto' : tipo));
  }

  /* ---------------- filtro do formulário ↔ M ----------------
     Modelo do formulário (sem ambiguidade): em cada nível vale UM conector só.
       { junta: 'and'|'or', itens: [ cond | { grupo: true, junta, conds: [cond, ...] } ] }
       cond = { coluna, operador, valor }
     Para misturar E com OU usa-se um grupo, que vira parênteses no M. */
  function montarFiltro(filtro, tipos = {}) {
    const um = c => OPERADORES[c.operador].semValor ? OPERADORES[c.operador].expr('[' + c.coluna + ']') : exprCondicao(c.coluna, c.operador, c.valor, tipos[c.coluna]);
    // "não está vazio" é um "and" por dentro: vai entre parênteses quando está no meio de um "or"
    const parte = (c, juntaDeFora) => { const e = um(c); return c.operador === 'naoVazio' && juntaDeFora === 'or' ? `(${e})` : e; };
    const partes = filtro.itens.map(it => {
      if (!it.grupo) return parte(it, filtro.itens.length > 1 ? filtro.junta : null);
      const ps = it.conds.map(c => parte(c, it.conds.length > 1 ? it.junta : filtro.junta));
      return ps.length > 1 ? `(${ps.join(` ${it.junta} `)})` : ps[0];
    });
    return partes.join(` ${filtro.junta} `);
  }
  // Frase em português do filtro, para a pessoa conferir como ele será lido
  function lerFiltroEmPortugues(filtro) {
    const J = { and: 'E', or: 'OU' };
    const um = c => `${c.coluna} ${OPERADORES[c.operador].rotulo}${OPERADORES[c.operador].semValor ? '' : ` "${c.valor}"`}`;
    return filtro.itens.map(it => it.grupo ? (it.conds.length > 1 ? `( ${it.conds.map(um).join(` ${J[it.junta]} `)} )` : um(it.conds[0])) : um(it)).join(` ${J[filtro.junta]} `);
  }
  // Caminho de volta: lê a expressão M e devolve o modelo do formulário (ou null se não cabe nele)
  function lerFiltro(expr) {
    let arvore;
    try { arvore = analisar(semEach(expr)); } catch { return null; }
    const pad2 = n => String(n).padStart(2, '0');
    const valorDe = no => {
      if (no.k === 'lit' && typeof no.v === 'string') return no.v;
      if (no.k === 'lit' && typeof no.v === 'number') return String(no.v).replace('.', ',');
      if (no.k === 'lit' && typeof no.v === 'boolean') return no.v ? 'true' : 'false';
      if (no.k === 'neg' && no.a.k === 'lit' && typeof no.a.v === 'number') return '-' + String(no.a.v).replace('.', ',');
      if (no.k === 'fn' && no.nome === '#date' && no.args.every(a => a.k === 'lit')) { const [a, m, d] = no.args.map(x => x.v); return `${pad2(d)}/${pad2(m)}/${a}`; }
      if (no.k === 'fn' && no.nome === '#time' && no.args.every(a => a.k === 'lit')) { const [h, m] = no.args.map(x => x.v); return `${pad2(h)}:${pad2(m)}`; }
      return undefined;
    };
    const OP_BIN = { '=': 'igual', '<>': 'diferente', '>': 'maior', '>=': 'maiorIgual', '<': 'menor', '<=': 'menorIgual' };
    const OP_FN = { 'Text.Contains': 'contem', 'Text.StartsWith': 'comeca', 'Text.EndsWith': 'termina' };
    const ehDifNulo = no => no.k === 'bin' && no.op === '<>' && no.a.k === 'col' && no.b.k === 'lit' && no.b.v === null;
    const ehDifVazio = no => no.k === 'bin' && no.op === '<>' && no.a.k === 'col' && no.b.k === 'lit' && no.b.v === '';
    const condicao = no => {
      if (no.k === 'bin' && no.op === 'and' && ehDifNulo(no.a) && ehDifVazio(no.b) && no.a.a.nome === no.b.a.nome) return { coluna: no.a.a.nome, operador: 'naoVazio', valor: '' };
      if (no.k === 'bin' && OP_BIN[no.op] && no.a.k === 'col') {
        if (no.b.k === 'lit' && no.b.v === null) return no.op === '=' ? { coluna: no.a.nome, operador: 'vazio', valor: '' } : null;
        const v = valorDe(no.b); if (v !== undefined) return { coluna: no.a.nome, operador: OP_BIN[no.op], valor: v };
      }
      if (no.k === 'fn' && OP_FN[no.nome] && no.args.length === 2 && no.args[0].k === 'col' && no.args[1].k === 'lit' && typeof no.args[1].v === 'string') return { coluna: no.args[0].nome, operador: OP_FN[no.nome], valor: no.args[1].v };
      if (no.k === 'not' && no.a.k === 'fn' && no.a.nome === 'Text.Contains' && no.a.args.length === 2 && no.a.args[0].k === 'col' && no.a.args[1].k === 'lit') return { coluna: no.a.args[0].nome, operador: 'naoContem', valor: no.a.args[1].v };
      return null;
    };
    const ehLogico = no => no.k === 'bin' && (no.op === 'and' || no.op === 'or') && !condicao(no);
    const achatar = (no, op) => (no.k === 'bin' && no.op === op && !condicao(no) ? [...achatar(no.a, op), ...achatar(no.b, op)] : [no]);
    // numa lista de "and", junta "[C] <> null" + "[C] <> \"\"" de volta em "não está vazio"
    const paraConds = (nos, op) => {
      const out = [];
      for (let i = 0; i < nos.length; i++) {
        if (op === 'and' && ehDifNulo(nos[i]) && nos[i + 1] && ehDifVazio(nos[i + 1]) && nos[i].a.nome === nos[i + 1].a.nome) { out.push({ coluna: nos[i].a.nome, operador: 'naoVazio', valor: '' }); i++; continue; }
        const c = condicao(nos[i]); if (!c) return null;
        out.push(c);
      }
      return out;
    };
    const junta = ehLogico(arvore) ? arvore.op : 'and';
    const nos = ehLogico(arvore) ? achatar(arvore, junta) : [arvore];
    const itens = [];
    for (let i = 0; i < nos.length; i++) {
      const no = nos[i];
      if (junta === 'and' && ehDifNulo(no) && nos[i + 1] && ehDifVazio(nos[i + 1]) && no.a.nome === nos[i + 1].a.nome) { itens.push({ coluna: no.a.nome, operador: 'naoVazio', valor: '' }); i++; continue; }
      const c = condicao(no);
      if (c) { itens.push(c); continue; }
      if (ehLogico(no) && no.op !== junta) {
        const conds = paraConds(achatar(no, no.op), no.op);
        if (!conds) return null;
        itens.push({ grupo: true, junta: no.op, conds });
        continue;
      }
      return null; // grupo dentro de grupo, ou função que o formulário não tem
    }
    return { junta, itens };
  }

  // Testa uma expressão nas primeiras linhas (prévia ao vivo da coluna personalizada)
  function testarExpressao(tab, expr, n = 5) {
    const arvore = analisar(semEach(expr));
    colunasUsadas(arvore).forEach(c => exigeColuna(tab, c));
    return tab.linhas.slice(0, n).map(l => avaliar(arvore, objetoLinha(tab, l)));
  }

  /* ---------------- leitor de M (E2): texto → etapas ----------------
     Faz o caminho de volta do gerarM: lê o "let ... in" (Editor avançado) ou uma linha
     da barra de fórmula e devolve as etapas. Aceita só as funções do catálogo ETAPAS;
     o resto vira uma mensagem dizendo o que ainda não é suportado. */
  // Divide o texto nos separadores do nível de fora (fora de aspas, (), {}, [])
  function dividirTopo(texto, separador = ',') {
    const partes = []; let prof = 0, aspasAbertas = false, ini = 0;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (aspasAbertas) { if (c === '"') { if (texto[i + 1] === '"') i++; else aspasAbertas = false; } continue; }
      if (c === '"') aspasAbertas = true;
      else if ('([{'.includes(c)) prof++;
      else if (')]}'.includes(c)) prof--;
      else if (c === separador && prof === 0) { partes.push(texto.slice(ini, i)); ini = i + 1; }
    }
    partes.push(texto.slice(ini));
    return partes.map(p => p.trim()).filter((p, i, a) => p !== '' || a.length > 1);
  }
  function semComentarios(texto) {
    let out = '', aspasAbertas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (aspasAbertas) { out += c; if (c === '"') { if (texto[i + 1] === '"') { out += '"'; i++; } else aspasAbertas = false; } continue; }
      if (c === '"') { aspasAbertas = true; out += c; continue; }
      if (c === '/' && texto[i + 1] === '/') { while (i < texto.length && texto[i] !== '\n') i++; out += '\n'; continue; }
      if (c === '/' && texto[i + 1] === '*') { const f = texto.indexOf('*/', i + 2); i = f < 0 ? texto.length : f + 1; out += ' '; continue; }
      out += c;
    }
    return out;
  }
  const RE_NOME = /^\s*(#"(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_]*)/;
  const lerNome = s => { const m = RE_NOME.exec(s); if (!m) return null; const n = m[1]; return { nome: n.startsWith('#"') ? n.slice(2, -1).replace(/""/g, '"') : n, resto: s.slice(m[0].length) }; };
  function lerTexto(a, oque) {
    const m = /^"((?:[^"]|"")*)"$/.exec(String(a).trim());
    if (!m) throw new FalhaEtapa(`era esperado um texto entre aspas para ${oque} e veio ${a || 'nada'}.`);
    return m[1].replace(/""/g, '"');
  }
  function lerLista(a, oque) {
    const m = /^\{([\s\S]*)\}$/.exec(String(a).trim());
    if (!m) throw new FalhaEtapa(`era esperada uma lista entre chaves { } para ${oque}.`);
    return m[1].trim() === '' ? [] : dividirTopo(m[1]);
  }
  const ALIAS_TIPO = { 'Text.Type': 'texto', 'Number.Type': 'decimal', 'Currency.Type': 'decimal', 'Percentage.Type': 'decimal', 'Int32.Type': 'inteiro', 'Int16.Type': 'inteiro', 'Date.Type': 'data', 'DateTime.Type': 'dataHora', 'Time.Type': 'hora', 'Logical.Type': 'logico', 'Any.Type': 'qualquer' };
  function lerTipo(a) {
    const t = String(a).trim().replace(/\s+/g, ' ');
    const k = TIPO_DO_M[t] || ALIAS_TIPO[t];
    if (!k) throw new FalhaEtapa(`o tipo ${t} não é reconhecido. Use, por exemplo: type text, Int64.Type, type number, type date, type datetime, type time ou type logical.`);
    return k;
  }
  function lerRegistro(a) {
    const m = /^\[([\s\S]*)\]$/.exec(String(a).trim()); if (!m) return {};
    const out = {};
    dividirTopo(m[1]).forEach(par => { const i = par.indexOf('='); if (i > 0) out[par.slice(0, i).trim()] = par.slice(i + 1).trim(); });
    return out;
  }
  function lerEach(a) {
    const m = /^each\s+([\s\S]+)$/.exec(String(a).trim());
    if (!m) throw new FalhaEtapa('a condição ou a fórmula precisa começar com "each" (ex.: each [CANAL] = "VOZ").');
    const expr = m[1].trim();
    analisar(expr); // confere a escrita da expressão
    return expr;
  }
  const FUNCOES_ETAPA = 'Csv.Document, Table.PromoteHeaders, Table.TransformColumnTypes, Table.TransformColumns (limpeza de espaços), Table.NestedJoin, Table.ExpandTableColumn, Table.Combine, Table.Group, Table.SelectColumns, Table.RemoveColumns, Table.SelectRows, Table.RenameColumns e Table.AddColumn';

  // Lê a expressão de UMA etapa. "anterior" é o nome da etapa de cima (null para a primeira).
  function lerExpressaoEtapa(expr, anterior, consulta) {
    const m = /^\s*([A-Za-z][A-Za-z0-9.]*)\s*\(([\s\S]*)\)\s*$/.exec(expr);
    if (!m) throw new FalhaEtapa(`não entendi "${expr.trim().slice(0, 60)}". Cada etapa precisa ser uma chamada de função, como Table.SelectRows(...).`);
    const [, fn, corpo] = m;
    const args = dividirTopo(corpo);
    const exigeAnterior = () => {
      if (anterior === null) throw new FalhaEtapa(`${fn} não pode ser a primeira etapa: ela trabalha sobre uma tabela que já existe.`);
      const r = lerNome(args[0] || '');
      if (!r || r.resto.trim() !== '' || r.nome !== anterior) throw new FalhaEtapa(`nesta versão, cada etapa usa a etapa logo acima. Aqui o primeiro valor de ${fn} deveria ser ${idM(anterior)}.`);
    };
    const qtd = (min, max) => { if (args.length < min || args.length > max) throw new FalhaEtapa(`${fn} recebeu ${args.length} valor(es); o esperado é ${min === max ? min : `de ${min} a ${max}`}.`); };
    switch (fn) {
      case 'Csv.Document': {
        if (anterior !== null) throw new FalhaEtapa('Csv.Document só pode ser a primeira etapa (Fonte).');
        qtd(1, 2);
        const arq = /^File\.Contents\(\s*("(?:[^"]|"")*")\s*\)$/.exec(args[0].trim());
        if (!arq) throw new FalhaEtapa('o primeiro valor de Csv.Document precisa ser File.Contents("arquivo.csv").');
        const arquivo = lerTexto(arq[1], 'o arquivo');
        if (consulta && consulta.fonte && consulta.fonte.arquivo !== arquivo) throw new FalhaEtapa(`o arquivo "${arquivo}" não está carregado nesta consulta. O arquivo dela é "${consulta.fonte.arquivo}". Para outro arquivo, use + Nova consulta.`);
        const reg = lerRegistro(args[1] || '');
        let delim = reg.Delimiter ? reg.Delimiter.trim() : '";"';
        delim = delim === '"#(tab)"' ? '\t' : lerTexto(delim, 'o Delimiter');
        return { tipo: 'fonte', arquivo, delimitador: delim };
      }
      case 'Table.PromoteHeaders': qtd(1, 2); exigeAnterior(); return { tipo: 'promover' };
      case 'Table.TransformColumnTypes': {
        qtd(2, 3); exigeAnterior();
        const itens = lerLista(args[1], 'as colunas e tipos');
        const lista = itens.map(it => { const par = lerLista(it, 'cada par {"Coluna", tipo}'); if (par.length !== 2) throw new FalhaEtapa('cada item precisa ser {"Coluna", tipo}.'); return [lerTexto(par[0], 'o nome da coluna'), lerTipo(par[1])]; });
        if (!lista.length) throw new FalhaEtapa('a lista de colunas e tipos está vazia.');
        return { tipo: 'tipos', lista };
      }
      case 'Table.NestedJoin': {
        qtd(6, 7); exigeAnterior();
        const outra = lerNome(args[2]);
        if (!outra || outra.resto.trim()) throw new FalhaEtapa('o terceiro valor de Table.NestedJoin é o nome da outra consulta (ex.: quadro ou #"minha consulta").');
        const jm = /^JoinKind\.(\w+)$/.exec(args[5].trim());
        if (!jm || !JUNCOES[jm[1]]) throw new FalhaEtapa(`o tipo de junção precisa ser um destes: ${Object.keys(JUNCOES).map(k => 'JoinKind.' + k).join(', ')}.`);
        return { tipo: 'mesclar', chaves: lerLista(args[1], 'as chaves').map(c => lerTexto(c, 'a chave')), consulta: outra.nome, chavesOutra: lerLista(args[3], 'as chaves da outra consulta').map(c => lerTexto(c, 'a chave')), coluna: lerTexto(args[4], 'o nome da nova coluna'), juncao: jm[1] };
      }
      case 'Table.ExpandTableColumn': {
        qtd(3, 4); exigeAnterior();
        const colunas = lerLista(args[2], 'as colunas a expandir').map(c => lerTexto(c, 'o nome da coluna'));
        const novos = args[3] ? lerLista(args[3], 'os novos nomes').map(c => lerTexto(c, 'o novo nome')) : colunas.slice();
        if (novos.length !== colunas.length) throw new FalhaEtapa('a lista de novos nomes precisa ter o mesmo tamanho da lista de colunas.');
        return { tipo: 'expandir', coluna: lerTexto(args[1], 'a coluna de tabelas'), colunas, novos };
      }
      case 'Table.Combine': {
        qtd(1, 2);
        if (anterior === null) throw new FalhaEtapa('Table.Combine não pode ser a primeira etapa.');
        const itens = lerLista(args[0], 'as consultas').map(it => { const r = lerNome(it); if (!r || r.resto.trim()) throw new FalhaEtapa(`"${it}" não é um nome de consulta.`); return r.nome; });
        if (itens[0] !== anterior) throw new FalhaEtapa(`nesta versão, a lista do Table.Combine começa pela etapa logo acima: {${idM(anterior)}, ...}.`);
        if (itens.length < 2) throw new FalhaEtapa('Table.Combine precisa de pelo menos uma outra consulta na lista.');
        return { tipo: 'acrescentar', consultas: itens.slice(1) };
      }
      case 'Table.Group': {
        qtd(3, 4); exigeAnterior();
        const normal = x => x.replace(/\s+/g, ' ').trim();
        const agregacoes = lerLista(args[2], 'as novas colunas').map(it => {
          const par = lerLista(it, 'cada item {"Nome", each função, tipo}');
          if (par.length < 2) throw new FalhaEtapa('cada item precisa ser {"Nome", each função, tipo}.');
          const f = normal(par[1]);
          for (const [op, a] of Object.entries(AGREGACOES)) {
            const modelo = ('each ' + a.m('\u0000')).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\u0000', '(.+?)');
            const mm = new RegExp('^' + modelo + '$').exec(f);
            if (mm) return { nome: lerTexto(par[0], 'o nome da nova coluna'), op, coluna: a.semColuna ? null : mm[1], tipo: par[2] ? lerTipo(par[2]) : a.tipo() };
          }
          throw new FalhaEtapa(`a conta "${par[1]}" não é uma das aceitas no Agrupar: ${Object.values(AGREGACOES).map(a => a.m('COL')).join(', ')}.`);
        });
        return { tipo: 'agrupar', chaves: lerLista(args[1], 'as colunas de grupo').map(c => lerTexto(c, 'a coluna de grupo')), agregacoes };
      }
      case 'Table.TransformColumns': {
        qtd(2, 3); exigeAnterior();
        const normal = x => x.replace(/\s+/g, ' ').trim();
        const colunas = lerLista(args[1], 'as colunas').map(it => {
          const par = lerLista(it, 'cada item {"Coluna", função, tipo}');
          if (par.length < 2 || normal(par[1]) !== normal(M_LIMPAR)) throw new FalhaEtapa(`por enquanto Table.TransformColumns só aceita a limpeza de espaços: {"Coluna", ${M_LIMPAR}, type text}.`);
          return lerTexto(par[0], 'o nome da coluna');
        });
        return { tipo: 'limparEspacos', colunas };
      }
      case 'Table.SelectColumns':
      case 'Table.RemoveColumns': {
        qtd(2, 3); exigeAnterior();
        const colunas = args[1].trim().startsWith('{') ? lerLista(args[1], 'as colunas').map(c => lerTexto(c, 'o nome da coluna')) : [lerTexto(args[1], 'o nome da coluna')];
        if (!colunas.length) throw new FalhaEtapa('a lista de colunas está vazia.');
        return { tipo: fn === 'Table.SelectColumns' ? 'escolher' : 'remover', colunas };
      }
      case 'Table.SelectRows': qtd(2, 2); exigeAnterior(); return { tipo: 'filtrar', expr: lerEach(args[1]) };
      case 'Table.RenameColumns': {
        qtd(2, 3); exigeAnterior();
        let itens = lerLista(args[1], 'os pares {"antigo", "novo"}');
        if (itens.length === 2 && itens[0].trim().startsWith('"')) itens = [args[1]]; // um par só: {"a", "b"}
        const pares = itens.map(it => { const par = lerLista(it, 'cada par'); if (par.length !== 2) throw new FalhaEtapa('cada item precisa ser {"nome antigo", "nome novo"}.'); return [lerTexto(par[0], 'o nome antigo'), lerTexto(par[1], 'o nome novo')]; });
        return { tipo: 'renomear', pares };
      }
      case 'Table.AddColumn': {
        qtd(3, 4); exigeAnterior();
        return { tipo: 'adicionar', coluna: lerTexto(args[1], 'o nome da nova coluna'), expr: lerEach(args[2]), tipoColuna: args[3] ? lerTipo(args[3]) : 'qualquer' };
      }
    }
    throw new FalhaEtapa(`a função ${fn} ainda não está no Estúdio. Por enquanto as etapas podem usar: ${FUNCOES_ETAPA}.`);
  }

  // Lê o código M inteiro (let ... in ...) e devolve a nova lista de etapas
  function lerM(texto, consulta) {
    const limpo = semComentarios(String(texto)).trim();
    const m = /^let\b([\s\S]*)$/.exec(limpo);
    if (!m) throw new FalhaEtapa('o código precisa começar com "let".');
    // procura o "in" do nível de fora (fora de aspas e de parênteses)
    const corpo = m[1]; let prof = 0, aspasAbertas = false, posIn = -1;
    for (let i = 0; i < corpo.length; i++) {
      const c = corpo[i];
      if (aspasAbertas) { if (c === '"') { if (corpo[i + 1] === '"') i++; else aspasAbertas = false; } continue; }
      if (c === '"') aspasAbertas = true;
      else if ('([{'.includes(c)) prof++;
      else if (')]}'.includes(c)) prof--;
      else if (prof === 0 && /\bin\b/.test(corpo.slice(i, i + 3)) && /[\s,)\]}]/.test(corpo[i - 1] || ' ') && /\s/.test(corpo[i + 2] || '')) posIn = i;
    }
    if (posIn < 0) throw new FalhaEtapa('faltou o "in" no fim, com o nome da última etapa.');
    const defs = dividirTopo(corpo.slice(0, posIn));
    const final = lerNome(corpo.slice(posIn + 2));
    const etapas = []; const vistos = new Set();
    defs.forEach((def, i) => {
      const r = lerNome(def);
      const pos = `Linha da etapa ${i + 1}`;
      if (!r || !/^\s*=/.test(r.resto)) throw new FalhaEtapa(`${pos}: cada etapa é escrita como Nome = Função(...). Nomes com espaço ou acento vão como #"Nome da etapa".`);
      if (vistos.has(r.nome)) throw new FalhaEtapa(`${pos}: o nome "${r.nome}" já foi usado em outra etapa.`);
      vistos.add(r.nome);
      try {
        const dados = lerExpressaoEtapa(r.resto.replace(/^\s*=/, ''), i ? etapas[i - 1].nome : null, consulta);
        etapas.push({ id: 'e' + (i + 1) + Math.random().toString(36).slice(2, 6), nome: r.nome, ...dados });
      } catch (e) { throw new FalhaEtapa(`Etapa "${r.nome}": ${e.message}`); }
    });
    if (!etapas.length) throw new FalhaEtapa('nenhuma etapa encontrada entre o "let" e o "in".');
    if (!final || final.resto.trim() !== '' || final.nome !== etapas[etapas.length - 1].nome) throw new FalhaEtapa(`depois do "in" vai o nome da última etapa: ${idM(etapas[etapas.length - 1].nome)}.`);
    return etapas;
  }

  // Lê a linha da barra de fórmula ("= Table.SelectRows(...)") para a etapa de índice i
  function lerLinhaEtapa(texto, consulta, i) {
    const expr = semComentarios(String(texto)).trim().replace(/^=/, '');
    const anterior = i > 0 ? consulta.etapas[i - 1].nome : null;
    return lerExpressaoEtapa(expr, anterior, consulta);
  }

  const api = {
    TIPOS, TIPO_DO_M, FUNCOES_M, ETAPAS, OPERADORES, JUNCOES, AGREGACOES, ErroM, FalhaEtapa,
    lerM, lerLinhaEtapa, dividirTopo, montarFiltro, lerFiltro, lerFiltroEmPortugues,
    ehErro, converter, formatar, detectarTipo, lerCsv, lerNumero, lerData,
    analisar, avaliar, colunasUsadas, gerarM, gerarMEtapa, executar, qualidade,
    consultaDeCsv, inserirEtapa, nomeUnico, exprCondicao, literalM, testarExpressao, idM,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.MMotor = api;
})(typeof self !== 'undefined' ? self : this);
