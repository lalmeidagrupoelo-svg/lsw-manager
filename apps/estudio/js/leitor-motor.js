/* =====================================================================
   ESTÚDIO · MOTOR DO LEITOR DE FÓRMULAS (E6 · 13/11/2026)
   Explica uma fórmula M (each ...) em português, a partir da árvore que o
   m-motor.js já monta (analisar):
   - escrever(no): volta a árvore para texto M (com os parênteses necessários);
   - frase(no): a fórmula inteira como frase em português;
   - passos(no, linha): a ordem da conta, com o valor de cada parte para uma linha;
   - lerConsulta(consulta): cada etapa da consulta explicada numa frase.
   Roda no navegador (window.LeitorMotor) e no Node (testes).
   ===================================================================== */
(function (raiz) {
  'use strict';
  const M = typeof module === 'object' && module.exports ? require('./m-motor.js') : raiz.MMotor;

  /* ---------- texto M da árvore ---------- */
  const NIVEL = { se: 0, or: 1, and: 2, not: 3, '=': 4, '<>': 4, '<': 5, '<=': 5, '>': 5, '>=': 5, '+': 6, '-': 6, '&': 6, '*': 7, '/': 7, neg: 8 };
  const nivelDe = no => (no.k === 'se' ? 0 : no.k === 'not' ? 3 : no.k === 'neg' ? 8 : no.k === 'bin' ? NIVEL[no.op] : 9);
  const textoM = v => (v === null ? 'null' : typeof v === 'boolean' ? String(v) : typeof v === 'number' ? String(v) : '"' + String(v).replace(/"/g, '""') + '"');
  function escrever(no) {
    const em = (filho, minimo) => { const t = escrever(filho); return nivelDe(filho) < minimo ? `(${t})` : t; };
    switch (no.k) {
      case 'lit': return textoM(no.v);
      case 'col': return `[${no.nome}]`;
      case 'neg': return '-' + em(no.a, 8);
      case 'not': return 'not ' + em(no.a, 3);
      case 'se': return `if ${escrever(no.c)} then ${escrever(no.a)} else ${escrever(no.b)}`;
      case 'fn': return `${no.nome}(${no.args.map(escrever).join(', ')})`;
      case 'bin': { const n = NIVEL[no.op]; return `${em(no.a, n)} ${no.op} ${em(no.b, n + 1)}`; }
    }
    return '?';
  }

  /* ---------- frase em português ---------- */
  const valorPt = v => {
    if (v === null || v === undefined) return 'vazio';
    if (M.ehErro(v)) return 'Error';
    if (typeof v === 'boolean') return v ? 'verdadeiro' : 'falso';
    if (typeof v === 'number') return v.toLocaleString('pt-BR', { maximumFractionDigits: 6, useGrouping: false });
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split('-').reverse().join('/');
    return `"${v}"`;
  };
  const casas = n => (n === 1 ? '1 casa' : `${n} casas`);
  const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  // Frases de cada função. Recebem os textos dos argumentos (a) e a própria árvore (no).
  const FRASES = {
    'Text.Upper': a => `${a[0]} em letras maiúsculas`,
    'Text.Lower': a => `${a[0]} em letras minúsculas`,
    'Text.Trim': a => `${a[0]} sem os espaços das pontas`,
    'Text.Length': a => `a quantidade de caracteres de ${a[0]}`,
    'Text.Start': a => `os ${a[1]} primeiros caracteres de ${a[0]}`,
    'Text.End': a => `os ${a[1]} últimos caracteres de ${a[0]}`,
    'Text.Contains': a => `${a[0]} contém ${a[1]}`,
    'Text.StartsWith': a => `${a[0]} começa com ${a[1]}`,
    'Text.EndsWith': a => `${a[0]} termina com ${a[1]}`,
    'Text.Replace': a => `${a[0]} trocando ${a[1]} por ${a[2]}`,
    'Text.From': a => `${a[0]} transformado em texto`,
    'Number.From': a => `${a[0]} transformado em número`,
    'Number.Round': (a, no) => (no.args[1] ? `${a[0]}, arredondado para ${no.args[1].k === 'lit' ? casas(no.args[1].v) : a[1] + ' casas'}` : `${a[0]}, arredondado para número inteiro`),
    'Number.RoundUp': (a, no) => `${a[0]}, arredondado para cima${no.args[1] ? ` (${no.args[1].k === 'lit' ? casas(no.args[1].v) : a[1]})` : ''}`,
    'Number.RoundDown': (a, no) => `${a[0]}, arredondado para baixo${no.args[1] ? ` (${no.args[1].k === 'lit' ? casas(no.args[1].v) : a[1]})` : ''}`,
    'Number.Abs': a => `${a[0]} sem o sinal de menos`,
    'Date.Year': a => `o ano de ${a[0]}`,
    'Date.Month': a => `o mês de ${a[0]}`,
    'Date.Day': a => `o dia de ${a[0]}`,
    'Date.DayOfWeek': a => `o dia da semana de ${a[0]} (0 = domingo)`,
    'Time.Hour': a => `a hora de ${a[0]}`,
    '#date': (a, no) => (no.args.every(x => x.k === 'lit') ? `a data ${String(no.args[2].v).padStart(2, '0')}/${String(no.args[1].v).padStart(2, '0')}/${no.args[0].v}` : `a data montada com ${a.join(', ')}`),
    '#time': (a, no) => (no.args.every(x => x.k === 'lit') ? `a hora ${String(no.args[0].v).padStart(2, '0')}:${String(no.args[1].v).padStart(2, '0')}` : `a hora montada com ${a.join(', ')}`),
  };
  const OPS = {
    '+': (a, b) => `${a} mais ${b}`, '-': (a, b) => `${a} menos ${b}`, '*': (a, b) => `${a} vezes ${b}`, '/': (a, b) => `${a} dividido por ${b}`,
    '&': (a, b) => `${a} seguido de ${b}`,
    '=': (a, b) => (b === 'vazio' ? `${a} estiver vazio` : `${a} for igual a ${b}`), '<>': (a, b) => (b === 'vazio' ? `${a} não estiver vazio` : `${a} for diferente de ${b}`),
    '>': (a, b) => `${a} for maior que ${b}`, '>=': (a, b) => `${a} for maior ou igual a ${b}`, '<': (a, b) => `${a} for menor que ${b}`, '<=': (a, b) => `${a} for menor ou igual a ${b}`,
    and: (a, b) => `${a} e ${b}`, or: (a, b) => `${a} ou ${b}`,
  };
  // Mesmas comparações no presente, para o passo a passo ("Confere se 57 é maior que 40")
  const OPS_PRESENTE = {
    '=': (a, b) => (b === 'vazio' ? `${a} está vazio` : `${a} é igual a ${b}`), '<>': (a, b) => (b === 'vazio' ? `${a} não está vazio` : `${a} é diferente de ${b}`),
    '>': (a, b) => `${a} é maior que ${b}`, '>=': (a, b) => `${a} é maior ou igual a ${b}`, '<': (a, b) => `${a} é menor que ${b}`, '<=': (a, b) => `${a} é menor ou igual a ${b}`,
  };
  const crase = t => t.replace(/ a a (data|hora) /g, ' à $1 ');
  function frase(no, pai) {
    let t;
    switch (no.k) {
      case 'lit': return no.v === null ? 'vazio' : valorPt(no.v);
      case 'col': return no.nome;
      case 'neg': return `menos ${frase(no.a, no)}`;
      case 'not': return `não é verdade que ${frase(no.a, no)}`;
      case 'se': t = `se ${frase(no.c, no)}, então ${frase(no.a, no)}; senão, ${frase(no.b, no)}`; break;
      case 'fn': { const a = no.args.map(x => frase(x, no)); t = FRASES[no.nome] ? FRASES[no.nome](a, no) : `${no.nome}(${a.join(', ')})`; break; }
      case 'bin': t = crase(OPS[no.op](frase(no.a, no), frase(no.b, no))); break;
    }
    // quando uma conta fica dentro de outra, os parênteses mostram o que vem primeiro
    const precisa = pai && pai.k === 'bin' && no.k === 'bin' && NIVEL[no.op] < NIVEL[pai.op];
    return precisa ? `(${t})` : t;
  }

  /* ---------- passo a passo com valores ---------- */
  // Uma frase curta para cada passo, já com os valores das partes de dentro
  function descreverPasso(no, v) {
    switch (no.k) {
      case 'col': return `Lê a coluna ${no.nome}`;
      case 'neg': return `Troca o sinal de ${valorPt(v.a)}`;
      case 'not': return `Inverte ${valorPt(v.a)}`;
      case 'se': return `A condição deu ${valorPt(v.c)}, então usa a parte do ${v.c === true ? '"então"' : '"senão"'}`;
      case 'fn': return FRASES[no.nome] ? 'Calcula ' + FRASES[no.nome](v.args.map(valorPt), no) : `Calcula ${no.nome}(${v.args.map(valorPt).join(', ')})`;
      case 'bin': {
        if (no.op === 'and' || no.op === 'or') return `Junta ${valorPt(v.a)} ${no.op === 'and' ? 'E' : 'OU'} ${valorPt(v.b)}`;
        if (['=', '<>', '<', '<=', '>', '>='].includes(no.op)) return `Confere se ${OPS_PRESENTE[no.op](valorPt(v.a), valorPt(v.b))}`;
        return { '+': 'Soma', '-': 'Subtrai', '*': 'Multiplica', '/': 'Divide', '&': 'Junta os textos' }[no.op] + ` ${valorPt(v.a)} ${{ '+': 'e', '-': 'menos', '*': 'por', '/': 'por', '&': 'e' }[no.op]} ${valorPt(v.b)}`;
      }
    }
    return escrever(no);
  }
  // Ordem em que o Estúdio faz a conta: primeiro as partes de dentro, depois as de fora
  function passos(no, linha) {
    const lista = []; const lidas = new Set();
    const ir = n => {
      const val = x => M.avaliar(x, linha);
      if (n.k === 'lit') return;
      if (n.k === 'col') { if (!lidas.has(n.nome)) { lidas.add(n.nome); lista.push({ tipo: 'leitura', texto: descreverPasso(n), expr: escrever(n), valor: val(n) }); } return; }
      const v = {};
      if (n.k === 'se') { ir(n.c); v.c = val(n.c); const ramo = v.c === true ? n.a : n.b; ir(ramo); }
      else if (n.k === 'fn') { n.args.forEach(ir); v.args = n.args.map(val); }
      else if (n.k === 'bin' && (n.op === 'and' || n.op === 'or')) { ir(n.a); v.a = val(n.a); if ((n.op === 'and' && v.a === false) || (n.op === 'or' && v.a === true)) v.b = '(nem precisou olhar)'; else { ir(n.b); v.b = val(n.b); } }
      else { ['a', 'b'].forEach(k => { if (n[k]) { ir(n[k]); v[k] = val(n[k]); } }); }
      lista.push({ tipo: 'conta', texto: descreverPasso(n, v), expr: escrever(n), valor: val(n) });
    };
    ir(no);
    return lista;
  }

  /* ---------- a consulta inteira ---------- */
  const listaPt = xs => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1]);
  function fraseEtapa(e) {
    const T = M.TIPOS;
    switch (e.tipo) {
      case 'fonte': return `Lê o arquivo "${e.arquivo}", separando as colunas por ${e.delimitador === ';' ? 'ponto e vírgula' : e.delimitador === ',' ? 'vírgula' : 'tabulação'}.`;
      case 'promover': return 'Usa a primeira linha como nome das colunas.';
      case 'tipos': return `Define o tipo de ${e.lista.length} coluna(s): ${listaPt(e.lista.map(([c, t]) => `${c} como ${T[t].rotulo.toLowerCase()}`))}.`;
      case 'limparEspacos': return `Tira os espaços sobrando de ${listaPt(e.colunas)}.`;
      case 'escolher': return `Fica só com as colunas ${listaPt(e.colunas)}.`;
      case 'remover': return `Tira as colunas ${listaPt(e.colunas)}.`;
      case 'filtrar': { let f; try { f = frase(M.analisar(e.expr)); } catch { f = e.expr; } return `Fica só com as linhas em que ${f}.`; }
      case 'renomear': return `Troca o nome de ${listaPt(e.pares.map(([a, b]) => `${a} para ${b}`))}.`;
      case 'adicionar': { let f; try { f = frase(M.analisar(e.expr)); } catch { f = e.expr; } return `Cria a coluna ${e.coluna}${e.tipoColuna && e.tipoColuna !== 'qualquer' ? ` (${T[e.tipoColuna].rotulo.toLowerCase()})` : ''} com: ${f}.`; }
      case 'mesclar': return `Liga cada linha às linhas de "${e.consulta}" com o mesmo ${listaPt(e.chaves.map((k, i) => (k === e.chavesOutra[i] ? k : `${k} = ${e.chavesOutra[i]}`)))} (junção ${M.JUNCOES[e.juncao].rotulo.toLowerCase()}).`;
      case 'expandir': return `Traz de "${e.coluna}" as colunas ${listaPt(e.colunas.map((c, i) => (c === e.novos[i] ? c : `${c} (como ${e.novos[i]})`)))}.`;
      case 'acrescentar': return `Põe embaixo as linhas de ${listaPt(e.consultas.map(c => `"${c}"`))}.`;
      case 'agrupar': return `Agrupa por ${listaPt(e.chaves)} e calcula ${listaPt(e.agregacoes.map(a => (M.AGREGACOES[a.op].semColuna ? `${a.nome} (contar linhas)` : `${a.nome} (${M.AGREGACOES[a.op].rotulo.toLowerCase()} de ${a.coluna})`)))}.`;
    }
    return M.ETAPAS[e.tipo] ? M.ETAPAS[e.tipo].descricao + '.' : '';
  }
  const lerConsulta = consulta => consulta.etapas.map(e => ({ nome: e.nome, tipo: e.tipo, frase: fraseEtapa(e) }));

  const api = { escrever, frase, passos, lerConsulta, fraseEtapa, valorPt };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.LeitorMotor = api;
})(typeof self !== 'undefined' ? self : this);
