/* =====================================================================
   ESTÚDIO · CENTRAL DE FUNÇÕES M E DAX (E5 · 13/11/2026)
   Uma janela grande, no estilo do Estúdio de medidas do Intrahora:
   abas da linguagem (M | DAX) → grupos à esquerda (clicar mostra só os dele)
   → funções → detalhe (sintaxe, para que serve, equivalente no Excel,
   exemplo, onde fica no Estúdio) e "Experimente", que calcula na hora
   com a primeira linha da consulta aberta.
   Usa do estudio.js: M, ui, exec, abrirJanela, esc, $, ferramenta, atual.
   ===================================================================== */
'use strict';

// Referência de DAX (vem do Estúdio do DashBI). As medidas DAX chegam numa próxima frente.
// [grupo, como escrever, o que faz]
const DAX_AJUDA = {
  SUM:           ['Agregação', 'SUM(dados[coluna])', 'Soma da coluna (SOMA)'],
  AVERAGE:       ['Agregação', 'AVERAGE(dados[coluna])', 'Média da coluna (MÉDIA)'],
  MIN:           ['Agregação', 'MIN(dados[coluna])', 'Menor valor (ou o menor entre 2 valores)'],
  MAX:           ['Agregação', 'MAX(dados[coluna])', 'Maior valor (ou o maior entre 2 valores)'],
  COUNT:         ['Agregação', 'COUNT(dados[coluna])', 'Conta os valores preenchidos da coluna'],
  COUNTA:        ['Agregação', 'COUNTA(dados[coluna])', 'Igual ao COUNT (conta preenchidos)'],
  COUNTBLANK:    ['Agregação', 'COUNTBLANK(dados[coluna])', 'Conta as linhas com a coluna vazia'],
  COUNTROWS:     ['Agregação', 'COUNTROWS(dados)', 'Conta as linhas (CONT.VALORES)'],
  DISTINCTCOUNT: ['Agregação', 'DISTINCTCOUNT(dados[coluna])', 'Quantos valores diferentes existem'],
  MEDIAN:        ['Agregação', 'MEDIAN(dados[coluna])', 'Mediana da coluna (MED)'],
  SUMX:          ['Linha a linha', 'SUMX(dados, expressão)', 'Faz a conta em cada linha e soma (SOMARPRODUTO)'],
  AVERAGEX:      ['Linha a linha', 'AVERAGEX(dados, expressão)', 'Faz a conta em cada linha e tira a média'],
  MINX:          ['Linha a linha', 'MINX(dados, expressão)', 'Menor resultado da conta linha a linha'],
  MAXX:          ['Linha a linha', 'MAXX(dados, expressão)', 'Maior resultado da conta linha a linha'],
  COUNTX:        ['Linha a linha', 'COUNTX(dados, expressão)', 'Conta as linhas em que a conta tem valor'],
  MEDIANX:       ['Linha a linha', 'MEDIANX(dados, expressão)', 'Mediana da conta linha a linha'],
  CALCULATE:     ['Filtro', 'CALCULATE(expressão, condição, ...)', 'Calcula só nas linhas onde TODAS as condições valem (SOMASES, CONT.SES)'],
  FILTER:        ['Filtro', 'FILTER(dados, condição)', 'As linhas que atendem à condição (use dentro de CALCULATE, COUNTROWS ou SUMX)'],
  KEEPFILTERS:   ['Filtro', 'KEEPFILTERS(condição)', 'Condição do CALCULATE (aqui funciona igual à condição normal)'],
  DIVIDE:        ['Lógica e matemática', 'DIVIDE(a, b, [se_zero])', 'Divisão que não dá erro quando b é zero ou vazio'],
  IF:            ['Lógica e matemática', 'IF(condição, se_sim, [se_não])', 'SE do Excel'],
  SWITCH:        ['Lógica e matemática', 'SWITCH(TRUE(), cond1, res1, cond2, res2, ..., senão)', 'Vários SE seguidos (SES do Excel)'],
  AND:           ['Lógica e matemática', 'AND(a, b)', 'E: verdadeiro se os dois forem (ou use &&)'],
  OR:            ['Lógica e matemática', 'OR(a, b)', 'OU: verdadeiro se um deles for (ou use ||)'],
  NOT:           ['Lógica e matemática', 'NOT(condição)', 'NÃO: inverte a condição'],
  ISBLANK:       ['Lógica e matemática', 'ISBLANK(valor)', 'Verdadeiro se estiver vazio (ÉCÉL.VAZIA)'],
  BLANK:         ['Lógica e matemática', 'BLANK()', 'Valor vazio'],
  COALESCE:      ['Lógica e matemática', 'COALESCE(a, b, ...)', 'O primeiro valor que não for vazio'],
  TRUE:          ['Lógica e matemática', 'TRUE()', 'Verdadeiro'],
  FALSE:         ['Lógica e matemática', 'FALSE()', 'Falso'],
  ABS:           ['Lógica e matemática', 'ABS(valor)', 'Valor sem sinal'],
  ROUND:         ['Lógica e matemática', 'ROUND(valor, casas)', 'Arredonda (ARRED)'],
  ROUNDUP:       ['Lógica e matemática', 'ROUNDUP(valor, casas)', 'Arredonda para cima'],
  ROUNDDOWN:     ['Lógica e matemática', 'ROUNDDOWN(valor, casas)', 'Arredonda para baixo'],
  INT:           ['Lógica e matemática', 'INT(valor)', 'Parte inteira'],
  SQRT:          ['Lógica e matemática', 'SQRT(valor)', 'Raiz quadrada'],
  POWER:         ['Lógica e matemática', 'POWER(base, expoente)', 'Potência (ou use ^)'],
  MOD:           ['Lógica e matemática', 'MOD(a, b)', 'Resto da divisão'],
  CONTAINSSTRING:['Texto', 'CONTAINSSTRING(texto, "parte")', 'Verdadeiro se o texto contém a parte (sem diferenciar maiúsculas)'],
  LEFT:          ['Texto', 'LEFT(texto, n)', 'Primeiros n caracteres (ESQUERDA)'],
  RIGHT:         ['Texto', 'RIGHT(texto, n)', 'Últimos n caracteres (DIREITA)'],
  LEN:           ['Texto', 'LEN(texto)', 'Quantidade de caracteres (NÚM.CARACT)'],
  UPPER:         ['Texto', 'UPPER(texto)', 'MAIÚSCULAS'],
  LOWER:         ['Texto', 'LOWER(texto)', 'minúsculas'],
  TRIM:          ['Texto', 'TRIM(texto)', 'Tira espaços das pontas (ARRUMAR)'],
  CONCATENATE:   ['Texto', 'CONCATENATE(a, b)', 'Junta dois textos (ou use &)'],
  YEAR:          ['Data e hora', 'YEAR(data)', 'Ano'],
  MONTH:         ['Data e hora', 'MONTH(data)', 'Mês (1 a 12)'],
  DAY:           ['Data e hora', 'DAY(data)', 'Dia do mês'],
  HOUR:          ['Data e hora', 'HOUR(hora)', 'Hora (0 a 23)'],
  MINUTE:        ['Data e hora', 'MINUTE(hora)', 'Minuto'],
  WEEKDAY:       ['Data e hora', 'WEEKDAY(data)', 'Dia da semana (1 = domingo ... 7 = sábado)'],
  DATE:          ['Data e hora', 'DATE(ano, mês, dia)', 'Monta uma data (para comparar)'],
  TIME:          ['Data e hora', 'TIME(hora, minuto, segundo)', 'Monta uma hora (para comparar)'],
  TODAY:         ['Data e hora', 'TODAY()', 'Data de hoje'],
};

