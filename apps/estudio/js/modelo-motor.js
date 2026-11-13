/* =====================================================================
   ESTÚDIO · MOTOR DO MODELO (E4 · 13/11/2026)
   Relacionamentos entre consultas, no espírito do Power BI:
   - relação = { id, de: { consulta, coluna }, para: { consulta, coluna },
                 cardinalidade: 'N:1' | '1:1' | 'N:N', direcao: 'unica' | 'ambas', ativo }
     "de" é o lado MUITOS (*) e "para" é o lado UM (1). O filtro anda do 1 para o *
     (direção única) ou nos dois sentidos (ambas).
   - analisarRelacao: descobre a cardinalidade, o % de correspondência e os problemas;
   - sugerirRelacoes: acha colunas com o mesmo nome que dão uma boa relação;
   - consultarModelo: agrupa por uma coluna de uma tabela e resume colunas de outras,
     seguindo as relações ativas (o que um visual do Power BI faz).
   Sem dependências; roda no navegador (window.ModeloMotor) e no Node (testes).
   ===================================================================== */
(function (raiz) {
  'use strict';

  const ehErro = v => v && typeof v === 'object' && 'mensagem' in v && !('aninhada' in v);
  // Valor usado para comparar chaves. Vazio e Error não ligam nada. Número e texto são diferentes (como no Power BI).
  const chaveDe = v => (v === null || v === undefined || v === '' || ehErro(v) || (v && v.aninhada) ? null : JSON.stringify(v));
  const indiceColuna = (tab, nome) => tab.colunas.findIndex(c => c.nome === nome);
  const normalNome = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Quantas vezes cada valor aparece numa coluna
  function perfilColuna(tab, nome) {
    const i = indiceColuna(tab, nome);
    if (i < 0) return null;
    const contagem = new Map(); let vazios = 0;
    tab.linhas.forEach(l => { const k = chaveDe(l[i]); if (k === null) { vazios++; return; } contagem.set(k, (contagem.get(k) || 0) + 1); });
    let repetidos = 0; contagem.forEach(n => { if (n > 1) repetidos++; });
    return { contagem, distintos: contagem.size, vazios, repetidos, unico: repetidos === 0 && contagem.size > 0, tipo: tab.colunas[i].tipo, total: tab.linhas.length };
  }

  // Analisa uma relação entre A[colA] e B[colB]. Diz qual lado é o "1" e quanto combina.
  function analisarRelacao(tabA, colA, tabB, colB) {
    const pa = perfilColuna(tabA, colA), pb = perfilColuna(tabB, colB);
    if (!pa) return { erro: `A coluna "${colA}" não existe.` };
    if (!pb) return { erro: `A coluna "${colB}" não existe.` };
    let cardinalidade;
    if (pa.unico && pb.unico) cardinalidade = '1:1';
    else if (pb.unico) cardinalidade = 'N:1';
    else if (pa.unico) cardinalidade = '1:N'; // está invertida: o "1" é A; quem chama deve trocar os lados
    else cardinalidade = 'N:N';
    let achados = 0, linhasSemPar = 0; const exemplosSemPar = [];
    pa.contagem.forEach((n, k) => {
      if (pb.contagem.has(k)) achados++;
      else { linhasSemPar += n; if (exemplosSemPar.length < 3) exemplosSemPar.push(JSON.parse(k)); }
    });
    const numero = t => t === 'inteiro' || t === 'decimal';
    const tiposDiferentes = pa.tipo !== pb.tipo && !(numero(pa.tipo) && numero(pb.tipo));
    return {
      cardinalidade, tiposDiferentes, tipoA: pa.tipo, tipoB: pb.tipo,
      distintosA: pa.distintos, distintosB: pb.distintos, repetidosA: pa.repetidos, repetidosB: pb.repetidos,
      vaziosA: pa.vazios, achados, linhasSemPar, exemplosSemPar,
      correspondencia: pa.distintos ? achados / pa.distintos : 0,
    };
  }

  // Situação de uma relação já salva: 'ok', 'quebrada' (tabela ou coluna sumiu) e o motivo
  function situacao(rel, tabelas) {
    for (const lado of [rel.de, rel.para]) {
      const t = tabelas[lado.consulta];
      if (t === undefined) return { estado: 'quebrada', motivo: `A consulta "${lado.consulta}" não existe mais.` };
      if (t === null) return { estado: 'quebrada', motivo: `A consulta "${lado.consulta}" está com erro.` };
      if (indiceColuna(t, lado.coluna) < 0) return { estado: 'quebrada', motivo: `A coluna "${lado.coluna}" não existe mais em "${lado.consulta}" (foi renomeada ou removida no Transformar dados?).` };
    }
    return { estado: 'ok', motivo: '' };
  }

  // Sugere relações: colunas com o mesmo nome (sem ligar para acento e maiúsculas), um lado com valores únicos e boa correspondência
  function sugerirRelacoes(tabelas, existentes = []) {
    const nomes = Object.keys(tabelas).filter(n => tabelas[n]);
    const jaExiste = (a, b) => existentes.some(r => (r.de.consulta === a && r.para.consulta === b) || (r.de.consulta === b && r.para.consulta === a));
    const out = [];
    for (let i = 0; i < nomes.length; i++) for (let j = i + 1; j < nomes.length; j++) {
      const A = nomes[i], B = nomes[j];
      if (jaExiste(A, B)) continue;
      let melhor = null;
      tabelas[A].colunas.forEach(ca => tabelas[B].colunas.forEach(cb => {
        if (normalNome(ca.nome) !== normalNome(cb.nome) || ca.tipo === 'tabela') return;
        let an = analisarRelacao(tabelas[A], ca.nome, tabelas[B], cb.nome);
        let de = { consulta: A, coluna: ca.nome }, para = { consulta: B, coluna: cb.nome };
        if (an.cardinalidade === '1:N') { an = analisarRelacao(tabelas[B], cb.nome, tabelas[A], ca.nome); [de, para] = [para, de]; }
        if (an.cardinalidade === 'N:N' || an.tiposDiferentes || an.correspondencia < 0.5) return;
        if (!melhor || an.correspondencia > melhor.analise.correspondencia) melhor = { de, para, analise: an };
      }));
      if (melhor) out.push(melhor);
    }
    return out;
  }

  // Caminho de relações ativas que leva as linhas de "origem" até a tabela "destino".
  // De "de" (muitos) para "para" (um) sempre pode; de "para" para "de" só se a direção for "ambas".
  function caminho(origem, destino, relacoes) {
    if (origem === destino) return [];
    const ativas = relacoes.filter(r => r.ativo !== false);
    const fila = [[origem, []]]; const vistos = new Set([origem]);
    while (fila.length) {
      const [atual, passos] = fila.shift();
      for (const r of ativas) {
        const movimentos = [];
        if (r.de.consulta === atual) movimentos.push({ rel: r, de: r.de, para: r.para });
        if (r.para.consulta === atual && (r.direcao === 'ambas' || r.cardinalidade === '1:1')) movimentos.push({ rel: r, de: r.para, para: r.de });
        for (const m of movimentos) {
          const prox = m.para.consulta;
          if (vistos.has(prox)) continue;
          const novo = [...passos, m];
          if (prox === destino) return novo;
          vistos.add(prox); fila.push([prox, novo]);
        }
      }
    }
    return null;
  }

  const OPERACOES = {
    soma:      { rotulo: 'Soma' },
    media:     { rotulo: 'Média' },
    contar:    { rotulo: 'Contar linhas', semColuna: true },
    distintos: { rotulo: 'Contar distintos' },
    minimo:    { rotulo: 'Mínimo' },
    maximo:    { rotulo: 'Máximo' },
  };
  function resumir(op, vals) {
    if (op === 'contar') return vals.length;
    const v = vals.filter(x => x !== null && x !== '' && !ehErro(x));
    if (op === 'distintos') return new Set(v.map(x => JSON.stringify(x))).size;
    if (!v.length) return null;
    if (op === 'minimo') return v.reduce((a, b) => (b < a ? b : a));
    if (op === 'maximo') return v.reduce((a, b) => (b > a ? b : a));
    const n = v.filter(x => typeof x === 'number');
    if (!n.length) return null;
    const s = n.reduce((a, b) => a + b, 0);
    return op === 'soma' ? s : s / n.length;
  }

  // Agrupa por grupo.coluna (da tabela grupo.consulta) e resume cada valor { consulta, coluna, op, nome },
  // levando as linhas de cada tabela até o grupo pelas relações ativas. Linhas sem par vão para "(em branco)".
  function consultarModelo(tabelas, relacoes, pedido) {
    const { grupo, valores } = pedido;
    const tg = tabelas[grupo.consulta];
    if (!tg) throw new Error(`A consulta "${grupo.consulta}" não existe ou está com erro.`);
    const ig = indiceColuna(tg, grupo.coluna);
    if (ig < 0) throw new Error(`A coluna "${grupo.coluna}" não existe em "${grupo.consulta}".`);
    const BRANCO = '\u0000branco';
    const grupos = new Map(); // chave do grupo → { valor, porValor: [[...valores brutos]] }
    const pegarGrupo = v => { const k = chaveDe(v) ?? BRANCO; if (!grupos.has(k)) grupos.set(k, { valor: k === BRANCO ? null : v, porValor: valores.map(() => []) }); return grupos.get(k); };
    tg.linhas.forEach(l => pegarGrupo(l[ig])); // todo valor do grupo aparece, mesmo sem nada para resumir
    const avisos = [];
    valores.forEach((val, vi) => {
      const tv = tabelas[val.consulta];
      if (!tv) { avisos.push(`"${val.nome}": a consulta "${val.consulta}" não existe ou está com erro.`); return; }
      const iv = OPERACOES[val.op].semColuna ? -1 : indiceColuna(tv, val.coluna);
      if (iv < 0 && !OPERACOES[val.op].semColuna) { avisos.push(`"${val.nome}": a coluna "${val.coluna}" não existe em "${val.consulta}".`); return; }
      const passos = caminho(val.consulta, grupo.consulta, relacoes);
      if (!passos) { avisos.push(`"${val.nome}": não há caminho de relacionamento ativo entre "${val.consulta}" e "${grupo.consulta}". Crie a relação no modelo (ou ative a que existe).`); return; }
      // índices de cada passo: chave → linhas da próxima tabela
      const mapas = passos.map(p => {
        const tp = tabelas[p.para.consulta]; const ip = indiceColuna(tp, p.para.coluna);
        const mapa = new Map(); tp.linhas.forEach((l, j) => { const k = chaveDe(l[ip]); if (k === null) return; if (!mapa.has(k)) mapa.set(k, []); mapa.get(k).push(j); });
        return { mapa, idDe: indiceColuna(tabelas[p.de.consulta], p.de.coluna), tabela: tp };
      });
      tv.linhas.forEach(l => {
        let atuais = [l];
        for (const m of mapas) {
          const prox = [];
          atuais.forEach(r => { const js = m.mapa.get(chaveDe(r[m.idDe])) || []; js.forEach(j => prox.push(m.tabela.linhas[j])); });
          atuais = prox; if (!atuais.length) break;
        }
        const valor = iv < 0 ? 1 : l[iv];
        const chaves = new Set(atuais.map(r => chaveDe(r[ig]) ?? BRANCO));
        if (!chaves.size) chaves.add(BRANCO);
        chaves.forEach(k => { const g = grupos.get(k) || pegarGrupo(k === BRANCO ? null : JSON.parse(k)); g.porValor[vi].push(valor); });
      });
    });
    const linhas = [...grupos.values()]
      .filter(g => g.valor !== null || g.porValor.some(v => v.length))
      .sort((a, b) => (a.valor === null) - (b.valor === null) || String(a.valor).localeCompare(String(b.valor), 'pt-BR', { numeric: true }))
      .map(g => [g.valor, ...valores.map((v, i) => resumir(v.op, g.porValor[i]))]);
    // total: resume todas as linhas de cada tabela de valor (como o total de um visual)
    const total = [null, ...valores.map((v, i) => resumir(v.op, [...grupos.values()].flatMap(g => g.porValor[i])))];
    return { colunas: [grupo.coluna, ...valores.map(v => v.nome)], linhas, total, avisos };
  }

  const api = { perfilColuna, analisarRelacao, situacao, sugerirRelacoes, caminho, consultarModelo, OPERACOES, chaveDe };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.ModeloMotor = api;
})(typeof self !== 'undefined' ? self : this);
