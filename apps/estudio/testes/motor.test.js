/* Testes do motor M. Rodar:  node apps/estudio/testes/motor.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const M = require('../js/m-motor.js');

let ok = 0;
const teste = (nome, fn) => { fn(); ok++; console.log('  ✓', nome); };
const csv = fs.readFileSync(path.join(__dirname, '../dados-demo/atendimentos.csv'), 'utf8');

console.log('Motor M');

teste('importar CSV cria Fonte, Cabeçalhos Promovidos e Tipo Alterado', () => {
  const c = M.consultaDeCsv('atendimentos', 'atendimentos.csv', csv);
  assert.deepStrictEqual(c.etapas.map(e => e.nome), ['Fonte', 'Cabeçalhos Promovidos', 'Tipo Alterado']);
  const { tabela } = M.executar(c);
  assert.deepStrictEqual(tabela.colunas.map(x => x.nome), ['DATA', 'MATRICULA', 'OPERAÇÃO', 'CANAL', 'CHAMADAS', 'TEMPO_FALADO_S', 'LOGIN']);
  const tipo = n => tabela.colunas.find(x => x.nome === n).tipo;
  assert.strictEqual(tipo('DATA'), 'data');
  assert.strictEqual(tipo('MATRICULA'), 'inteiro');
  assert.strictEqual(tipo('CHAMADAS'), 'texto', 'tem "n/d", então fica texto');
  assert.strictEqual(tipo('LOGIN'), 'hora');
});

teste('trocar CHAMADAS para inteiro gera Error só nas células "n/d"', () => {
  const c = M.consultaDeCsv('a', 'atendimentos.csv', csv);
  M.inserirEtapa(c, { tipo: 'tipos', lista: [['CHAMADAS', 'inteiro']] });
  assert.strictEqual(c.etapas[3].nome, 'Tipo Alterado1');
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
  assert.ok(m.includes('#"Linhas Filtradas" = Table.SelectRows(#"Tipo Alterado", each [CANAL] = "VOZ")'));
  assert.ok(m.trim().endsWith('in\n    #"Linhas Filtradas"'));
});

teste('excluir uma etapa do meio faz a seguinte falhar com mensagem clara', () => {
  const c = M.consultaDeCsv('a', 'atendimentos.csv', csv);
  M.inserirEtapa(c, { tipo: 'renomear', pares: [['TEMPO_FALADO_S', 'TEMPO']] });
  M.inserirEtapa(c, { tipo: 'adicionar', coluna: 'MIN', expr: '[TEMPO] / 60', tipoColuna: 'decimal' });
  c.etapas.splice(3, 1); // apaga a renomeação
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

console.log(`\n${ok} testes passaram.`);