// Etapas de tabela (as funções Table.* que as ferramentas escrevem)
const ETAPAS_AJUDA = [
  { nome: 'Csv.Document', sintaxe: 'Csv.Document(File.Contents("arquivo.csv"), [Delimiter=";"])', descricao: 'Lê um arquivo CSV. É a etapa Fonte de toda consulta importada.', excel: 'Dados › Obter dados › De Texto/CSV', exemplo: 'Fonte = Csv.Document(File.Contents("atendimentos.csv"), [Delimiter=";", Encoding=65001])', onde: 'Página inicial › Nova consulta', ferramenta: 'nova' },
  { nome: 'Table.PromoteHeaders', sintaxe: 'Table.PromoteHeaders(tabela, [PromoteAllScalars=true])', descricao: 'Usa a primeira linha como nome das colunas.', excel: 'Usar a primeira linha como cabeçalho', exemplo: '#"Cabeçalhos Promovidos" = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true])', onde: 'Automático na importação' },
  { nome: 'Table.TransformColumnTypes', sintaxe: 'Table.TransformColumnTypes(tabela, {{"Coluna", tipo}, ...})', descricao: 'Define o tipo de cada coluna (texto, número, data...). O que não combina vira Error na célula.', excel: 'Formatar células', exemplo: 'Table.TransformColumnTypes(Fonte, {{"CHAMADAS", Int64.Type}, {"DATA", type date}})', onde: 'Transformar › Tipo de dados (ou o menu do cabeçalho)', ferramenta: 'tipos' },
  { nome: 'Table.TransformColumns', sintaxe: 'Table.TransformColumns(tabela, {{"Coluna", função, tipo}})', descricao: 'Aplica uma função em cada valor da coluna. No Estúdio, é usada para tirar os espaços sobrando.', excel: 'ARRUMAR', exemplo: 'Table.TransformColumns(T, {{"OPERAÇÃO", each Text.Combine(List.Select(Text.Split(_, " "), each _ <> ""), " "), type text}})', onde: 'Automático na importação (Espaços Removidos)' },
  { nome: 'Table.SelectColumns', sintaxe: 'Table.SelectColumns(tabela, {"A", "B"})', descricao: 'Fica só com as colunas da lista.', excel: 'Ocultar/excluir as outras colunas', exemplo: 'Table.SelectColumns(T, {"DATA", "CHAMADAS"})', onde: 'Página inicial › Escolher colunas', ferramenta: 'escolher' },
  { nome: 'Table.RemoveColumns', sintaxe: 'Table.RemoveColumns(tabela, {"A"})', descricao: 'Tira as colunas da lista.', excel: 'Excluir coluna', exemplo: 'Table.RemoveColumns(T, {"LOGIN"})', onde: 'Página inicial › Remover colunas', ferramenta: 'remover' },
  { nome: 'Table.SelectRows', sintaxe: 'Table.SelectRows(tabela, each condição)', descricao: 'Fica só com as linhas em que a condição vale.', excel: 'Filtro / FILTRO()', exemplo: 'Table.SelectRows(T, each [OPERAÇÃO] = "SAC" and [CHAMADAS] > 40)', onde: 'Página inicial › Filtrar linhas', ferramenta: 'filtrar' },
  { nome: 'Table.RenameColumns', sintaxe: 'Table.RenameColumns(tabela, {{"antigo", "novo"}})', descricao: 'Troca o nome das colunas.', excel: 'Renomear o cabeçalho', exemplo: 'Table.RenameColumns(T, {{"TEMPO_FALADO_S", "TEMPO"}})', onde: 'Transformar › Renomear', ferramenta: 'renomear' },
  { nome: 'Table.AddColumn', sintaxe: 'Table.AddColumn(tabela, "Nova", each fórmula, tipo)', descricao: 'Cria uma coluna calculada linha a linha.', excel: 'Coluna com fórmula arrastada', exemplo: 'Table.AddColumn(T, "TMA", each [TEMPO] / [CHAMADAS], type number)', onde: 'Adicionar coluna › Coluna personalizada', ferramenta: 'adicionar' },
  { nome: 'Table.Group', sintaxe: 'Table.Group(tabela, {"Chave"}, {{"Nome", each List.Sum([Col]), tipo}})', descricao: 'Junta as linhas com a mesma chave e resume cada grupo.', excel: 'Tabela dinâmica / SOMASE', exemplo: 'Table.Group(T, {"OPERAÇÃO"}, {{"Chamadas", each List.Sum([CHAMADAS]), type number}})', onde: 'Transformar › Agrupar por', ferramenta: 'agrupar' },
  { nome: 'Table.NestedJoin', sintaxe: 'Table.NestedJoin(tabela, {"chave"}, outra, {"chave"}, "Nova", JoinKind.LeftOuter)', descricao: 'Liga cada linha às linhas da outra consulta com a mesma chave. Cria uma coluna de tabelas, aberta pelo Table.ExpandTableColumn.', excel: 'PROCV / PROCX', exemplo: 'Table.NestedJoin(T, {"MATRICULA"}, quadro, {"MATRICULA"}, "quadro", JoinKind.LeftOuter)', onde: 'Combinar › Mesclar consultas', ferramenta: 'mesclar' },
  { nome: 'Table.ExpandTableColumn', sintaxe: 'Table.ExpandTableColumn(tabela, "coluna", {"A"}, {"novo A"})', descricao: 'Abre a coluna de tabelas do Mesclar e traz as colunas escolhidas.', excel: 'Trazer as colunas do PROCV', exemplo: 'Table.ExpandTableColumn(M, "quadro", {"NOME"}, {"COLABORADOR"})', onde: '✎ na etapa Expandido' },
  { nome: 'Table.Combine', sintaxe: 'Table.Combine({tabela, outra})', descricao: 'Põe as linhas de outras consultas embaixo desta. Colunas com o mesmo nome se juntam.', excel: 'Colar uma tabela embaixo da outra / EMPILHARV', exemplo: 'Table.Combine({T, quadro})', onde: 'Combinar › Acrescentar consultas', ferramenta: 'acrescentar' },
];

