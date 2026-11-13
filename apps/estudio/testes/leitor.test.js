/* Testes do leitor de fórmulas (E6). Rodar:  node apps/estudio/testes/leitor.test.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const M = require('../js/m-motor.js');
const L = require('../js/leitor-motor.js');

let ok = 0;
const teste = (nome, fn) => { fn(); ok++; console.log('  ✓', nome); };
const csv = fs.readFileSync(path.join(__dirname, '../dados-demo/atendimentos.csv'), 'utf8');
console.log('Leitor de fórmulas');

teste('escrever volta ao texto M com os parênteses certos', () => {
  for (const e of ['([A] + [B]) * 2', '[A] + [B] * 2', 'if [CHAMADAS] = null then null else Number.Round([TEMPO] / [CHAMADAS], 1)', '[OPERAÇÃO] = "COBRANÇA" and ([CANAL] = "CHAT" or [DATA] = #date(2026, 11, 4))', 'not Text.Contains([CANAL], "VO")', '[A] - ([B] - [C])'])
    assert.strictEqual(L.escrever(M.analisar(e)), e);
});

teste('frase em português', () => {
  assert.strictEqual(L.frase(M.analisar('if [CHAMADAS] = null then null else Number.Round([TEMPO] / [CHAMADAS], 1)')),
    'se CHAMADAS estiver vazio, então vazio; senão, TEMPO dividido por CHAMADAS, arredondado para 1 casa');
  assert.strictEqual(L.frase(M.analisar('[OPERAÇÃO] = "COBRANÇA" and ([CANAL] = "CHAT" or [DATA] = #date(2026, 11, 4))')),
    'OPERAÇÃO for igual a "COBRANÇA" e (CANAL for igual a "CHAT" ou DATA for igual à data 04/11/2026)');
  assert.strictEqual(L.frase(M.analisar('([A] + [B]) * 2')), '(A mais B) vezes 2');
  assert.strictEqual(L.frase(M.analisar('Text.Upper([NOME]) & " - " & Text.From([MATRICULA])')), 'NOME em letras maiúsculas seguido de " - " seguido de MATRICULA transformado em texto');
});

teste('passo a passo com os valores da linha', () => {
  const linha = { TEMPO: 18068, CHAMADAS: 57 };
  const p = L.passos(M.analisar('if [CHAMADAS] = null then null else Number.Round([TEMPO] / [CHAMADAS], 1)'), linha);
  assert.deepStrictEqual(p.map(x => x.texto), [
    'Lê a coluna CHAMADAS',
    'Confere se 57 está vazio',
    'Lê a coluna TEMPO',
    'Divide 18068 por 57',
    'Calcula 316,982456, arredondado para 1 casa',
    'A condição deu falso, então usa a parte do "senão"',
  ]);
  assert.strictEqual(p[p.length - 1].valor, 317);
  const curto = L.passos(M.analisar('[A] > 5 and [B] = 1'), { A: 2, B: 1 });
  assert.ok(curto.some(x => /nem precisou olhar/.test(x.texto)), 'o "e" para no primeiro falso');
});

teste('a consulta inteira, uma frase por etapa', () => {
  const c = M.consultaDeCsv('atendimentos', 'atendimentos.csv', csv);
  M.inserirEtapa(c, { tipo: 'filtrar', expr: '[CANAL] = "VOZ"' });
  M.inserirEtapa(c, { tipo: 'agrupar', chaves: ['OPERAÇÃO'], agregacoes: [{ nome: 'Linhas', op: 'contar', coluna: null, tipo: 'inteiro' }] });
  const l = L.lerConsulta(c);
  assert.strictEqual(l[0].frase, 'Lê o arquivo "atendimentos.csv", separando as colunas por ponto e vírgula.');
  assert.strictEqual(l[4].frase, 'Fica só com as linhas em que CANAL for igual a "VOZ".');
  assert.strictEqual(l[5].frase, 'Agrupa por OPERAÇÃO e calcula Linhas (contar linhas).');
});

console.log(`\n${ok} testes passaram.`);
