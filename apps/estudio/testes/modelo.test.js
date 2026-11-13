/* Testes do motor do modelo (E4). Rodar:  node apps/estudio/testes/modelo.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const M = require('../js/m-motor.js');
const Mod = require('../js/modelo-motor.js');

let ok = 0;
const teste = (nome, fn) => { fn(); ok++; console.log('  ✓', nome); };
const ler = n => fs.readFileSync(path.join(__dirname, '../dados-demo', n), 'utf8');
const at = M.executar(M.consultaDeCsv('atendimentos', 'atendimentos.csv', ler('atendimentos.csv'))).tabela;
const qd = M.executar(M.consultaDeCsv('quadro', 'quadro.csv', ler('quadro.csv'))).tabela;
const tabelas = { atendimentos: at, quadro: qd };
const rel = { id: 'r1', de: { consulta: 'atendimentos', coluna: 'MATRICULA' }, para: { consulta: 'quadro', coluna: 'MATRICULA' }, cardinalidade: 'N:1', direcao: 'unica', ativo: true };

console.log('Motor do modelo');

teste('analisar: atendimentos[MATRICULA] * — 1 quadro[MATRICULA]', () => {
  const a = Mod.analisarRelacao(at, 'MATRICULA', qd, 'MATRICULA');
  assert.strictEqual(a.cardinalidade, 'N:1');
  assert.strictEqual(a.correspondencia, 1);
  assert.strictEqual(a.linhasSemPar, 0);
  assert.strictEqual(a.distintosA, 60, '60 operadores com atendimento');
  const inv = Mod.analisarRelacao(qd, 'MATRICULA', at, 'MATRICULA');
  assert.strictEqual(inv.cardinalidade, '1:N', 'lados trocados são detectados');
  assert.ok(inv.correspondencia < 1, 'supervisores do quadro não têm atendimento');
  const nn = Mod.analisarRelacao(at, 'OPERAÇÃO', qd, 'OPERAÇÃO');
  assert.strictEqual(nn.cardinalidade, 'N:N');
  const tipos = Mod.analisarRelacao(at, 'MATRICULA', qd, 'NOME');
  assert.ok(tipos.tiposDiferentes && tipos.achados === 0);
});

teste('sugerir: acha a matrícula e põe o lado 1 no quadro', () => {
  const s = Mod.sugerirRelacoes(tabelas);
  assert.strictEqual(s.length, 1);
  assert.deepStrictEqual([s[0].de, s[0].para], [{ consulta: 'atendimentos', coluna: 'MATRICULA' }, { consulta: 'quadro', coluna: 'MATRICULA' }]);
  assert.strictEqual(Mod.sugerirRelacoes(tabelas, [rel]).length, 0, 'não sugere de novo o que já existe');
});

teste('situação: relação quebrada quando a coluna some', () => {
  assert.strictEqual(Mod.situacao(rel, tabelas).estado, 'ok');
  const semCol = { ...tabelas, quadro: { colunas: qd.colunas.filter(c => c.nome !== 'MATRICULA'), linhas: [] } };
  assert.ok(/não existe mais em "quadro"/.test(Mod.situacao(rel, semCol).motivo));
  assert.ok(/não existe mais/.test(Mod.situacao(rel, { atendimentos: at }).motivo));
});

teste('consultar: soma de atendimentos por supervisor do quadro (o filtro passa pela relação)', () => {
  const r = Mod.consultarModelo(tabelas, [rel], { grupo: { consulta: 'quadro', coluna: 'SUPERVISOR' }, valores: [
    { consulta: 'atendimentos', coluna: 'TEMPO_FALADO_S', op: 'soma', nome: 'Tempo' },
    { consulta: 'atendimentos', coluna: null, op: 'contar', nome: 'Atendimentos' },
    { consulta: 'quadro', coluna: 'MATRICULA', op: 'distintos', nome: 'Pessoas' },
  ] });
  assert.deepStrictEqual(r.avisos, []);
  const comSup = r.linhas.filter(l => l[0] !== '');
  assert.strictEqual(r.total[2], 348, 'todos os atendimentos entram no total');
  // os 4 supervisores somam todos os atendimentos (o supervisor não tem supervisor: fica no grupo vazio, sem atendimentos)
  assert.strictEqual(comSup.filter(l => l[0]).reduce((s, l) => s + l[2], 0), 348);
  const joao = r.linhas.find(l => l[0] === 'JOÃO ALMEIDA');
  assert.ok(joao, 'mesmo supervisor do teste do Agrupar');
  // confere com o Agrupar da E3: mesclar + agrupar dá o mesmo número
  const c = M.consultaDeCsv('atendimentos', 'atendimentos.csv', ler('atendimentos.csv'));
  const q = M.consultaDeCsv('quadro', 'quadro.csv', ler('quadro.csv'));
  M.inserirEtapa(c, { tipo: 'mesclar', chaves: ['MATRICULA'], consulta: 'quadro', chavesOutra: ['MATRICULA'], coluna: 'q', juncao: 'LeftOuter' });
  M.inserirEtapa(c, { tipo: 'expandir', coluna: 'q', colunas: ['SUPERVISOR'], novos: ['SUP'] });
  M.inserirEtapa(c, { tipo: 'agrupar', chaves: ['SUP'], agregacoes: [{ nome: 'T', op: 'soma', coluna: 'TEMPO_FALADO_S', tipo: 'decimal' }] });
  const viaM = M.executar(c, undefined, [c, q]).tabela.linhas.find(l => l[0] === 'JOÃO ALMEIDA');
  assert.strictEqual(joao[1], viaM[1]);
});

teste('consultar: sem relação ativa avisa; relação inativa não filtra', () => {
  const r = Mod.consultarModelo(tabelas, [], { grupo: { consulta: 'quadro', coluna: 'SUPERVISOR' }, valores: [{ consulta: 'atendimentos', coluna: 'CHAMADAS', op: 'contar', nome: 'N' }] });
  assert.ok(/não há caminho de relacionamento ativo/.test(r.avisos[0]));
  const r2 = Mod.consultarModelo(tabelas, [{ ...rel, ativo: false }], { grupo: { consulta: 'quadro', coluna: 'SUPERVISOR' }, valores: [{ consulta: 'atendimentos', coluna: null, op: 'contar', nome: 'N' }] });
  assert.strictEqual(r2.avisos.length, 1);
});

teste('consultar: agrupar pelo lado muitos e resumir o lado um só com direção "ambas"', () => {
  const pedido = { grupo: { consulta: 'atendimentos', coluna: 'CANAL' }, valores: [{ consulta: 'quadro', coluna: 'MATRICULA', op: 'distintos', nome: 'Pessoas' }] };
  assert.strictEqual(Mod.consultarModelo(tabelas, [rel], pedido).avisos.length, 1, 'direção única: o filtro não volta');
  const r = Mod.consultarModelo(tabelas, [{ ...rel, direcao: 'ambas' }], pedido);
  assert.deepStrictEqual(r.avisos, []);
  const chat = r.linhas.find(l => l[0] === 'CHAT');
  assert.ok(chat[1] > 0 && chat[1] <= 15, 'só pessoas do Suporte atendem chat');
});

console.log(`\n${ok} testes passaram.`);