// Monta o catálogo único da central
function catalogoCentral() {
  const itens = [];
  Object.entries(M.FUNCOES_M).forEach(([nome, f]) => itens.push({ ling: 'M', grupo: f.grupo, nome, sintaxe: f.sintaxe, descricao: f.descricao, excel: f.excel, exemplo: f.exemplo, testavel: true, onde: 'Fórmulas da Coluna personalizada e do Filtrar (aba Avançado)' }));
  Object.entries(M.AGREGACOES).forEach(([, a]) => { const sint = a.m('Coluna'); itens.push({ ling: 'M', grupo: 'Listas (Agrupar por)', nome: sint.replace(/\(.*/, ''), sintaxe: sint, descricao: `${a.rotulo} de cada grupo.`, excel: a.excel, exemplo: `{"${a.rotulo}", each ${sint}, type number}`, onde: 'Transformar › Agrupar por', ferramenta: 'agrupar' }); });
  ETAPAS_AJUDA.forEach(e => itens.push({ ling: 'M', grupo: 'Etapas de tabela', ...e }));
  Object.entries(DAX_AJUDA).forEach(([nome, [grupo, sintaxe, descricao]]) => {
    const m = /\(([^()]+)\)\s*$/.exec(descricao); // "(SOMA)" no fim da descrição = equivalente no Excel
    itens.push({ ling: 'DAX', grupo, nome, sintaxe, descricao: m && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ.\s,]+$/.test(m[1]) ? descricao.replace(/\s*\([^()]+\)\s*$/, '') : descricao, excel: m && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ.\s,]+$/.test(m[1]) ? m[1] : '', exemplo: '', onde: 'Medidas DAX (chegam numa próxima frente)' });
  });
  return itens;
}

