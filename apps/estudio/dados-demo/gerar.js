/* Gera os exemplos fictícios do Estúdio (semente fixa: rodar de novo dá o mesmo resultado).
   Uso:  node apps/estudio/dados-demo/gerar.js
   Saída: quadro.csv, atendimentos.csv e exemplos.js (os mesmos CSVs, para abrir sem servidor).
   Tudo inventado: empresa "LSW Contact Center (fictícia)", matrículas 9xxxxx, e-mails @exemplo.lsw.
   Quando o gerador único (dados-demo/gerar.js da raiz, frente F2) existir, este arquivo passa a usá-lo. */
const fs = require('fs');
const path = require('path');

let semente = 20261112;
const aleatorio = () => { semente = (semente * 1664525 + 1013904223) % 4294967296; return semente / 4294967296; };
const escolher = lista => lista[Math.floor(aleatorio() * lista.length)];
const entre = (a, b) => a + Math.floor(aleatorio() * (b - a + 1));
const pad = n => String(n).padStart(2, '0');

const NOMES = ['ANA', 'BRUNO', 'CARLA', 'DANIEL', 'ELISA', 'FÁBIO', 'GABRIELA', 'HUGO', 'ISABEL', 'JOÃO', 'KARINA', 'LUCAS', 'MARINA', 'NELSON', 'OLÍVIA', 'PAULO', 'RAQUEL', 'SÉRGIO', 'TATIANE', 'VÍTOR'];
const SOBRENOMES = ['SILVA', 'SOUZA', 'COSTA', 'LIMA', 'PEREIRA', 'ALMEIDA', 'ROCHA', 'DIAS', 'MOREIRA', 'NUNES', 'RIBEIRO', 'MARTINS'];
const OPERACOES = [['SAC', 280], ['COBRANÇA', 340], ['VENDAS', 410], ['SUPORTE TÉCNICO', 520]]; // operação e TMA médio em segundos

// ---- quadro: 64 pessoas, 16 por operação, 1 supervisor a cada 15 operadores ----
const pessoas = [];
let matricula = 900100;
OPERACOES.forEach(([op]) => {
  const sup = `${escolher(NOMES)} ${escolher(SOBRENOMES)}`;
  for (let i = 0; i < 16; i++) {
    const nome = `${escolher(NOMES)} ${escolher(SOBRENOMES)} ${escolher(SOBRENOMES)}`;
    const cargo = i === 0 ? 'SUPERVISOR' : 'OPERADOR';
    const adm = `${pad(entre(1, 28))}/${pad(entre(1, 12))}/${entre(2019, 2026)}`;
    pessoas.push({ matricula: ++matricula, nome, cargo, op, supervisor: i === 0 ? '' : sup, admissao: adm, jornada: escolher(['06:20', '06:20', '08:12']) });
  }
});
const quadro = ['MATRICULA;NOME;CARGO;OPERAÇÃO;SUPERVISOR;ADMISSÃO;JORNADA',
  ...pessoas.map(p => [p.matricula, p.nome, p.cargo, p.op, p.supervisor, p.admissao, p.jornada].join(';'))].join('\n');

// ---- atendimentos: um registro por operador por dia, de 03/11 a 09/11/2026 ----
// Algumas falhas de propósito, para treinar o tratamento: CHAMADAS "n/d", CANAL vazio e espaços sobrando.
const linhas = ['DATA;MATRICULA;OPERAÇÃO;CANAL;CHAMADAS;TEMPO_FALADO_S;LOGIN'];
for (let d = 3; d <= 9; d++) {
  const dow = new Date(Date.UTC(2026, 10, d)).getUTCDay();
  const fator = dow === 1 ? 1.15 : dow === 0 ? 0.55 : dow === 6 ? 0.7 : 1;
  pessoas.filter(p => p.cargo === 'OPERADOR').forEach(p => {
    if (aleatorio() < (dow === 0 ? 0.55 : 0.12)) return; // folga ou ausência
    const tma = OPERACOES.find(o => o[0] === p.op)[1];
    const chamadas = Math.max(0, Math.round(entre(38, 62) * fator * (p.jornada === '08:12' ? 1.25 : 1)));
    const tempo = Math.round(chamadas * tma * (0.85 + aleatorio() * 0.3));
    const canal = p.op === 'SUPORTE TÉCNICO' && aleatorio() < 0.4 ? 'CHAT' : 'VOZ';
    const login = p.jornada === '08:12' ? escolher(['08:00', '09:00', '12:48']) : escolher(['06:00', '08:00', '14:00', '15:40']);
    const sorteio = aleatorio();
    linhas.push([
      `${pad(d)}/11/2026`, p.matricula, sorteio < 0.03 ? ` ${p.op} ` : p.op,
      sorteio > 0.97 ? '' : canal, sorteio > 0.5 && sorteio < 0.52 ? 'n/d' : chamadas, tempo, login,
    ].join(';'));
  });
}
const atendimentos = linhas.join('\n');

const pasta = __dirname;
fs.writeFileSync(path.join(pasta, 'quadro.csv'), quadro + '\n');
fs.writeFileSync(path.join(pasta, 'atendimentos.csv'), atendimentos + '\n');
fs.writeFileSync(path.join(pasta, 'exemplos.js'),
  '/* Gerado por dados-demo/gerar.js — não editar à mão. Dados fictícios. */\n' +
  'window.ESTUDIO_EXEMPLOS = ' + JSON.stringify({
    'atendimentos.csv': atendimentos + '\n',
    'quadro.csv': quadro + '\n',
  }, null, 1) + ';\n');
console.log(`quadro.csv: ${pessoas.length} pessoas · atendimentos.csv: ${linhas.length - 1} linhas`);
