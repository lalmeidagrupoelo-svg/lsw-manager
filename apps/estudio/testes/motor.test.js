/* Testes do motor M. Rodar:  node apps/estudio/testes/motor.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const M = require('../js/m-motor.js');

let ok = 0;
const teste = (nome, fn) => { fn(); ok++; console.log('  ✓', nome); };
const csv = fs.readFileSync(path.join(__dirname, '../dados-demo/atendimentos.csv'), 'utf8');

console.log('Motor M');

teste('importar CSV cria Fonte, Cabeçalhos Promovidos, Tipo Alterado e Espaços Removidos', () => {
  const c = M.consultaDeCsv('atendimentos', 'atendimentos.csv', csv);
  assert.deepStrictEqual(c.etapas.map(e => e.nome), ['Fonte', 'Cabeçalhos Promovidos', 'Tipo Alterado', 'Espaços Removidos']);
  const { tabela } = M.executar(c);
  assert.deepStrictEqual(tabela.colunas.map(x => x.nome), ['DATA', 'MATRICULA', 'OPERAÇÃO', 'CANAL', 'CHAMADAS', 'TEMPO_FALADO_S', 'LOGIN']);
  const tipo = n => tabela.colunas.find(x => x.nome === n).tipo;
  assert.strictEqual(tipo('DATA'), 'data');
  assert.strictEqual(tipo('MATRICULA'), 'inteiro');
  assert.strictEqual(tipo('CHAMADAS'), 'texto', 'tem "n/d", então fica texto');
  assert.strictEqual(tipo('LOGIN'), 'hora');
  const op = tabela.colunas.findIndex(x => x.nome === 'OPERAÇÃO');
  assert.deepStrictEqual([...new Set(tabela.linhas.map(l => l[op]))].sort(), ['COBRANÇA', 'SAC', 'SUPORTE TÉCNICO', 'VENDAS'], 'espaços sobrando saem na importação');
  assert.strictEqual(M.converter('  a   b  ', 'texto'), '  a   b  ');
  const t2 = M.ETAPAS.limparEspacos.executar({ colunas: [{ nome: 'X', tipo: 'texto' }], linhas: [['  a   b  '], [null]] }, { colunas: ['X'] });
  assert.deepStrictEqual(t2.linhas, [['a b'], [null]]);
});

teste('trocar CHAMADAS para inteiro gera Error só nas células "n/d"', () => {
  const c = M.consultaDeCsv('a', 'atendimentos.csv', csv);
  M.inserirEtapa(c, { tipo: 'tipos', lista: [['CHAMADAS', 'inteiro']] });
  assert.strictEqual(c.etapas[4].nome, 'Tipo Alterado1');
  const { tabela } = M.executar(c);
  const i = tabela.colunas.findIndex(x => x.nome === 'CHAMADAS');
  const q = M.qualidade(tabela, i);
  assert.ok(q.erros > 0 && q.validos > q.erros);
});

teste('filtro, remover colunas, renomear e coluna personalizada', () => {
  const c = M.consultaDeCsv('a', 'atendimentos.csv', csv);
  M.inserirEtapa(c, { tipo: 'filtrar', expr: M.exprCondicao('OPERAÇÃO', 'igual', 'SAC', 'texto') });
  M.inserirEtapa(c, { tipo: 'remover', colunas: ['LOGIN'] });
  M.inserirEtapa(c, { tipo: 'renomear', pares: [['TEMPO_FALADO_S', 'TEMPO']] });
  M.inserirEtapa(c, { tipo: 'tipos', lista: [['CHAMADAS', 'inteiro']] });
  M.inserirEtapa(c, { tipo: 'adicionar', coluna: 'TMA', expr: 'if [CHAMADAS] = null or [CHAMADAS] = 0 then null else Number.Round([TEMPO] / [CHAMADAS], 1)', tipoColuna: 'decimal' });
  const { tabela, erro } = M.executar(c);
  assert.strictEqual(erro, null);
  assert.ok(tabela.linhas.length > 0);
  const op = tabela.colunas.findIndex(x => x.nome === 'OPERAÇÃO');
  assert.ok(tabela.linhas.every(l => l[op] === 'SAC'));
  assert.ok(!tabela.colunas.some(x => x.nome === 'LOGIN'));
  const tma = tabela.colunas.findIndex(x => x.nome === 'TMA');
  const valores = tabela.linhas.map(l => l[tma]).filter(v => typeof v === 'number');
  assert.ok(valores.every(v => v > 200 && v < 360), 'TMA do SAC fica perto de 280 s');
});

teste('código M gerado tem let/in e os nomes com #"..."', () => {
  const c = M.consultaDeCsv('a', 'atendimentos.csv', csv);
  M.inserirEtapa(c, { tipo: 'filtrar', expr: '[CANAL] = "VOZ"' });
  const m = M.gerarM(c);
  assert.ok(m.startsWith('let\n    Fonte = Csv.Document(File.Contents("atendimentos.csv"), [Delimiter=";", Encoding=65001]),'));
  assert.ok(m.includes('#"Cabeçalhos Promovidos" = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true])'));
  assert.ok(m.includes('#"Linhas Filtradas" = Table.SelectRows(#"Espaços Removidos", each [CANAL] = "VOZ")'));
  assert.ok(m.trim().endsWith('in\n    #"Linhas Filtradas"'));
});

teste('excluir uma etapa do meio faz a seguinte falhar com mensagem clara', () => {
  const c = M.consultaDeCsv('a', 'atendimentos.csv', csv);
  M.inserirEtapa(c, { tipo: 'renomear', pares: [['TEMPO_FALADO_S', 'TEMPO']] });
  M.inserirEtapa(c, { tipo: 'adicionar', coluna: 'MIN', expr: '[TEMPO] / 60', tipoColuna: 'decimal' });
  c.etapas.splice(4, 1); // apaga a renomeação
  const { erro } = M.executar(c);
  assert.strictEqual(erro.etapa, 'Personalização Adicionada');
  assert.ok(/coluna "TEMPO".*não foi encontrada/.test(erro.mensagem));
});

teste('expressões: precedência, texto, datas e erros por célula', () => {
  const linha = { A: 2, B: 3, T: 'sac', D: '2026-11-03', N: null };
  const v = e => M.avaliar(M.analisar(e), linha);
  assert.strictEqual(v('[A] + [B] * 2'), 8);
  assert.strictEqual(v('([A] + [B]) * 2'), 10);
  assert.strictEqual(v('Text.Upper([T]) & "!"'), 'SAC!');
  assert.strictEqual(v('[D] >= #date(2026, 11, 1) and Date.DayOfWeek([D]) = 2'), true);
  assert.strictEqual(v('if [A] > 1 then "alto" else "baixo"'), 'alto');
  assert.strictEqual(v('[N] + 1'), null);
  assert.ok(M.ehErro(v('[T] + 1')), 'texto + número vira Error na célula');
  assert.ok(M.ehErro(v('[A] & "x"')), '& com número pede Text.From');
  assert.strictEqual(v('Text.From([A]) & " chamadas"'), '2 chamadas');
  assert.throws(() => M.analisar('[A] +'), /SyntaxError/);
  assert.throws(() => M.analisar('Funcao.Inventada(1)'), /não existe/);
});

teste('conversões no padrão brasileiro', () => {
  assert.strictEqual(M.converter('1.234,5', 'decimal'), 1234.5);
  assert.strictEqual(M.converter('287,5', 'decimal'), 287.5);
  assert.strictEqual(M.converter('03/11/2026', 'data'), '2026-11-03');
  assert.ok(M.ehErro(M.converter('31/02/2026', 'data')));
  assert.strictEqual(M.converter('', 'inteiro'), null);
  assert.strictEqual(M.formatar('2026-11-03', 'data'), '03/11/2026');
});

teste('E2: ler o M gerado devolve as mesmas etapas (ida e volta)', () => {
  const c = M.consultaDeCsv('a', 'atendimentos.csv', csv);
  M.inserirEtapa(c, { tipo: 'tipos', lista: [['CHAMADAS', 'inteiro']] });
  M.inserirEtapa(c, { tipo: 'filtrar', expr: '([OPERAÇÃO] <> "SAC" and [CANAL] = "VOZ") or [LOGIN] < #time(7, 0, 0)' });
  M.inserirEtapa(c, { tipo: 'renomear', pares: [['TEMPO_FALADO_S', 'TEMPO']] });
  M.inserirEtapa(c, { tipo: 'remover', colunas: ['LOGIN'] });
  M.inserirEtapa(c, { tipo: 'adicionar', coluna: 'TMA', expr: 'Number.Round([TEMPO] / [CHAMADAS], 1)', tipoColuna: 'decimal' });
  const texto = M.gerarM(c);
  const etapas = M.lerM(texto, c);
  const limpar = l => l.map(({ id, ...r }) => r);
  assert.deepStrictEqual(limpar(etapas), limpar(c.etapas));
  assert.strictEqual(M.gerarM({ ...c, etapas }), texto);
});

teste('E2: código editado à mão vira etapas novas, com comentários e alias de tipo', () => {
  const c = M.consultaDeCsv('a', 'atendimentos.csv', csv);
  const texto = `let
    // lê o arquivo
    Fonte = Csv.Document(File.Contents("atendimentos.csv"), [Delimiter=";", Encoding=65001]),
    #"Cabeçalhos Promovidos" = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true]),
    Tipos = Table.TransformColumnTypes(#"Cabeçalhos Promovidos", {{"DATA", type date}, {"TEMPO_FALADO_S", Number.Type}}),
    SoChat = Table.SelectRows(Tipos, each [CANAL] = "CHAT"),
    Renomeada = Table.RenameColumns(SoChat, {"TEMPO_FALADO_S", "TEMPO"})
in
    Renomeada`;
  const etapas = M.lerM(texto, c);
  assert.deepStrictEqual(etapas.map(e => e.tipo), ['fonte', 'promover', 'tipos', 'filtrar', 'renomear']);
  assert.deepStrictEqual(etapas[4].pares, [['TEMPO_FALADO_S', 'TEMPO']]);
  const { tabela, erro } = M.executar({ ...c, etapas });
  assert.strictEqual(erro, null);
  assert.ok(tabela.linhas.length > 0 && tabela.colunas.some(x => x.nome === 'TEMPO'));
});

teste('E2: erros de M explicam o que corrigir', () => {
  const c = M.consultaDeCsv('a', 'atendimentos.csv', csv);
  const base = 'let\n Fonte = Csv.Document(File.Contents("atendimentos.csv"), [Delimiter=";"]),\n P = Table.PromoteHeaders(Fonte)';
  assert.throws(() => M.lerM(base + ',\n F = Table.Pivot(P, {"A"}, "A", "B")\nin\n F', c), /Table.Pivot ainda não está no Estúdio/);
  assert.throws(() => M.lerM(base + ',\n F = Table.SelectRows(Fonte, each [A] = 1)\nin\n F', c), /etapa logo acima.*deveria ser P/);
  assert.throws(() => M.lerM(base + '\nin\n Fonte', c), /depois do "in" vai o nome da última etapa: P/);
  assert.throws(() => M.lerM(base + ',\n F = Table.SelectRows(P, [A] = 1)\nin\n F', c), /começar com "each"/);
  assert.throws(() => M.lerM(base.replace('atendimentos.csv', 'outro.csv') + '\nin\n P', c), /não está carregado/);
});

teste('E2: barra de fórmula troca uma etapa', () => {
  const c = M.consultaDeCsv('a', 'atendimentos.csv', csv);
  M.inserirEtapa(c, { tipo: 'filtrar', expr: '[CANAL] = "VOZ"' });
  const dados = M.lerLinhaEtapa('= Table.SelectRows(#"Espaços Removidos", each [CANAL] = "CHAT")', c, 4);
  assert.deepStrictEqual(dados, { tipo: 'filtrar', expr: '[CANAL] = "CHAT"' });
});

teste('filtro: um conector por nível e grupos viram parênteses (ida e volta)', () => {
  const tipos = { OPERAÇÃO: 'texto', CANAL: 'texto', DATA: 'data' };
  const filtro = { junta: 'and', itens: [
    { coluna: 'OPERAÇÃO', operador: 'igual', valor: 'COBRANÇA' },
    { grupo: true, junta: 'or', conds: [{ coluna: 'CANAL', operador: 'igual', valor: 'CHAT' }, { coluna: 'DATA', operador: 'igual', valor: '04/11/2026' }] },
  ] };
  const expr = M.montarFiltro(filtro, tipos);
  assert.strictEqual(expr, '[OPERAÇÃO] = "COBRANÇA" and ([CANAL] = "CHAT" or [DATA] = #date(2026, 11, 4))');
  assert.deepStrictEqual(M.lerFiltro(expr), filtro);
  assert.strictEqual(M.lerFiltroEmPortugues(filtro), 'OPERAÇÃO é igual a "COBRANÇA" E ( CANAL é igual a "CHAT" OU DATA é igual a "04/11/2026" )');
  const c = M.consultaDeCsv('a', 'atendimentos.csv', csv);
  M.inserirEtapa(c, { tipo: 'filtrar', expr });
  assert.strictEqual(M.executar(c).tabela.linhas.length, 15, 'só Cobrança, do chat ou do dia 04/11');
  assert.deepStrictEqual(M.lerFiltro('([OPERAÇÃO] = "COBRANÇA" and [CANAL] = "CHAT") or [DATA] = #date(2026, 11, 4)'), { junta: 'or', itens: [
    { grupo: true, junta: 'and', conds: [{ coluna: 'OPERAÇÃO', operador: 'igual', valor: 'COBRANÇA' }, { coluna: 'CANAL', operador: 'igual', valor: 'CHAT' }] },
    { coluna: 'DATA', operador: 'igual', valor: '04/11/2026' },
  ] }, 'o filtro antigo (A e B) ou C volta como grupo');
  const nv = { junta: 'or', itens: [{ coluna: 'CANAL', operador: 'naoVazio', valor: '' }, { coluna: 'OPERAÇÃO', operador: 'igual', valor: 'SAC' }] };
  assert.deepStrictEqual(M.lerFiltro(M.montarFiltro(nv, tipos)), nv);
  assert.strictEqual(M.lerFiltro('[A] = 1 and ([B] = 2 or ([C] = 3 and [D] = 4))'), null, 'grupo dentro de grupo fica no Avançado');
});

teste('E3: mesclar com quadro pela matrícula e expandir nome e supervisor', () => {
  const quadro = M.consultaDeCsv('quadro', 'quadro.csv', fs.readFileSync(path.join(__dirname, '../dados-demo/quadro.csv'), 'utf8'));
  const c = M.consultaDeCsv('atendimentos', 'atendimentos.csv', csv);
  const todas = [c, quadro];
  M.inserirEtapa(c, { tipo: 'mesclar', chaves: ['MATRICULA'], consulta: 'quadro', chavesOutra: ['MATRICULA'], coluna: 'quadro', juncao: 'LeftOuter' });
  M.inserirEtapa(c, { tipo: 'expandir', nomeBase: 'quadro Expandido', coluna: 'quadro', colunas: ['NOME', 'SUPERVISOR'], novos: ['quadro.NOME', 'quadro.SUPERVISOR'] });
  assert.strictEqual(c.etapas[c.etapas.length - 1].nome, 'quadro Expandido');
  const { tabela, erro } = M.executar(c, undefined, todas);
  assert.strictEqual(erro, null);
  assert.strictEqual(tabela.linhas.length, 348, 'cada atendimento acha uma pessoa: nenhuma linha some nem repete');
  const n = tabela.colunas.findIndex(x => x.nome === 'quadro.NOME');
  assert.ok(tabela.linhas.every(l => typeof l[n] === 'string' && l[n].length > 3));
  const m = M.gerarM(c);
  assert.ok(m.includes('Table.NestedJoin(#"Espaços Removidos", {"MATRICULA"}, quadro, {"MATRICULA"}, "quadro", JoinKind.LeftOuter)'));
  assert.ok(m.includes('#"quadro Expandido" = Table.ExpandTableColumn(#"Consultas Mescladas", "quadro", {"NOME", "SUPERVISOR"}, {"quadro.NOME", "quadro.SUPERVISOR"})'));
  assert.strictEqual(M.gerarM({ ...c, etapas: M.lerM(m, c) }), m, 'ida e volta do M');
  // anti esquerda: quem do quadro não tem atendimento (supervisores)
  const q2 = JSON.parse(JSON.stringify(quadro));
  M.inserirEtapa(q2, { tipo: 'mesclar', chaves: ['MATRICULA'], consulta: 'atendimentos', chavesOutra: ['MATRICULA'], coluna: 'at', juncao: 'LeftAnti' });
  const atSimples = M.consultaDeCsv('atendimentos', 'atendimentos.csv', csv); // sem mesclar, senão vira ciclo
  const anti = M.executar(q2, undefined, [atSimples, q2]).tabela;
  const cargo = anti.colunas.findIndex(x => x.nome === 'CARGO');
  assert.ok(anti.linhas.length >= 4 && anti.linhas.every(l => l[cargo] === 'SUPERVISOR'));
});

teste('E3: agrupar por operação e acrescentar', () => {
  const c = M.consultaDeCsv('atendimentos', 'atendimentos.csv', csv);
  M.inserirEtapa(c, { tipo: 'tipos', lista: [['CHAMADAS', 'inteiro']] });
  M.inserirEtapa(c, { tipo: 'agrupar', chaves: ['OPERAÇÃO'], agregacoes: [
    { nome: 'TEMPO', op: 'soma', coluna: 'TEMPO_FALADO_S', tipo: 'decimal' },
    { nome: 'Linhas', op: 'contar', coluna: null, tipo: 'inteiro' },
    { nome: 'Pessoas', op: 'distintos', coluna: 'MATRICULA', tipo: 'inteiro' },
  ] });
  const t = M.executar(c).tabela;
  assert.deepStrictEqual(t.colunas.map(x => x.nome), ['OPERAÇÃO', 'TEMPO', 'Linhas', 'Pessoas']);
  assert.strictEqual(t.linhas.length, 4);
  assert.strictEqual(t.linhas.reduce((s, l) => s + l[2], 0), 348);
  assert.ok(t.linhas.every(l => l[3] === 15), '15 operadores por operação');
  const m = M.gerarM(c);
  assert.ok(m.includes('{"Linhas", each Table.RowCount(_), Int64.Type}') && m.includes('{"Pessoas", each List.Count(List.Distinct([MATRICULA])), Int64.Type}'));
  assert.strictEqual(M.gerarM({ ...c, etapas: M.lerM(m, c) }), m);
  // acrescentar a mesma base duas vezes dobra as linhas; colunas que faltam ficam null
  const a = M.consultaDeCsv('a', 'atendimentos.csv', csv);
  const q = M.consultaDeCsv('quadro', 'quadro.csv', fs.readFileSync(path.join(__dirname, '../dados-demo/quadro.csv'), 'utf8'));
  M.inserirEtapa(a, { tipo: 'acrescentar', consultas: ['quadro'] });
  const r = M.executar(a, undefined, [a, q]).tabela;
  assert.strictEqual(r.linhas.length, 348 + 64);
  assert.ok(r.colunas.some(x => x.nome === 'NOME') && r.colunas.some(x => x.nome === 'CHAMADAS'));
});

teste('E3: consulta que não existe e referência circular', () => {
  const a = M.consultaDeCsv('a', 'atendimentos.csv', csv);
  const b = M.consultaDeCsv('b', 'atendimentos.csv', csv);
  M.inserirEtapa(a, { tipo: 'acrescentar', consultas: ['b'] });
  M.inserirEtapa(b, { tipo: 'acrescentar', consultas: ['a'] });
  assert.ok(/referência circular: a → b → a/.test(M.executar(a, undefined, [a, b]).erro.mensagem));
  assert.ok(/a consulta "b" não existe/.test(M.executar(a, undefined, [a]).erro.mensagem));
});

console.log(`\n${ok} testes passaram.`);