// Janela da central. "foco" = nome de uma função para abrir já selecionada.
function janelaCentral(foco) {
  const itens = catalogoCentral();
  const est = { ling: 'M', grupo: null, sel: foco || null, busca: '' };
  if (foco) { const f = itens.find(x => x.nome === foco); if (f) { est.ling = f.ling; est.grupo = f.grupo; } }
  const c = typeof atual === 'function' ? atual() : null;
  const tab = c ? exec(c).tabela : null;
  abrirJanela({
    titulo: 'Central de funções M e DAX', largo: true, semOk: true, cheia: true,
    corpo: `<div class="central">
      <div class="central-topo">
        <div class="abas" role="tablist" id="cf-ling"><button type="button" data-ling="M">Linguagem M (Transformar dados)</button><button type="button" data-ling="DAX">DAX (Medidas)</button></div>
        <input type="search" id="cf-busca" placeholder="Procurar função ou o que ela faz (ex.: arredondar, maiúscula, PROCV)" aria-label="Procurar função">
      </div>
      <div class="central-corpo">
        <nav class="central-grupos" id="cf-grupos" aria-label="Grupos"></nav>
        <div class="central-lista" id="cf-lista" role="listbox" aria-label="Funções"></div>
        <article class="central-detalhe" id="cf-detalhe"></article>
      </div></div>`,
    aoAbrir() {
      const desenhar = () => {
        $('cf-ling').querySelectorAll('[data-ling]').forEach(b => b.classList.toggle('on', b.dataset.ling === est.ling));
        const q = est.busca.trim().toLowerCase();
        const daLing = itens.filter(x => x.ling === est.ling);
        const grupos = [...new Set(daLing.map(x => x.grupo))];
        if (!est.grupo || !grupos.includes(est.grupo)) est.grupo = grupos[0];
        // com busca, a lista mostra todos os grupos que têm resultado
        const visiveis = q ? daLing.filter(x => [x.nome, x.descricao, x.excel, x.grupo].join(' ').toLowerCase().includes(q)) : daLing.filter(x => x.grupo === est.grupo);
        $('cf-grupos').innerHTML = grupos.map(g => { const n = q ? visiveis.filter(x => x.grupo === g).length : daLing.filter(x => x.grupo === g).length; return `<button type="button" class="${!q && g === est.grupo ? 'on' : ''}${q && !n ? ' apagado' : ''}" data-grupo="${esc(g)}">${esc(g)}<small>${n}</small></button>`; }).join('');
        if (!visiveis.some(x => x.nome === est.sel)) est.sel = visiveis[0] ? visiveis[0].nome : null;
        $('cf-lista').innerHTML = visiveis.length ? visiveis.map(x => `<button type="button" role="option" class="${x.nome === est.sel ? 'on' : ''}" data-funcao="${esc(x.nome)}"><b>${esc(x.nome)}</b><span>${esc(x.descricao)}</span>${q ? `<small>${esc(x.grupo)}</small>` : ''}</button>`).join('') : '<p class="ajuda" style="padding:12px">Nada encontrado. Tente outra palavra (ex.: "texto", "data", "somar").</p>';
        desenharDetalhe(visiveis.find(x => x.nome === est.sel));
      };
      const desenharDetalhe = f => {
        if (!f) { $('cf-detalhe').innerHTML = ''; return; }
        const exemploExpr = f.testavel ? f.exemplo.split('→')[0].trim() : '';
        $('cf-detalhe').innerHTML = `
          <span class="eyebrow-cf">${esc(f.ling)} · ${esc(f.grupo)}</span>
          <h3>${esc(f.nome)}</h3>
          <p>${esc(f.descricao)}</p>
          <div class="cf-bloco"><span class="rotulo">Como escrever</span><code>${esc(f.sintaxe)}</code></div>
          ${f.excel ? `<div class="cf-bloco"><span class="rotulo">No Excel</span><span>${esc(f.excel)}</span></div>` : ''}
          ${f.exemplo ? `<div class="cf-bloco"><span class="rotulo">Exemplo</span><code>${esc(f.exemplo)}</code></div>` : ''}
          <div class="cf-bloco"><span class="rotulo">Onde fica no Estúdio</span><span>${esc(f.onde || '—')}</span>${f.ferramenta ? ` <button class="btn peq prim" type="button" data-usar="${esc(f.ferramenta)}">Abrir agora</button>` : ''}</div>
          ${f.testavel ? `<div class="cf-bloco cf-teste"><span class="rotulo">Experimente</span>
            <p class="ajuda">${tab ? `Calcula com a <b>primeira linha</b> da consulta <b>${esc(c.nome)}</b>. Clique numa coluna para inserir.` : 'Abra uma consulta para usar as colunas dela; números e textos funcionam assim mesmo.'}</p>
            ${tab ? `<div class="cf-colunas">${tab.colunas.filter(x => x.tipo !== 'tabela').map(x => `<button type="button" data-inserir-col="[${esc(x.nome)}]">${esc(x.nome)}</button>`).join('')}</div>` : ''}
            <textarea id="cf-expr" spellcheck="false">${esc(exemploExpr)}</textarea>
            <div class="resultado" id="cf-res">—</div></div>` : ''}
          ${f.ling === 'DAX' ? '<p class="ajuda">As medidas em DAX chegam numa próxima frente do Estúdio e vão usar o modelo de relacionamentos. Esta é a referência das funções que estarão disponíveis.</p>' : ''}`;
        if (f.testavel) { testar(); $('cf-expr').addEventListener('input', testar); }
      };
      const testar = () => {
        const expr = $('cf-expr').value.trim();
        if (!expr) { $('cf-res').className = 'resultado'; $('cf-res').textContent = 'Escreva uma fórmula.'; return; }
        try {
          const arvore = M.analisar(expr.replace(/^each\s+/, ''));
          const linha = tab && tab.linhas[0] ? Object.fromEntries(tab.colunas.map((x, k) => [x.nome, tab.linhas[0][k]])) : {};
          const v = M.avaliar(arvore, linha);
          if (M.ehErro(v)) throw new Error(v.mensagem);
          const tipo = v === null ? 'null' : typeof v === 'number' ? 'Número' : typeof v === 'boolean' ? 'Verdadeiro/Falso' : /^\d{4}-\d{2}-\d{2}$/.test(v) ? 'Data' : 'Texto';
          $('cf-res').className = 'resultado ok';
          $('cf-res').innerHTML = `Resultado: <b>${esc(M.formatar(v, tipo === 'Data' ? 'data' : 'texto'))}</b> <small class="mono">(${tipo})</small>`;
        } catch (e) { $('cf-res').className = 'resultado ruim'; $('cf-res').textContent = e.message.replace(/^Expression\./, ''); }
      };
      const caixa = $('modal-corpo');
      caixa.addEventListener('click', ev => {
        const l = ev.target.closest('[data-ling]'); if (l) { est.ling = l.dataset.ling; est.grupo = null; est.sel = null; return desenhar(); }
        const g = ev.target.closest('[data-grupo]'); if (g) { est.grupo = g.dataset.grupo; est.busca = ''; $('cf-busca').value = ''; est.sel = null; return desenhar(); }
        const f = ev.target.closest('[data-funcao]'); if (f) { est.sel = f.dataset.funcao; caixa.querySelectorAll('[data-funcao]').forEach(b => b.classList.toggle('on', b === f)); return desenharDetalhe(itens.find(x => x.nome === est.sel && x.ling === est.ling)); }
        const ic = ev.target.closest('[data-inserir-col]'); if (ic) { const t = $('cf-expr'); const a = t.selectionStart; t.value = t.value.slice(0, a) + ic.dataset.inserirCol + t.value.slice(t.selectionEnd); t.focus(); return testar(); }
        const u = ev.target.closest('[data-usar]'); if (u) { fecharJanela(); return ferramenta(u.dataset.usar); }
      });
      $('cf-busca').addEventListener('input', ev => { est.busca = ev.target.value; desenhar(); });
      desenhar();
      $('cf-busca').focus();
    },
  });
}
