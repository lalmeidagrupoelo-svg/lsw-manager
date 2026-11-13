/* =====================================================================
   ESTÚDIO · TELA "TRANSFORMAR DADOS" (E1 · 12/11/2026)
   Liga a tela ao motor (js/m-motor.js) e ao armazenamento (js/armazenamento.js).
   Seções: 1 preferências · 2 estado e salvar · 3 desenhar a tela · 4 grade e
   menu da coluna · 5 janelas das ferramentas · 6 ações · 7 início.
   ===================================================================== */
'use strict';
const M = window.MMotor;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LIMITE_LINHAS_GRADE = 200;

/* ---------------- 1. preferências (tema e fonte, iguais em todos os módulos) ---------------- */
const PREFS = 'lsw-prefs';
function lerPrefs() {
  try { return { tema: 'automatico', fonte: 8, ...JSON.parse(localStorage.getItem(PREFS) || '{}') }; }
  catch { return { tema: 'automatico', fonte: 8 }; }
}
function salvarPref(chave, valor) {
  const p = lerPrefs(); p[chave] = valor;
  try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* sem armazenamento: vale só nesta aba */ }
  aplicarPrefs(p);
}
function aplicarPrefs(p = lerPrefs()) {
  const raiz = document.documentElement;
  if (p.tema === 'escuro') raiz.dataset.theme = 'dark';
  else if (p.tema === 'claro') raiz.dataset.theme = 'light';
  else delete raiz.dataset.theme;
  const nivel = Math.min(15, Math.max(1, Number(p.fonte) || 8));
  raiz.style.setProperty('--escala-fonte', (0.9 + (nivel - 8) * 0.05).toFixed(2)); // nível 8 = 0,90
  $('tema').value = p.tema;
  $('fonte-n').textContent = nivel;
}

/* ---------------- 2. estado e salvar ---------------- */
const ui = {
  consultas: [],     // [{ id, nome, fonte: { arquivo, texto }, etapas: [...] }]
  sel: null,         // id da consulta aberta
  etapaSel: null,    // índice da etapa selecionada (null = a última)
  codigoAberto: false,
  editandoCodigo: false, // Editor avançado aberto para edição
  editandoFormula: false, // barra fx em edição
  msgCelula: '',     // mensagem do "Error" clicado na grade
  aoConfirmar: null, // função do botão principal da janela aberta
  tela: 'consultas', // 'consultas' (Transformar dados) ou 'modelo' (Modelo e relacionamentos)
  modelo: { relacionamentos: [], posicoes: {} }, // relações entre consultas e lugar de cada cartão
};
// Modelo inicial da demonstração: atendimentos[MATRICULA] * — 1 quadro[MATRICULA]
function modeloPadrao() {
  const nomes = ui.consultas.map(c => c.nome);
  return { posicoes: {}, relacionamentos: nomes.includes('atendimentos') && nomes.includes('quadro')
    ? [{ id: 'r1', de: { consulta: 'atendimentos', coluna: 'MATRICULA' }, para: { consulta: 'quadro', coluna: 'MATRICULA' }, cardinalidade: 'N:1', direcao: 'unica', ativo: true }] : [] };
}
const atual = () => ui.consultas.find(c => c.id === ui.sel) || null;
function indiceEtapa() {
  const c = atual(); if (!c) return -1;
  return ui.etapaSel === null || ui.etapaSel >= c.etapas.length ? c.etapas.length - 1 : ui.etapaSel;
}
// Executa uma consulta conhecendo as outras (Mesclar e Acrescentar usam outras consultas)
const exec = (c, ate) => M.executar(c, ate, ui.consultas);
const resultadoAtual = () => { const c = atual(); return c ? exec(c, indiceEtapa()) : null; };

async function salvar() {
  const r = await Armazenamento.salvar({ versao: 1, consultas: ui.consultas, sel: ui.sel, modelo: ui.modelo });
  $('status-salvo').textContent = r.ok ? `Salvo no navegador às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Não salvo';
  if (!r.ok) aviso(r.erro, 'erro');
}
function aviso(texto, tipo = 'ok', ms = 4200) {
  const el = document.createElement('div');
  el.className = 'aviso' + (tipo === 'erro' ? ' erro' : '');
  el.textContent = texto;
  $('avisos').appendChild(el);
  setTimeout(() => el.remove(), ms);
}
function nomeConsultaUnico(base) {
  const nomes = new Set(ui.consultas.map(c => c.nome));
  if (!nomes.has(base)) return base;
  let n = 2; while (nomes.has(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}
function consultasDeExemplo() {
  const ex = window.ESTUDIO_EXEMPLOS || {};
  return Object.entries(ex).map(([arquivo, texto]) => M.consultaDeCsv(arquivo.replace(/\.[^.]+$/, ''), arquivo, texto));
}

/* ---------------- 3. desenhar a tela ---------------- */
function render() {
  const modelo = ui.tela === 'modelo';
  document.querySelector('.principal').classList.toggle('modo-modelo', modelo);
  $('tela-modelo').hidden = !modelo;
  $('titulo-tela').textContent = modelo ? 'Modelo e relacionamentos' : 'Transformar dados';
  document.querySelectorAll('[data-tela]').forEach(b => b.classList.toggle('on', b.dataset.tela === ui.tela));
  if (modelo) { if (typeof renderModelo === 'function') renderModelo(); return; }
  renderConsultas();
  renderEtapas();
  renderCentro();
  renderCodigo();
  const res = resultadoAtual();
  const temTabela = !!(res && res.tabela);
  document.querySelectorAll('[data-precisa-tabela]').forEach(b => { b.disabled = !temTabela; });
  $('ferr-codigo').classList.toggle('on', ui.codigoAberto);
}

function renderConsultas() {
  $('titulo-consultas').textContent = `Consultas (${ui.consultas.length})`;
  $('lista-consultas').innerHTML = ui.consultas.map(c => {
    const falha = exec(c).erro;
    return `<li class="${c.id === ui.sel ? 'on' : ''}${falha ? ' com-erro' : ''}" data-consulta="${c.id}" title="${falha ? esc('Com erro na etapa ' + falha.etapa) : esc(c.fonte.arquivo)}">
      <span class="ico">${falha ? '⚠' : '▦'}</span><span class="nome">${esc(c.nome)}</span>
      <button class="x" type="button" data-excluir-consulta="${c.id}" aria-label="Excluir consulta ${esc(c.nome)}">×</button></li>`;
  }).join('');
}

function renderEtapas() {
  const c = atual();
  $('nome-consulta').value = c ? c.nome : '';
  $('nome-consulta').disabled = !c;
  if (!c) { $('lista-etapas').innerHTML = ''; return; }
  const sel = indiceEtapa();
  const falha = exec(c).erro;
  $('lista-etapas').innerHTML = c.etapas.map((e, i) => `
    <li class="${i === sel ? 'on' : ''}${i > sel ? ' depois' : ''}${falha && falha.indice === i ? ' com-erro' : ''}" data-etapa="${i}" title="${esc(M.ETAPAS[e.tipo].descricao)}">
      <span class="ico">${falha && falha.indice === i ? '⚠' : i + 1}</span><span class="nome">${esc(e.nome)}</span>
      ${e.tipo === 'filtrar' || e.tipo === 'expandir' ? `<button class="x editar" type="button" data-editar-etapa="${i}" aria-label="Editar a etapa ${esc(e.nome)}" title="${e.tipo === 'filtrar' ? 'Editar este filtro' : 'Escolher colunas e nomes'}">✎</button>` : ''}
      ${i > 0 ? `<button class="x" type="button" data-excluir-etapa="${i}" aria-label="Excluir etapa ${esc(e.nome)}">×</button>` : ''}
    </li>`).join('');
}

function renderCentro() {
  const c = atual();
  const area = $('grade-area');
  if (!c) {
    mostrarFormula('');
    area.innerHTML = `<div class="vazio-estado"><h3>Nenhuma consulta aberta</h3>
      <p>Uma consulta lê um arquivo e guarda cada tratamento como uma etapa, igual ao Power Query. Comece por um dos exemplos fictícios ou importe um CSV.</p>
      <div class="acoes"><button class="btn prim" type="button" data-ferr="nova">+ Nova consulta</button></div></div>`;
    $('rodape-grade').innerHTML = '';
    return;
  }
  const i = indiceEtapa();
  mostrarFormula(M.gerarMEtapa(c, i));
  const res = exec(c, i);
  if (res.erro) {
    area.innerHTML = `<div class="erro-etapa"><h3>A etapa “${esc(res.erro.etapa)}” não conseguiu rodar</h3>
      <p>Isso costuma acontecer quando uma etapa anterior foi apagada ou mudou o nome de uma coluna que esta etapa usa.</p>
      <code>${esc(res.erro.mensagem)}</code>
      <div class="acoes">
        ${res.erro.indice > 0 ? `<button class="btn" type="button" data-ir-etapa="${res.erro.indice - 1}">Ver a etapa anterior</button>` : ''}
        ${res.erro.indice > 0 ? `<button class="btn perigo" type="button" data-excluir-etapa="${res.erro.indice}">Excluir esta etapa</button>` : ''}
      </div></div>`;
    $('rodape-grade').innerHTML = `<span class="msg-erro">Etapa com erro: ${esc(res.erro.etapa)}</span>`;
    return;
  }
  area.innerHTML = htmlGrade(res.tabela);
  const t = res.tabela;
  const erros = t.colunas.reduce((s, _, k) => s + M.qualidade(t, k).erros, 0);
  $('rodape-grade').innerHTML = `<span><b>${t.colunas.length}</b> colunas</span><span><b>${t.linhas.length.toLocaleString('pt-BR')}</b> linhas${t.linhas.length > LIMITE_LINHAS_GRADE ? ` (mostrando as ${LIMITE_LINHAS_GRADE} primeiras)` : ''}</span>
    ${erros ? `<span class="msg-erro">${erros.toLocaleString('pt-BR')} célula(s) com Error</span>` : ''}
    ${ui.msgCelula ? `<span class="msg-erro">${esc(ui.msgCelula)}</span>` : ''}`;
}

// Pinta o código M com cores (palavras do M, funções, textos, números, colunas)
function pintarM(codigo) {
  const re = /(#"(?:[^"]|"")*")|("(?:[^"]|"")*")|(\[[^\]\n=]*\])|\b(let|in|each|if|then|else|and|or|not|type|true|false|null)\b|(#?[A-Z][A-Za-z0-9]*\.[A-Za-z0-9.]+|#date|#time)(?=\s*\()|(\b\d+(?:\.\d+)?\b)/g;
  let out = '', ult = 0, m;
  while ((m = re.exec(codigo))) {
    out += esc(codigo.slice(ult, m.index));
    const [txt] = m;
    const cls = m[1] ? 'm-id' : m[2] ? 'm-txt' : m[3] ? 'm-col' : m[4] ? 'm-kw' : m[5] ? 'm-fn' : 'm-num';
    out += `<span class="${cls}">${esc(txt)}</span>`;
    ult = m.index + txt.length;
  }
  return out + esc(codigo.slice(ult));
}
function renderCodigo() {
  $('painel-codigo').hidden = !ui.codigoAberto;
  const c = atual();
  const editando = ui.editandoCodigo && !!c;
  $('codigo-m').hidden = editando; $('codigo-edicao').hidden = !editando;
  $('codigo-acoes-ver').hidden = editando; $('codigo-acoes-editar').hidden = !editando;
  $('codigo-dica').textContent = editando
    ? 'Mude o código e clique em Aplicar código: as etapas são refeitas a partir dele. Ctrl+Enter também aplica.'
    : 'Escrito sozinho a cada clique. Clique em Editar para mudar o código e refazer as etapas.';
  if (!editando) $('codigo-erro').hidden = true;
  $('codigo-m').innerHTML = c && ui.codigoAberto && !editando ? pintarM(M.gerarM(c)) : '';
  $('ferr-editor').classList.toggle('on', editando);
}

/* ---------------- barra de fórmula (fx) e Editor avançado: escrever M direto ---------------- */
function ajustarAlturaFormula() { const f = $('formula'); f.style.height = 'auto'; f.style.height = f.scrollHeight + 'px'; }
function mostrarFormula(texto) {
  if (ui.editandoFormula) return; // não apaga o que a pessoa está digitando
  $('formula').value = texto; $('formula').disabled = !texto;
  $('formula-erro').hidden = true; $('formula-acoes').hidden = true;
  ajustarAlturaFormula();
}
function aplicarFormula() {
  const c = atual(); if (!c) return;
  const i = indiceEtapa(); const etapa = c.etapas[i];
  try {
    const dados = M.lerLinhaEtapa($('formula').value, c, i);
    const antes = JSON.stringify({ ...etapa, id: 0 });
    c.etapas[i] = { id: etapa.id, nome: etapa.nome, ...dados };
    ui.editandoFormula = false;
    if (JSON.stringify({ ...c.etapas[i], id: 0 }) === antes) return render();
    salvar(); render();
    const falha = exec(c).erro;
    aviso(falha ? `Etapa "${etapa.nome}" alterada, mas a etapa "${falha.etapa}" ficou com erro.` : `Etapa "${etapa.nome}" alterada pelo código M.`, falha ? 'erro' : 'ok');
  } catch (e) {
    $('formula-erro').textContent = e.message.replace(/^Expression\./, '');
    $('formula-erro').hidden = false;
  }
}
function cancelarFormula() { ui.editandoFormula = false; renderCentro(); $('formula').blur(); }
function abrirEditorAvancado() {
  const c = atual(); if (!c) return aviso('Abra uma consulta para editar o código.', 'erro');
  ui.codigoAberto = true; ui.editandoCodigo = true;
  render();
  $('codigo-edicao').value = M.gerarM(c);
  $('codigo-erro').hidden = true;
  $('codigo-edicao').focus();
}
function aplicarCodigo() {
  const c = atual(); if (!c) return;
  try {
    const etapas = M.lerM($('codigo-edicao').value, c);
    c.etapas = etapas; ui.etapaSel = null; ui.editandoCodigo = false; ui.msgCelula = '';
    salvar(); render();
    const falha = exec(c).erro;
    aviso(falha ? `Código aplicado: ${etapas.length} etapas. A etapa "${falha.etapa}" está com erro; clique nela para ver.` : `Código aplicado: ${etapas.length} etapas refeitas.`, falha ? 'erro' : 'ok', 5000);
  } catch (e) {
    $('codigo-erro').textContent = e.message.replace(/^Expression\./, '');
    $('codigo-erro').hidden = false;
  }
}

/* ---------------- 4. grade e menu da coluna ---------------- */
function htmlGrade(t) {
  const cab = t.colunas.map((col, k) => {
    const q = M.qualidade(t, k); const tot = q.total || 1;
    const pct = n => (n / tot * 100).toFixed(1);
    const dica = `Válidos ${pct(q.validos)}% · Erros ${pct(q.erros)}% · Vazios ${pct(q.vazios)}%`;
    return `<th><button class="cab" type="button" data-coluna="${k}" title="${esc(col.nome + ' — ' + M.TIPOS[col.tipo].rotulo + '\n' + dica)}">
      <span class="linha1"><span class="tipo">${M.TIPOS[col.tipo].icone}</span><span class="nome">${esc(col.nome)}</span><span class="seta">▾</span></span>
      <span class="qualidade" aria-label="${esc(dica)}"><i class="q-ok" style="width:${pct(q.validos)}%"></i><i class="q-erro" style="width:${pct(q.erros)}%"></i><i class="q-vazio" style="width:${pct(q.vazios)}%"></i></span>
    </button></th>`;
  }).join('');
  const numerico = t.colunas.map(c => c.tipo === 'inteiro' || c.tipo === 'decimal');
  const corpo = t.linhas.slice(0, LIMITE_LINHAS_GRADE).map((l, r) => `<tr><td class="num-linha">${r + 1}</td>${l.map((v, k) => {
    if (M.ehErro(v)) return `<td class="erro" data-erro="${esc(v.mensagem)}">Error</td>`;
    if (v === null) return '<td class="nulo">null</td>';
    if (v && v.aninhada) return `<td class="aninhada" title="${v.aninhada.linhas.length} linha(s) da outra consulta">Table <small>${v.aninhada.linhas.length}</small></td>`;
    return `<td class="${numerico[k] ? 'num' : ''}">${esc(M.formatar(v, t.colunas[k].tipo))}</td>`;
  }).join('')}</tr>`).join('');
  return `<table class="grade"><thead><tr><th class="num-linha"></th>${cab}</tr></thead><tbody>${corpo}</tbody></table>`;
}

function fecharMenuColuna() { document.querySelectorAll('.menu-col').forEach(m => m.remove()); }
function abrirMenuColuna(k, botao) {
  fecharMenuColuna();
  const t = resultadoAtual().tabela; const col = t.colunas[k];
  const menu = document.createElement('div');
  menu.className = 'menu-col'; menu.setAttribute('role', 'menu');
  menu.innerHTML = `
    <button type="button" data-acao-col="filtrar">Filtrar linhas…</button>
    <button type="button" data-acao-col="renomear">Renomear…</button>
    <button type="button" data-acao-col="remover">Remover <small>Table.RemoveColumns</small></button>
    <button type="button" data-acao-col="outras">Remover outras colunas <small>Table.SelectColumns</small></button>
    <hr><div class="titulo-menu">Alterar tipo para</div>
    ${Object.entries(M.TIPOS).filter(([k2]) => k2 !== 'qualquer' && k2 !== 'tabela').map(([k2, tp]) => `<button type="button" data-acao-col="tipo" data-tipo="${k2}">${tp.rotulo}${col.tipo === k2 ? ' ✓' : ''} <small>${tp.icone}</small></button>`).join('')}
    <hr><button type="button" data-acao-col="agrupar">Agrupar por esta coluna…</button>
    <button type="button" data-acao-col="adicionar">Coluna personalizada…</button>`;
  document.body.appendChild(menu);
  ui.menuAbertoEm = Date.now();
  const r = botao.getBoundingClientRect();
  menu.style.left = Math.min(r.left, window.innerWidth - menu.offsetWidth - 8) + 'px';
  menu.style.top = Math.min(r.bottom + 2, window.innerHeight - menu.offsetHeight - 8) + 'px';
  menu.addEventListener('click', ev => {
    const b = ev.target.closest('[data-acao-col]'); if (!b) return;
    fecharMenuColuna();
    const acao = b.dataset.acaoCol;
    if (acao === 'filtrar') janelaFiltrar(col.nome);
    if (acao === 'renomear') janelaRenomear(col.nome);
    if (acao === 'remover') adicionarEtapa({ tipo: 'remover', colunas: [col.nome] });
    if (acao === 'outras') adicionarEtapa({ tipo: 'escolher', colunas: [col.nome] });
    if (acao === 'tipo') { if (b.dataset.tipo !== col.tipo) adicionarEtapa({ tipo: 'tipos', lista: [[col.nome, b.dataset.tipo]] }); }
    if (acao === 'adicionar') janelaPersonalizada();
    if (acao === 'agrupar') janelaAgrupar(col.nome);
  });
}

/* ---------------- 5. janelas das ferramentas ---------------- */
function abrirJanela({ titulo, corpo, ok = 'Aplicar', largo = false, semOk = false, aoAbrir, aoConfirmar }) {
  fecharMenuColuna();
  $('modal-titulo').textContent = titulo;
  // Troca o corpo por um elemento novo: assim os "ouvintes" da janela anterior não sobram
  const antigo = $('modal-corpo'); const novo = antigo.cloneNode(false); antigo.replaceWith(novo);
  $('modal-corpo').innerHTML = corpo;
  $('modal-msg').textContent = '';
  $('modal-ok').textContent = ok;
  $('modal-ok').hidden = semOk;
  $('modal-cancelar').textContent = semOk ? 'Fechar' : 'Cancelar';
  $('modal-caixa').classList.toggle('largo', largo);
  ui.aoConfirmar = aoConfirmar || null;
  $('modal').hidden = false;
  if (aoAbrir) aoAbrir();
  const foco = $('modal-corpo').querySelector('input:not([type=checkbox]):not([type=file]), textarea, select');
  if (foco) foco.focus();
}
function fecharJanela() { $('modal').hidden = true; $('modal-corpo').innerHTML = ''; ui.aoConfirmar = null; }
function confirmarJanela() {
  if (!ui.aoConfirmar) return fecharJanela();
  try {
    const r = ui.aoConfirmar();
    if (typeof r === 'string') { $('modal-msg').textContent = r; return; }
    if (r !== false) fecharJanela();
  } catch (e) { $('modal-msg').textContent = e.message; }
}
const tabelaEntrada = () => resultadoAtual().tabela;
const opcoesColunas = (t, sel) => t.colunas.map(c => `<option value="${esc(c.nome)}" ${c.nome === sel ? 'selected' : ''}>${esc(c.nome)}</option>`).join('');

// Nova consulta: exemplo fictício ou arquivo CSV
function janelaNova() {
  const ex = window.ESTUDIO_EXEMPLOS || {};
  const descricao = { 'atendimentos.csv': 'Chamadas e tempo falado por operador e dia (03 a 09/11/2026). Tem falhas de propósito para tratar: "n/d", espaços e vazios.', 'quadro.csv': '64 pessoas fictícias: matrícula, cargo, operação, supervisor e jornada.' };
  abrirJanela({
    titulo: 'Nova consulta', semOk: true,
    corpo: `<div class="cartoes">
      <div class="cartao"><h3>Usar um exemplo</h3><p>Dados inventados, da empresa fictícia LSW Contact Center.</p>
        ${Object.keys(ex).map(a => `<button class="btn" type="button" data-exemplo="${esc(a)}" style="justify-content:flex-start;text-align:left">${esc(a)}</button><p>${esc(descricao[a] || '')}</p>`).join('')}
      </div>
      <div class="cartao"><h3>Importar um arquivo CSV</h3><p>Separado por ponto e vírgula, vírgula ou tabulação. Até 2 MB nesta demonstração, porque tudo fica guardado no navegador.</p>
        <input type="file" id="arquivo-csv" accept=".csv,.txt,text/csv">
        <p class="ajuda">O Estúdio cria sozinho as etapas Fonte, Cabeçalhos Promovidos e Tipo Alterado.</p>
      </div></div>`,
    aoAbrir() {
      $('modal-corpo').querySelectorAll('[data-exemplo]').forEach(b => b.addEventListener('click', () => criarConsulta(b.dataset.exemplo, ex[b.dataset.exemplo])));
      $('arquivo-csv').addEventListener('change', ev => {
        const f = ev.target.files[0]; if (!f) return;
        if (f.size > 2 * 1024 * 1024) { $('modal-msg').textContent = `O arquivo tem ${(f.size / 1048576).toFixed(1).replace('.', ',')} MB. Nesta demonstração o limite é 2 MB.`; return; }
        const leitor = new FileReader();
        leitor.onload = () => criarConsulta(f.name, String(leitor.result));
        leitor.onerror = () => { $('modal-msg').textContent = 'Não foi possível ler o arquivo.'; };
        leitor.readAsText(f, 'utf-8');
      });
    },
  });
}
function criarConsulta(arquivo, texto) {
  const c = M.consultaDeCsv(nomeConsultaUnico(arquivo.replace(/\.[^.]+$/, '')), arquivo, texto);
  const tab = exec(c).tabela;
  if (!tab || !tab.colunas.length) { $('modal-msg').textContent = 'O arquivo está vazio ou não parece um CSV.'; return; }
  ui.consultas.push(c); ui.sel = c.id; ui.etapaSel = null; ui.msgCelula = '';
  fecharJanela(); salvar(); render();
  aviso(`Consulta "${c.nome}" criada com ${tab.linhas.length.toLocaleString('pt-BR')} linhas e ${tab.colunas.length} colunas.`);
}

// Escolher colunas (fica só com as marcadas) e Remover colunas (tira as marcadas)
function janelaColunas(modo, pre) {
  const t = tabelaEntrada(); const escolher = modo === 'escolher';
  abrirJanela({
    titulo: escolher ? 'Escolher colunas' : 'Remover colunas',
    ok: escolher ? 'Ficar com as marcadas' : 'Remover as marcadas',
    corpo: `<p class="ajuda">${escolher ? 'Marque as colunas que <b>ficam</b>. As outras saem (no M: Table.SelectColumns).' : 'Marque as colunas que <b>saem</b> (no M: Table.RemoveColumns).'}</p>
      <div class="campo"><input type="search" id="busca-col" placeholder="Procurar coluna"></div>
      <div class="acoes"><button class="btn peq" type="button" id="marcar-todas">Marcar todas</button><button class="btn peq" type="button" id="desmarcar-todas">Desmarcar todas</button></div>
      <div class="checks" id="checks-col">${t.colunas.map(c => `<label><input type="checkbox" value="${esc(c.nome)}" ${escolher || c.nome === pre ? 'checked' : ''}> ${esc(c.nome)} <small>${M.TIPOS[c.tipo].icone}</small></label>`).join('')}</div>`,
    aoAbrir() {
      const caixas = () => [...$('checks-col').querySelectorAll('input')];
      $('busca-col').addEventListener('input', ev => { const q = ev.target.value.toLowerCase(); caixas().forEach(x => { x.parentElement.hidden = !x.value.toLowerCase().includes(q); }); });
      $('marcar-todas').onclick = () => caixas().forEach(x => { x.checked = true; });
      $('desmarcar-todas').onclick = () => caixas().forEach(x => { x.checked = false; });
    },
    aoConfirmar() {
      const marcadas = [...$('checks-col').querySelectorAll('input:checked')].map(x => x.value);
      if (escolher) {
        if (!marcadas.length) return 'Marque pelo menos uma coluna para ficar.';
        if (marcadas.length === t.colunas.length) return 'Todas as colunas estão marcadas: nada sairia.';
        adicionarEtapa({ tipo: 'escolher', colunas: marcadas });
      } else {
        if (!marcadas.length) return 'Marque pelo menos uma coluna para remover.';
        if (marcadas.length === t.colunas.length) return 'Não dá para remover todas as colunas.';
        adicionarEtapa({ tipo: 'remover', colunas: marcadas });
      }
    },
  });
}

// Filtrar linhas: condições com E/OU na frente, grupos (parênteses) e aba Avançado (M).
// Regra sem ambiguidade: em cada nível vale UM conector — trocar o E/OU de uma linha troca o das outras
// do mesmo nível. Para misturar E com OU, usa-se "+ Adicionar grupo".
// Se a etapa selecionada já é um filtro, a janela EDITA esse filtro (como o Power Query).
function janelaFiltrar(pre) {
  const c = atual(); const idx = indiceEtapa();
  const editando = c.etapas[idx] && c.etapas[idx].tipo === 'filtrar';
  const entrada = editando ? exec(c, idx - 1) : resultadoAtual();
  if (!entrada.tabela) return aviso('A etapa anterior ao filtro está com erro; corrija-a antes de editar o filtro.', 'erro');
  const t = entrada.tabela;
  const exprAtual = editando ? c.etapas[idx].expr : '';
  const filtroAtual = editando ? M.lerFiltro(exprAtual) : null;
  const tipos = Object.fromEntries(t.colunas.map(x => [x.nome, x.tipo]));
  const ops = Object.entries(M.OPERADORES).map(([k, o]) => `<option value="${k}">${o.rotulo}</option>`).join('');
  const cacheValores = {};
  const valoresDe = nome => {
    if (cacheValores[nome]) return cacheValores[nome];
    const k = t.colunas.findIndex(x => x.nome === nome); if (k < 0) return [];
    const vistos = new Set();
    for (const l of t.linhas) { const v = l[k]; if (v !== null && !M.ehErro(v) && v !== '') vistos.add(M.formatar(v, t.colunas[k].tipo)); if (vistos.size >= 200) break; }
    return (cacheValores[nome] = [...vistos].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true })));
  };
  const juntaHtml = (primeira, junta) => primeira ? '<span class="cond-junta cond-onde">Onde</span>'
    : `<select class="cond-junta" data-campo="junta" aria-label="Conector (vale para todo este nível)"><option value="and" ${junta === 'or' ? '' : 'selected'}>E</option><option value="or" ${junta === 'or' ? 'selected' : ''}>OU</option></select>`;
  const htmlCond = (cd, primeira, junta) => `<div class="cond" data-item>
      ${juntaHtml(primeira, junta)}
      <select data-campo="col" aria-label="Coluna">${opcoesColunas(t, cd.coluna)}</select>
      <select data-campo="op" aria-label="Condição">${ops.replace(`value="${cd.operador || 'igual'}"`, `value="${cd.operador || 'igual'}" selected`)}</select>
      <div class="cond-valor">
        <input type="text" data-campo="val" value="${esc(cd.valor || '')}" aria-label="Valor" autocomplete="off">
        <button type="button" class="cond-abrir" data-abrir-valores tabindex="-1" aria-label="Ver os valores da coluna">▾</button>
        <ul class="cond-sugestoes" role="listbox" hidden></ul>
      </div>
      <button class="cond-x" type="button" data-remover-cond aria-label="Remover esta condição" title="Remover esta condição">×</button>
    </div>`;
  const htmlGrupo = (g, primeira, junta) => `<div class="grupo-f" data-item>
      ${juntaHtml(primeira, junta)}
      <div class="grupo-caixa">
        <div class="grupo-topo"><span>Grupo · entre parênteses</span><button class="cond-x" type="button" data-remover-grupo aria-label="Remover o grupo" title="Remover o grupo inteiro">×</button></div>
        <div class="conds" data-nivel>${g.conds.map((cd, i) => htmlCond(cd, i === 0, g.junta)).join('')}</div>
        <div><button class="btn peq" type="button" data-mais-no-grupo>+ Condição no grupo</button></div>
      </div>
    </div>`;
  const htmlFiltro = f => f.itens.map((it, i) => it.grupo ? htmlGrupo(it, i === 0, f.junta) : htmlCond(it, i === 0, f.junta)).join('');
  let inicial = filtroAtual ? JSON.parse(JSON.stringify(filtroAtual)) : { junta: 'and', itens: [{ coluna: pre, operador: 'igual', valor: '' }] };
  if (filtroAtual && pre && !JSON.stringify(filtroAtual).includes(JSON.stringify(pre))) inicial.itens.push({ coluna: pre, operador: 'igual', valor: '' }); // veio do menu de outra coluna
  const comecaAvancado = editando && !filtroAtual;
  abrirJanela({
    titulo: editando ? `Editar filtro · ${c.etapas[idx].nome}` : 'Filtrar linhas', largo: true, ok: editando ? 'Salvar filtro' : 'Aplicar',
    corpo: `${editando ? `<p class="ajuda">Você está editando a etapa <b>${esc(c.etapas[idx].nome)}</b>. Os valores mostrados são os de <b>antes</b> do filtro, então dá para trocar por qualquer outro.</p>` : ''}
      <div class="abas" role="tablist"><button type="button" class="${comecaAvancado ? '' : 'on'}" data-aba="basico">Básico</button><button type="button" class="${comecaAvancado ? 'on' : ''}" data-aba="avancado">Avançado (M)</button></div>
      <div id="aba-basico" class="campo" style="gap:8px" ${comecaAvancado ? 'hidden' : ''}>
        <span class="rotulo">Manter as linhas em que</span>
        <div id="f-conds" class="conds" data-nivel>${htmlFiltro(inicial)}</div>
        <div class="acoes"><button class="btn peq" type="button" id="f-mais">+ Adicionar condição</button><button class="btn peq" type="button" id="f-grupo">+ Adicionar grupo</button></div>
        <p class="ajuda"><b>E</b>: todas precisam valer. <b>OU</b>: basta uma valer. No mesmo nível vale um conector só; para misturar (ex.: COBRANÇA <b>E</b> (CHAT <b>OU</b> dia 04/11)), crie um <b>grupo</b>. Para achar linhas sem valor, use "está vazio".</p>
      </div>
      <div id="aba-avancado" class="campo" ${comecaAvancado ? '' : 'hidden'}>
        <label for="f-expr">Condição em M</label>
        <textarea id="f-expr" spellcheck="false" placeholder='each [OPERAÇÃO] = "SAC" and [CHAMADAS] > 40'>${comecaAvancado ? esc('each ' + exprAtual) : ''}</textarea>
        <p class="ajuda">Use [Coluna], = &lt;&gt; &gt; &lt; &gt;= &lt;=, and, or, not, parênteses e funções como Text.Contains([CANAL], "VO") ou [DATA] &gt;= #date(2026, 11, 5).${comecaAvancado ? ' Este filtro foi escrito à mão de um jeito que o modo Básico não mostra, por isso abriu aqui.' : ''}</p>
      </div>
      <div class="resultado" id="f-res">—</div>`,
    aoAbrir() {
      let aba = comecaAvancado ? 'avancado' : 'basico';
      const raiz = $('f-conds');
      const itensDe = nivel => [...nivel.children].filter(x => x.matches('[data-item]'));
      const campo = (el, nome) => el.querySelector(`:scope > [data-campo="${nome}"], :scope > .cond-valor > [data-campo="${nome}"]`);
      const juntaDoNivel = nivel => { const s = itensDe(nivel).map(x => x.querySelector(':scope > [data-campo="junta"]')).find(Boolean); return s ? s.value : 'and'; };
      // Lê o formulário e devolve o modelo { junta, itens }
      const lerCond = (el, n) => {
        const cd = { coluna: campo(el, 'col').value, operador: campo(el, 'op').value, valor: campo(el, 'val').value };
        if (!M.OPERADORES[cd.operador].semValor && cd.valor.trim() === '') throw new M.FalhaEtapa(`A condição ${n} está sem valor. Escolha um valor, use "está vazio" ou remova a condição no ×.`);
        return cd;
      };
      const lerModelo = () => {
        let n = 0;
        const itens = itensDe(raiz).map(el => {
          if (!el.classList.contains('grupo-f')) return lerCond(el, ++n);
          const nivel = el.querySelector('[data-nivel]');
          return { grupo: true, junta: juntaDoNivel(nivel), conds: itensDe(nivel).map(x => lerCond(x, ++n)) };
        });
        return { junta: juntaDoNivel(raiz), itens };
      };
      const montar = () => aba === 'avancado' ? $('f-expr').value.trim() : M.montarFiltro(lerModelo(), tipos);
      // Primeiro item de cada nível mostra "Onde"; os outros, o seletor E/OU com o conector do nível
      const arrumarNivel = nivel => {
        const j = juntaDoNivel(nivel);
        itensDe(nivel).forEach((el, i) => {
          const atual = el.querySelector(':scope > .cond-junta');
          const html = juntaHtml(i === 0, j);
          if (i === 0 && atual.tagName !== 'SPAN') atual.outerHTML = html;
          if (i > 0 && atual.tagName === 'SPAN') atual.outerHTML = html;
          if (i > 0) el.querySelector(':scope > .cond-junta').value = j;
        });
      };
      const arrumarTudo = () => { arrumarNivel(raiz); raiz.querySelectorAll('.grupo-f [data-nivel]').forEach(arrumarNivel); };
      const mostrarValores = (el, filtrarPorTexto) => {
        const lista = el.querySelector('.cond-sugestoes'); const input = campo(el, 'val');
        if (input.disabled) return;
        const q = filtrarPorTexto ? input.value.trim().toLowerCase() : '';
        const vals = valoresDe(campo(el, 'col').value).filter(v => !q || v.toLowerCase().includes(q)).slice(0, 80);
        lista.innerHTML = vals.length ? vals.map(v => `<li role="option" data-valor="${esc(v)}" class="${v === input.value ? 'on' : ''}">${esc(v)}</li>`).join('') : '<li class="vazio">Nenhum valor com esse texto</li>';
        lista.hidden = false;
      };
      const fecharValores = () => raiz.querySelectorAll('.cond-sugestoes').forEach(l => { l.hidden = true; });
      const atualizar = () => {
        const conds = [...raiz.querySelectorAll('.cond')];
        conds.forEach(el => {
          const col = campo(el, 'col').value; const op = M.OPERADORES[campo(el, 'op').value];
          const val = campo(el, 'val'); const tipo = tipos[col];
          val.disabled = op.semValor; el.querySelector('[data-abrir-valores]').disabled = op.semValor;
          val.placeholder = op.semValor ? '—' : tipo === 'data' ? 'dd/mm/aaaa' : tipo === 'hora' ? 'hh:mm' : tipo === 'inteiro' || tipo === 'decimal' ? 'ex.: 40' : 'escolha ou digite';
          el.classList.toggle('incompleta', !op.semValor && val.value.trim() === '');
          el.querySelector('[data-remover-cond]').hidden = conds.length === 1;
        });
        try {
          const expr = montar();
          if (!expr) { $('f-res').className = 'resultado'; $('f-res').textContent = 'Escreva a condição.'; return; }
          const arvore = M.analisar(expr.replace(/^each\s+/, ''));
          M.colunasUsadas(arvore).forEach(x => { if (!tipos[x]) throw new M.FalhaEtapa(`A coluna "${x}" não existe nesta etapa.`); });
          const objeto = l => Object.fromEntries(t.colunas.map((x, k) => [x.nome, l[k]]));
          let ficam = 0;
          for (const l of t.linhas) { const r = M.avaliar(arvore, objeto(l)); if (M.ehErro(r)) throw new M.FalhaEtapa(r.mensagem); if (r === true) ficam++; }
          const modelo = aba === 'basico' ? lerModelo() : M.lerFiltro(expr);
          $('f-res').className = 'resultado ' + (ficam ? 'ok' : 'ruim');
          $('f-res').innerHTML = `${modelo ? `<div class="lendo"><span>Lendo como:</span> ${esc(M.lerFiltroEmPortugues(modelo))}</div>` : ''}
            Ficam <b>${ficam.toLocaleString('pt-BR')}</b> de ${t.linhas.length.toLocaleString('pt-BR')} linhas.${ficam ? '' : ' Nenhuma linha atende: confira os valores, o E/OU e os grupos.'}<br><span class="mono">Table.SelectRows(..., each ${esc(expr.replace(/^each\s+/, ''))})</span>`;
        } catch (e) { $('f-res').className = 'resultado ruim'; $('f-res').textContent = e.message; }
      };
      const colunaPadrao = () => { const todas = raiz.querySelectorAll('.cond'); return todas.length ? campo(todas[todas.length - 1], 'col').value : pre; };
      $('f-mais').addEventListener('click', () => {
        raiz.insertAdjacentHTML('beforeend', htmlCond({ coluna: colunaPadrao(), operador: 'igual', valor: '' }, false, juntaDoNivel(raiz)));
        arrumarTudo(); campo(itensDe(raiz).pop(), 'val').focus(); atualizar();
      });
      $('f-grupo').addEventListener('click', () => {
        const juntaFora = itensDe(raiz).length > 1 ? juntaDoNivel(raiz) : 'and';
        const col = colunaPadrao();
        raiz.insertAdjacentHTML('beforeend', htmlGrupo({ junta: juntaFora === 'and' ? 'or' : 'and', conds: [{ coluna: col, operador: 'igual', valor: '' }, { coluna: col, operador: 'igual', valor: '' }] }, false, juntaFora));
        arrumarTudo(); const g = itensDe(raiz).pop(); g.querySelector('[data-campo="val"]').focus(); atualizar();
      });
      raiz.addEventListener('click', ev => {
        const xc = ev.target.closest('[data-remover-cond]');
        if (xc) {
          const el = xc.closest('.cond'); const grupo = el.closest('.grupo-f'); el.remove();
          if (grupo && !grupo.querySelector('.cond')) grupo.remove();
          arrumarTudo(); return atualizar();
        }
        const xg = ev.target.closest('[data-remover-grupo]');
        if (xg) { xg.closest('.grupo-f').remove(); if (!raiz.querySelector('.cond')) raiz.insertAdjacentHTML('beforeend', htmlCond({ coluna: pre, operador: 'igual', valor: '' }, true, 'and')); arrumarTudo(); return atualizar(); }
        const mg = ev.target.closest('[data-mais-no-grupo]');
        if (mg) {
          const nivel = mg.closest('.grupo-caixa').querySelector('[data-nivel]');
          nivel.insertAdjacentHTML('beforeend', htmlCond({ coluna: colunaPadrao(), operador: 'igual', valor: '' }, false, juntaDoNivel(nivel)));
          arrumarTudo(); campo(itensDe(nivel).pop(), 'val').focus(); return atualizar();
        }
        const abrir = ev.target.closest('[data-abrir-valores]');
        if (abrir) { const el = abrir.closest('.cond'); const l = el.querySelector('.cond-sugestoes'); if (l.hidden) { fecharValores(); mostrarValores(el, false); campo(el, 'val').focus(); } else l.hidden = true; }
      });
      // trocar o E/OU de uma linha troca o das outras do mesmo nível
      raiz.addEventListener('change', ev => {
        if (ev.target.matches('[data-campo="junta"]')) {
          const nivel = ev.target.closest('[data-nivel]');
          itensDe(nivel).forEach(el => { const s = el.querySelector(':scope > [data-campo="junta"]'); if (s) s.value = ev.target.value; });
        }
        if (ev.target.matches('[data-campo="col"]')) campo(ev.target.closest('.cond'), 'val').value = '';
      });
      raiz.addEventListener('mousedown', ev => {
        const li = ev.target.closest('[data-valor]'); if (!li) return;
        ev.preventDefault();
        const el = li.closest('.cond'); campo(el, 'val').value = li.dataset.valor;
        fecharValores(); atualizar();
      });
      raiz.addEventListener('focusin', ev => { if (ev.target.matches('[data-campo="val"]')) { fecharValores(); mostrarValores(ev.target.closest('.cond'), false); } });
      raiz.addEventListener('focusout', ev => { if (ev.target.matches('[data-campo="val"]')) setTimeout(() => { const el = ev.target.closest('.cond'); if (el && !el.contains(document.activeElement)) el.querySelector('.cond-sugestoes').hidden = true; }, 120); });
      raiz.addEventListener('input', ev => { if (ev.target.matches('[data-campo="val"]')) mostrarValores(ev.target.closest('.cond'), true); });
      raiz.addEventListener('keydown', ev => { if (ev.key === 'Escape' && ev.target.matches('[data-campo="val"]')) { ev.stopPropagation(); fecharValores(); } });
      $('modal-corpo').querySelectorAll('[data-aba]').forEach(b => b.addEventListener('click', () => {
        if (b.dataset.aba === 'avancado' && aba === 'basico') { try { const e = montar(); if (e && !$('f-expr').value.trim()) $('f-expr').value = 'each ' + e; } catch { /* formulário incompleto: começa vazio */ } }
        if (b.dataset.aba === 'basico' && aba === 'avancado' && $('f-expr').value.trim()) {
          const f = M.lerFiltro($('f-expr').value.trim());
          if (!f) { $('f-res').className = 'resultado ruim'; $('f-res').textContent = 'Esta condição em M não cabe no modo Básico (tem grupo dentro de grupo ou funções diferentes). Continue no Avançado.'; return; }
          raiz.innerHTML = htmlFiltro(f);
        }
        aba = b.dataset.aba;
        $('modal-corpo').querySelectorAll('[data-aba]').forEach(x => x.classList.toggle('on', x === b));
        $('aba-basico').hidden = aba !== 'basico'; $('aba-avancado').hidden = aba !== 'avancado';
        atualizar();
      }));
      $('modal-corpo').addEventListener('input', atualizar);
      $('modal-corpo').addEventListener('change', atualizar);
      ui.montarFiltro = montar;
      arrumarTudo(); atualizar();
    },
    aoConfirmar() {
      let expr;
      try { expr = ui.montarFiltro(); } catch (e) { return e.message; }
      if (!expr) return 'Escreva a condição do filtro.';
      M.analisar(expr.replace(/^each\s+/, ''));
      if ($('f-res').classList.contains('ruim') && !/Ficam/.test($('f-res').textContent)) return $('f-res').textContent;
      const nova = expr.replace(/^each\s+/, '');
      if (!editando) return adicionarEtapa({ tipo: 'filtrar', expr: nova });
      c.etapas[idx] = { ...c.etapas[idx], expr: nova };
      ui.msgCelula = ''; salvar(); render();
      const falha = exec(c).erro;
      aviso(falha ? `Filtro "${c.etapas[idx].nome}" salvo, mas a etapa "${falha.etapa}" ficou com erro.` : `Filtro "${c.etapas[idx].nome}" atualizado.`, falha ? 'erro' : 'ok');
    },
  });
}

// Tipo de dados: troca o tipo de várias colunas de uma vez
function janelaTipos() {
  const t = tabelaEntrada();
  const opcoes = sel => Object.entries(M.TIPOS).filter(([k]) => k !== 'tabela' || sel === 'tabela').map(([k, tp]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${tp.rotulo}</option>`).join('');
  abrirJanela({
    titulo: 'Tipo de dados',
    corpo: `<p class="ajuda">Troque o tipo das colunas que precisarem. Valores que não combinam com o tipo viram <b>Error</b> na célula, e a linha continua (no M: Table.TransformColumnTypes).</p>
      <table class="tabela-form"><thead><tr><th>Coluna</th><th>Tipo atual</th><th>Novo tipo</th></tr></thead><tbody>
      ${t.colunas.map(c => `<tr data-col="${esc(c.nome)}" data-tipo="${c.tipo}"><td>${esc(c.nome)}</td><td>${M.TIPOS[c.tipo].rotulo}</td><td><select aria-label="Novo tipo de ${esc(c.nome)}">${opcoes(c.tipo)}</select></td></tr>`).join('')}
      </tbody></table>`,
    aoAbrir() { $('modal-corpo').addEventListener('change', ev => { const tr = ev.target.closest('tr'); if (tr) tr.classList.toggle('mudou', ev.target.value !== tr.dataset.tipo); }); },
    aoConfirmar() {
      const lista = [...$('modal-corpo').querySelectorAll('tbody tr')].filter(tr => tr.querySelector('select').value !== tr.dataset.tipo).map(tr => [tr.dataset.col, tr.querySelector('select').value]);
      if (!lista.length) return 'Nenhum tipo foi trocado.';
      adicionarEtapa({ tipo: 'tipos', lista });
    },
  });
}

// Renomear colunas
function janelaRenomear(pre) {
  const t = tabelaEntrada();
  abrirJanela({
    titulo: 'Renomear colunas',
    corpo: `<p class="ajuda">Escreva o novo nome só nas colunas que mudam (no M: Table.RenameColumns).</p>
      <table class="tabela-form"><thead><tr><th>Nome atual</th><th>Novo nome</th></tr></thead><tbody>
      ${t.colunas.map(c => `<tr data-col="${esc(c.nome)}"><td>${esc(c.nome)}</td><td><input type="text" value="${esc(c.nome)}" aria-label="Novo nome de ${esc(c.nome)}" ${c.nome === pre ? 'data-pre' : ''}></td></tr>`).join('')}
      </tbody></table>`,
    aoAbrir() {
      const p = $('modal-corpo').querySelector('[data-pre]'); if (p) setTimeout(() => { p.focus(); p.select(); }, 0);
      $('modal-corpo').addEventListener('input', ev => { const tr = ev.target.closest('tr'); tr.classList.toggle('mudou', ev.target.value.trim() !== tr.dataset.col); });
    },
    aoConfirmar() {
      const linhas = [...$('modal-corpo').querySelectorAll('tbody tr')];
      const pares = linhas.map(tr => [tr.dataset.col, tr.querySelector('input').value.trim()]).filter(([a, b]) => a !== b);
      if (!pares.length) return 'Nenhum nome foi trocado.';
      if (pares.some(([, b]) => !b)) return 'Um nome ficou vazio.';
      const finais = linhas.map(tr => tr.querySelector('input').value.trim());
      const rep = finais.find((n, i) => finais.indexOf(n) !== i);
      if (rep) return `Duas colunas ficariam com o nome "${rep}".`;
      adicionarEtapa({ tipo: 'renomear', pares });
    },
  });
}

// Coluna personalizada: nome, fórmula em M com ajuda de colunas e funções, e prévia ao vivo
function janelaPersonalizada() {
  const t = tabelaEntrada();
  const grupos = {};
  Object.entries(M.FUNCOES_M).forEach(([nome, f]) => { (grupos[f.grupo] = grupos[f.grupo] || []).push(nome); });
  const opcoesTipo = Object.entries(M.TIPOS).filter(([k]) => k !== 'tabela').map(([k, tp]) => `<option value="${k}" ${k === 'qualquer' ? 'selected' : ''}>${tp.rotulo}</option>`).join('');
  abrirJanela({
    titulo: 'Coluna personalizada', largo: true, ok: 'Criar coluna',
    corpo: `<div class="linha-form" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr)">
        <div class="campo"><label for="p-nome">Nome da nova coluna</label><input type="text" id="p-nome" value="${esc(M.nomeUnico(t.colunas.map(c => ({ nome: c.nome })), 'Personalizar'))}"></div>
        <div class="campo"><label for="p-tipo">Tipo</label><select id="p-tipo">${opcoesTipo}</select></div>
      </div>
      <div class="personalizada">
        <div class="campo"><span class="rotulo">Colunas (clique para inserir)</span>
          <div class="lista-mini">${t.colunas.map(c => `<button type="button" data-inserir="[${esc(c.nome)}]">${esc(c.nome)} <small>${M.TIPOS[c.tipo].icone}</small></button>`).join('')}</div></div>
        <div class="campo"><label for="p-expr">Fórmula <span class="mono" style="color:var(--muted)">= each …</span></label>
          <textarea id="p-expr" spellcheck="false" style="min-height:150px" placeholder="[TEMPO_FALADO_S] / [CHAMADAS]"></textarea>
          <p class="ajuda">Colunas entre colchetes. Contas com + − * /, textos entre aspas e juntados com &amp;, e if … then … else … para condições.</p>
          <div class="resultado" id="p-res">A prévia das 5 primeiras linhas aparece aqui.</div></div>
        <div class="campo"><span class="rotulo">Funções (clique para inserir)</span>
          <div class="lista-mini" id="p-funcoes">${Object.entries(grupos).map(([g, nomes]) => `<div class="grupo">${esc(g)}</div>${nomes.map(n => `<button type="button" data-funcao="${esc(n)}">${esc(n)}</button>`).join('')}`).join('')}</div>
          <div class="ajuda-funcao" id="p-ajuda">Passe o mouse ou clique numa função para ver para que ela serve.</div></div>
      </div>`,
    aoAbrir() {
      const area = $('p-expr');
      const inserir = txt => { const a = area.selectionStart, b = area.selectionEnd; area.value = area.value.slice(0, a) + txt + area.value.slice(b); area.focus(); const pos = a + txt.length; area.setSelectionRange(pos, pos); previa(); };
      const ajuda = nome => { const f = M.FUNCOES_M[nome]; $('p-ajuda').innerHTML = `<code>${esc(f.sintaxe)}</code><span>${esc(f.descricao)}</span><span class="excel">No Excel: ${esc(f.excel)}</span><span class="mono" style="font-size:var(--fs-11)">${esc(f.exemplo)}</span>`; };
      const previa = () => {
        const expr = area.value.trim();
        if (!expr) { $('p-res').className = 'resultado'; $('p-res').textContent = 'A prévia das 5 primeiras linhas aparece aqui.'; return; }
        try {
          const tipo = $('p-tipo').value;
          const vals = M.testarExpressao(t, expr).map(v => (tipo === 'qualquer' || M.ehErro(v) ? v : M.converter(v, tipo)));
          const erro = vals.find(M.ehErro);
          $('p-res').className = 'resultado ' + (erro ? 'ruim' : 'ok');
          $('p-res').innerHTML = (erro ? esc(erro.mensagem) : 'Prévia:') + `<table>${vals.map((v, i) => `<tr><td>Linha ${i + 1}</td><td><b>${esc(M.ehErro(v) ? 'Error' : M.formatar(v, tipo))}</b></td></tr>`).join('')}</table>`;
        } catch (e) { $('p-res').className = 'resultado ruim'; $('p-res').textContent = e.message; }
      };
      $('modal-corpo').querySelectorAll('[data-inserir]').forEach(b => b.addEventListener('click', () => inserir(b.dataset.inserir)));
      $('p-funcoes').querySelectorAll('[data-funcao]').forEach(b => {
        b.addEventListener('mouseenter', () => ajuda(b.dataset.funcao));
        b.addEventListener('focus', () => ajuda(b.dataset.funcao));
        b.addEventListener('click', () => { ajuda(b.dataset.funcao); inserir(b.dataset.funcao + '('); });
      });
      area.addEventListener('input', previa);
      $('p-tipo').addEventListener('change', previa);
    },
    aoConfirmar() {
      const coluna = $('p-nome').value.trim(); const expr = $('p-expr').value.trim().replace(/^each\s+/, '');
      if (!coluna) return 'Dê um nome à coluna.';
      if (t.colunas.some(c => c.nome === coluna)) return `Já existe uma coluna chamada "${coluna}".`;
      if (!expr) return 'Escreva a fórmula da coluna.';
      M.testarExpressao(t, expr, 1);
      adicionarEtapa({ tipo: 'adicionar', coluna, expr, tipoColuna: $('p-tipo').value });
    },
  });
}

// Outras consultas que esta pode usar (sem ela mesma e sem quem já depende dela, para não fazer ciclo)
function outrasConsultas(c) {
  const dependem = new Set();
  const marcar = nome => ui.consultas.forEach(q => { if (!dependem.has(q.nome) && q.etapas.some(e => usaConsulta(e, nome))) { dependem.add(q.nome); marcar(q.nome); } });
  marcar(c.nome);
  return ui.consultas.filter(q => q.id !== c.id && !dependem.has(q.nome));
}

// Bloco "colunas que vêm da outra consulta": marcar, nome final editável, prefixo opcional (desligado)
function htmlColunasExpandir(origem, { marcadas, nomes, prefixo }) {
  return `<div class="campo">
    <div class="exp-topo"><span class="rotulo">Colunas que vêm da outra consulta</span>
      <span class="acoes"><button class="btn peq" type="button" data-exp-todas>Marcar todas</button><button class="btn peq" type="button" data-exp-nenhuma>Desmarcar todas</button></span></div>
    <label class="ajuda exp-prefixo"><input type="checkbox" id="exp-prefixo" ${prefixo ? 'checked' : ''}> Pôr o nome da consulta na frente (ex.: <span class="mono">quadro.NOME</span>)</label>
    <div class="exp-tabela"><table class="tabela-form" id="exp-cols"><thead><tr><th style="width:36px"></th><th>Coluna na outra consulta</th><th>Nome na tabela final</th></tr></thead><tbody>
      ${origem.map(x => { const ok = marcadas.includes(x.nome); return `<tr data-col="${esc(x.nome)}" class="${ok ? '' : 'desligada'}"><td><input type="checkbox" ${ok ? 'checked' : ''} aria-label="Trazer ${esc(x.nome)}"></td><td>${esc(x.nome)} <small class="mono">${M.TIPOS[x.tipo].icone}</small></td><td><input type="text" value="${esc(nomes[x.nome] || x.nome)}" ${ok ? '' : 'disabled'} aria-label="Nome final de ${esc(x.nome)}" ${nomes[x.nome] && nomes[x.nome] !== x.nome && !prefixo ? 'data-mexido="1"' : ''}></td></tr>`; }).join('')}
    </tbody></table></div>
  </div>`;
}
// Liga os botões do bloco. "aoMudar" roda a cada mudança (para refazer a prévia).
function ligarColunasExpandir(nomeConsulta, aoMudar) {
  const linhas = () => [...$('exp-cols').querySelectorAll('tbody tr')];
  const sugerido = col => ($('exp-prefixo').checked ? `${nomeConsulta()}.${col}` : col);
  const marcar = (tr, ok) => { tr.querySelector('input[type=checkbox]').checked = ok; tr.classList.toggle('desligada', !ok); tr.querySelector('input[type=text]').disabled = !ok; };
  $('modal-corpo').querySelector('[data-exp-todas]').addEventListener('click', () => { linhas().forEach(tr => marcar(tr, true)); aoMudar(); });
  $('modal-corpo').querySelector('[data-exp-nenhuma]').addEventListener('click', () => { linhas().forEach(tr => marcar(tr, false)); aoMudar(); });
  $('exp-prefixo').addEventListener('change', () => { linhas().forEach(tr => { const i = tr.querySelector('input[type=text]'); if (!i.dataset.mexido) i.value = sugerido(tr.dataset.col); }); aoMudar(); });
  $('exp-cols').addEventListener('change', ev => { if (ev.target.type === 'checkbox') { marcar(ev.target.closest('tr'), ev.target.checked); aoMudar(); } });
  $('exp-cols').addEventListener('input', ev => { if (ev.target.type === 'text') { ev.target.dataset.mexido = '1'; aoMudar(); } });
  return { refazerNomes: () => linhas().forEach(tr => { const i = tr.querySelector('input[type=text]'); if (!i.dataset.mexido) i.value = sugerido(tr.dataset.col); }) };
}
// Lê o bloco: { colunas, novos }. Confere nomes vazios e repetidos (entre si e com as colunas que já existem).
function lerColunasExpandir(existentes) {
  const marcadas = [...$('exp-cols').querySelectorAll('tbody tr')].filter(tr => tr.querySelector('input[type=checkbox]').checked);
  $('exp-cols').querySelectorAll('tr.conflito').forEach(tr => tr.classList.remove('conflito'));
  const colunas = marcadas.map(tr => tr.dataset.col);
  const novos = marcadas.map(tr => tr.querySelector('input[type=text]').value.trim());
  const vazio = novos.findIndex(n => !n);
  if (vazio >= 0) { marcadas[vazio].classList.add('conflito'); throw new M.FalhaEtapa(`A coluna "${colunas[vazio]}" está sem nome final.`); }
  const k = novos.findIndex((n, i) => existentes.includes(n) || novos.indexOf(n) !== i);
  if (k >= 0) { marcadas[k].classList.add('conflito'); throw new M.FalhaEtapa(`O nome "${novos[k]}" já existe na tabela. Troque o nome final ou ligue o prefixo da consulta.`); }
  return { colunas, novos };
}

// Mesclar consultas: liga esta consulta a outra pelas colunas-chave (como o PROCV, mas trazendo várias colunas)
function janelaMesclar() {
  const c = atual(); const t = tabelaEntrada();
  const outras = outrasConsultas(c);
  if (!outras.length) return aviso('Não há outra consulta para mesclar. Crie uma em + Nova consulta (ex.: quadro.csv).', 'erro');
  const opcoesJ = Object.entries(M.JUNCOES).map(([k, j]) => `<option value="${k}">${j.rotulo}</option>`).join('');
  abrirJanela({
    titulo: 'Mesclar consultas', largo: true, ok: 'Mesclar',
    corpo: `<p class="ajuda">Junta cada linha desta consulta com as linhas da outra que têm o <b>mesmo valor nas colunas-chave</b>, como um PROCV que traz várias colunas de uma vez (no M: Table.NestedJoin + Table.ExpandTableColumn).</p>
      <div class="linha-form" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
        <div class="campo"><span class="rotulo">Esta consulta</span><div class="resultado"><b>${esc(c.nome)}</b> · ${t.linhas.length.toLocaleString('pt-BR')} linhas</div></div>
        <div class="campo"><label for="m-outra">Mesclar com</label><select id="m-outra">${outras.map(q => `<option value="${esc(q.nome)}">${esc(q.nome)}</option>`).join('')}</select></div>
      </div>
      <div class="campo"><span class="rotulo">Colunas-chave (o valor precisa ser igual dos dois lados)</span><div id="m-pares" class="conds"></div>
        <div><button class="btn peq" type="button" id="m-mais-chave">+ Outra chave</button></div></div>
      <div class="linha-form" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr)">
        <div class="campo"><label for="m-juncao">Tipo de junção</label><select id="m-juncao">${opcoesJ}</select></div>
        <p class="ajuda" id="m-juncao-ajuda" style="align-self:end"></p>
      </div>
      <div id="m-cols"></div>
      <div class="resultado" id="m-res">—</div>`,
    aoAbrir() {
      const outraTab = () => { const q = ui.consultas.find(x => x.nome === $('m-outra').value); const r = exec(q); return r.tabela; };
      const parHtml = (esq, dir, tabDir) => `<div class="par-chave"><select data-lado="esq" aria-label="Coluna desta consulta">${opcoesColunas(t, esq)}</select><span>=</span><select data-lado="dir" aria-label="Coluna da outra consulta">${tabDir ? opcoesColunas(tabDir, dir) : ''}</select><button class="cond-x" type="button" data-remover-par aria-label="Remover esta chave">×</button></div>`;
      const montarTela = () => {
        const td = outraTab();
        if (!td) { $('m-res').className = 'resultado ruim'; $('m-res').textContent = `A consulta "${$('m-outra').value}" está com erro. Corrija-a antes de mesclar.`; $('m-pares').innerHTML = ''; $('m-cols').innerHTML = ''; return; }
        const comum = t.colunas.map(x => x.nome).filter(n => td.colunas.some(y => y.nome === n));
        const chave = comum.find(n => /MATRICULA|CODIGO|CÓDIGO|ID/i.test(n)) || comum[0] || t.colunas[0].nome;
        $('m-pares').innerHTML = parHtml(chave, td.colunas.some(y => y.nome === chave) ? chave : td.colunas[0].nome, td);
        // já vem desmarcada a chave e qualquer coluna com nome igual a uma desta consulta (evita repetir)
        const marcadas = td.colunas.map(x => x.nome).filter(n => n !== chave && !t.colunas.some(y => y.nome === n));
        $('m-cols').innerHTML = htmlColunasExpandir(td.colunas, { marcadas, nomes: {}, prefixo: false });
        ligarColunasExpandir(() => $('m-outra').value, atualizar);
        atualizar();
      };
      const pares = () => [...$('m-pares').querySelectorAll('.par-chave')].map(el => [el.querySelector('[data-lado=esq]').value, el.querySelector('[data-lado=dir]').value]);
      const etapas = () => {
        const nomeOutra = $('m-outra').value; const ps = pares();
        const usadas = new Set(t.colunas.map(x => x.nome));
        let coluna = nomeOutra; let n = 2; while (usadas.has(coluna)) coluna = `${nomeOutra} (${n++})`;
        const { colunas: cols, novos } = lerColunasExpandir(t.colunas.map(x => x.nome));
        const lista = [{ tipo: 'mesclar', chaves: ps.map(p => p[0]), consulta: nomeOutra, chavesOutra: ps.map(p => p[1]), coluna, juncao: $('m-juncao').value }];
        if (cols.length) lista.push({ tipo: 'expandir', nomeBase: `${coluna} Expandido`, coluna, colunas: cols, novos });
        return lista;
      };
      const atualizar = () => {
        $('m-juncao-ajuda').textContent = M.JUNCOES[$('m-juncao').value].ajuda;
        $('modal-corpo').querySelectorAll('[data-remover-par]').forEach(b => { b.hidden = pares().length === 1; });
        try {
          const lista = etapas();
          // prévia: roda a consulta com a etapa de mesclar no lugar
          const copia = JSON.parse(JSON.stringify(c)); copia.etapas = copia.etapas.slice(0, indiceEtapa() + 1);
          M.inserirEtapa(copia, lista[0]);
          const r = M.executar(copia, undefined, ui.consultas.map(q => (q.id === c.id ? copia : q)));
          if (r.erro) throw new M.FalhaEtapa(r.erro.mensagem);
          const tb = r.tabela; const k = tb.colunas.length - 1;
          const qtd = l => (l[k] && l[k].aninhada ? l[k].aninhada.linhas.length : 0);
          const achou = tb.linhas.filter(l => qtd(l) > 0).length, varias = tb.linhas.filter(l => qtd(l) > 1).length;
          const j = $('m-juncao').value;
          $('m-res').className = 'resultado ' + (achou || j === 'LeftAnti' ? 'ok' : 'ruim');
          $('m-res').innerHTML = `${j === 'LeftAnti' || j === 'RightAnti' ? `Ficam <b>${tb.linhas.length.toLocaleString('pt-BR')}</b> linhas sem par.` : `<b>${achou.toLocaleString('pt-BR')}</b> de ${tb.linhas.length.toLocaleString('pt-BR')} linhas acharam par em <b>${esc($('m-outra').value)}</b> (${tb.linhas.length ? Math.round(achou / tb.linhas.length * 100) : 0}%).`}
            ${varias ? `<br>${varias.toLocaleString('pt-BR')} linha(s) acharam mais de um par: ao expandir, elas vão se repetir uma vez para cada par.` : ''}
            ${!achou && j !== 'LeftAnti' && j !== 'RightAnti' ? '<br>Nenhuma linha combinou: confira se as colunas-chave têm o mesmo conteúdo e o mesmo tipo (texto com texto, número com número).' : ''}`;
        } catch (e) { $('m-res').className = 'resultado ruim'; $('m-res').textContent = e.message; }
      };
      $('m-outra').addEventListener('change', montarTela);
      $('m-mais-chave').addEventListener('click', () => { $('m-pares').insertAdjacentHTML('beforeend', parHtml(t.colunas[0].nome, null, outraTab())); atualizar(); });
      $('m-pares').addEventListener('click', ev => { const x = ev.target.closest('[data-remover-par]'); if (x) { x.closest('.par-chave').remove(); atualizar(); } });
      $('modal-corpo').addEventListener('change', ev => { if (ev.target.id !== 'm-outra' && !ev.target.closest('#m-cols')) atualizar(); });
      ui.etapasMesclar = etapas;
      montarTela();
    },
    aoConfirmar() {
      if ($('m-res').classList.contains('ruim') && !/acharam par|Nenhuma linha combinou/.test($('m-res').textContent)) return $('m-res').textContent;
      const lista = ui.etapasMesclar();
      if (lista.length === 1) aviso('Nenhuma coluna marcada: a coluna de tabelas ficou na consulta. Use ✎ na etapa para escolher depois, ou "Expandir".', 'ok', 5000);
      adicionarEtapa(lista);
    },
  });
}

// Acrescentar consultas: põe as linhas de outras consultas embaixo desta (como colar uma tabela embaixo da outra)
function janelaAcrescentar() {
  const c = atual(); const t = tabelaEntrada();
  const outras = outrasConsultas(c);
  if (!outras.length) return aviso('Não há outra consulta para acrescentar. Crie uma em + Nova consulta.', 'erro');
  abrirJanela({
    titulo: 'Acrescentar consultas', ok: 'Acrescentar',
    corpo: `<p class="ajuda">As linhas das consultas marcadas vão para baixo das linhas desta. Colunas com o <b>mesmo nome</b> se juntam; as que só existem em uma ficam vazias (null) nas outras (no M: Table.Combine).</p>
      <div class="checks" id="a-lista">${outras.map(q => `<label><input type="checkbox" value="${esc(q.nome)}"> ${esc(q.nome)}</label>`).join('')}</div>
      <div class="resultado" id="a-res">Marque pelo menos uma consulta.</div>`,
    aoAbrir() {
      const atualizar = () => {
        const nomes = [...$('a-lista').querySelectorAll('input:checked')].map(x => x.value);
        if (!nomes.length) { $('a-res').className = 'resultado'; $('a-res').textContent = 'Marque pelo menos uma consulta.'; return; }
        const tabs = nomes.map(n => [n, exec(ui.consultas.find(q => q.nome === n)).tabela]);
        const ruim = tabs.find(([, tb]) => !tb); if (ruim) { $('a-res').className = 'resultado ruim'; $('a-res').textContent = `A consulta "${ruim[0]}" está com erro.`; return; }
        const todas = [t, ...tabs.map(([, tb]) => tb)];
        const nomesCol = [...new Set(todas.flatMap(tb => tb.colunas.map(x => x.nome)))];
        const parciais = nomesCol.filter(n => !todas.every(tb => tb.colunas.some(x => x.nome === n)));
        const total = todas.reduce((s2, tb) => s2 + tb.linhas.length, 0);
        $('a-res').className = 'resultado ok';
        $('a-res').innerHTML = `Ficam <b>${total.toLocaleString('pt-BR')}</b> linhas e <b>${nomesCol.length}</b> colunas.${parciais.length ? `<br>Colunas que não existem em todas (ficam vazias onde faltam): ${parciais.map(esc).join(', ')}.` : ''}`;
      };
      $('a-lista').addEventListener('change', atualizar);
    },
    aoConfirmar() {
      const nomes = [...$('a-lista').querySelectorAll('input:checked')].map(x => x.value);
      if (!nomes.length) return 'Marque pelo menos uma consulta.';
      adicionarEtapa({ tipo: 'acrescentar', consultas: nomes });
    },
  });
}

// Agrupar por: resume as linhas por grupo, como uma tabela dinâmica
function janelaAgrupar(pre) {
  const t = tabelaEntrada();
  const tipoDe = n => (t.colunas.find(x => x.nome === n) || {}).tipo;
  const textoPadrao = pre || (t.colunas.find(x => x.tipo === 'texto') || t.colunas[0]).nome;
  const numPadrao = (t.colunas.find(x => x.tipo === 'inteiro' || x.tipo === 'decimal') || t.colunas[0]).nome;
  const opsHtml = sel => Object.entries(M.AGREGACOES).map(([k, a]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${a.rotulo}</option>`).join('');
  const chaveHtml = col => `<div class="par-chave"><select data-chave aria-label="Agrupar por">${opcoesColunas(t, col)}</select><button class="cond-x" type="button" data-remover aria-label="Remover">×</button></div>`;
  const agHtml = (nome, op, col) => `<div class="ag-linha"><input type="text" data-ag="nome" value="${esc(nome)}" aria-label="Nome da nova coluna"><select data-ag="op" aria-label="Operação">${opsHtml(op)}</select><select data-ag="col" aria-label="Coluna">${opcoesColunas(t, col)}</select><button class="cond-x" type="button" data-remover aria-label="Remover">×</button></div>`;
  abrirJanela({
    titulo: 'Agrupar por', largo: true, ok: 'Agrupar',
    corpo: `<p class="ajuda">Junta as linhas que têm os mesmos valores nas colunas de grupo e calcula um resumo para cada grupo, como uma tabela dinâmica (no M: Table.Group). As outras colunas saem.</p>
      <div class="campo"><span class="rotulo">Agrupar por</span><div id="g-chaves" class="conds">${chaveHtml(textoPadrao)}</div><div><button class="btn peq" type="button" id="g-mais-chave">+ Outra coluna de grupo</button></div></div>
      <div class="campo"><span class="rotulo">Novas colunas (nome · operação · coluna)</span><div id="g-ags" class="conds">${agHtml('Contagem', 'contar', numPadrao)}${agHtml(`Soma de ${numPadrao}`, 'soma', numPadrao)}</div><div><button class="btn peq" type="button" id="g-mais-ag">+ Outra conta</button></div></div>
      <div class="resultado" id="g-res">—</div>`,
    aoAbrir() {
      const ler = () => {
        const chaves = [...$('g-chaves').querySelectorAll('[data-chave]')].map(x => x.value);
        if (new Set(chaves).size !== chaves.length) throw new M.FalhaEtapa('A mesma coluna aparece duas vezes em "Agrupar por".');
        const agregacoes = [...$('g-ags').querySelectorAll('.ag-linha')].map(el => {
          const op = el.querySelector('[data-ag=op]').value; const col = el.querySelector('[data-ag=col]').value;
          const nome = el.querySelector('[data-ag=nome]').value.trim();
          if (!nome) throw new M.FalhaEtapa('Uma das novas colunas está sem nome.');
          return { nome, op, coluna: M.AGREGACOES[op].semColuna ? null : col, tipo: M.AGREGACOES[op].tipo(tipoDe(col)) };
        });
        const nomes = [...chaves, ...agregacoes.map(a => a.nome)]; const rep = nomes.find((n, i) => nomes.indexOf(n) !== i);
        if (rep) throw new M.FalhaEtapa(`O nome "${rep}" aparece duas vezes. Cada coluna do resultado precisa de um nome diferente.`);
        return { tipo: 'agrupar', chaves, agregacoes };
      };
      const atualizar = () => {
        $('g-ags').querySelectorAll('.ag-linha').forEach(el => { el.querySelector('[data-ag=col]').disabled = !!M.AGREGACOES[el.querySelector('[data-ag=op]').value].semColuna; });
        $('modal-corpo').querySelectorAll('#g-chaves [data-remover]').forEach(b => { b.hidden = $('g-chaves').children.length === 1; });
        try {
          const etapa = ler();
          const tb = M.ETAPAS.agrupar.executar(t, etapa);
          const prim = tb.linhas.slice(0, 5);
          $('g-res').className = 'resultado ok';
          $('g-res').innerHTML = `Ficam <b>${tb.linhas.length.toLocaleString('pt-BR')}</b> grupo(s) de ${t.linhas.length.toLocaleString('pt-BR')} linhas.<table><tr>${tb.colunas.map(x => `<td><b>${esc(x.nome)}</b></td>`).join('')}</tr>${prim.map(l => `<tr>${l.map((v, k) => `<td>${esc(M.formatar(v, tb.colunas[k].tipo))}</td>`).join('')}</tr>`).join('')}</table>`;
        } catch (e) { $('g-res').className = 'resultado ruim'; $('g-res').textContent = e.message; }
      };
      $('g-mais-chave').addEventListener('click', () => { $('g-chaves').insertAdjacentHTML('beforeend', chaveHtml(t.colunas[0].nome)); atualizar(); });
      $('g-mais-ag').addEventListener('click', () => { $('g-ags').insertAdjacentHTML('beforeend', agHtml(`Média de ${numPadrao}`, 'media', numPadrao)); atualizar(); });
      $('modal-corpo').addEventListener('click', ev => { const x = ev.target.closest('[data-remover]'); if (x) { const box = x.parentElement.parentElement; if (box.children.length > 1) { x.parentElement.remove(); atualizar(); } } });
      // trocar operação ou coluna sugere um nome novo, se o nome ainda era o sugerido
      $('g-ags').addEventListener('change', ev => {
        const el = ev.target.closest('.ag-linha'); if (!el || ev.target.matches('[data-ag=nome]')) return;
        const nome = el.querySelector('[data-ag=nome]'); const op = el.querySelector('[data-ag=op]').value; const col = el.querySelector('[data-ag=col]').value;
        if (!nome.dataset.mexido) nome.value = M.AGREGACOES[op].semColuna ? 'Contagem' : `${M.AGREGACOES[op].rotulo} de ${col}`;
      });
      $('g-ags').addEventListener('input', ev => { if (ev.target.matches('[data-ag=nome]')) ev.target.dataset.mexido = '1'; });
      $('modal-corpo').addEventListener('input', atualizar);
      $('modal-corpo').addEventListener('change', atualizar);
      ui.lerAgrupar = ler;
      atualizar();
    },
    aoConfirmar() { adicionarEtapa(ui.lerAgrupar()); },
  });
}

// Editar a etapa "Expandido": muda as colunas e os nomes sem refazer a mesclagem
function janelaEditarExpandir(i) {
  const c = atual(); const e = c.etapas[i];
  const antes = exec(c, i - 1);
  if (!antes.tabela) return aviso('A etapa anterior está com erro; corrija-a antes.', 'erro');
  const col = antes.tabela.colunas.find(x => x.nome === e.coluna);
  if (!col || !col.origem) return aviso(`A coluna de tabelas "${e.coluna}" não existe mais na etapa anterior.`, 'erro');
  const existentes = antes.tabela.colunas.map(x => x.nome).filter(n => n !== e.coluna);
  const prefixo = e.novos.length > 0 && e.novos.every((n, k) => n === `${e.coluna}.${e.colunas[k]}`);
  abrirJanela({
    titulo: `Editar colunas · ${e.nome}`, ok: 'Salvar', largo: true,
    corpo: `<p class="ajuda">Escolha quais colunas de <b>${esc(e.coluna)}</b> entram na tabela e com que nome (no M: Table.ExpandTableColumn).</p>
      ${htmlColunasExpandir(col.origem, { marcadas: e.colunas, nomes: Object.fromEntries(e.colunas.map((x, k) => [x, e.novos[k]])), prefixo })}
      <div class="resultado" id="x-res"></div>`,
    aoAbrir() {
      const conferir = () => { try { const r = lerColunasExpandir(existentes); $('x-res').className = 'resultado ok'; $('x-res').textContent = `${r.colunas.length} coluna(s) entram na tabela.`; } catch (er) { $('x-res').className = 'resultado ruim'; $('x-res').textContent = er.message; } };
      ligarColunasExpandir(() => e.coluna, conferir); conferir();
    },
    aoConfirmar() {
      const r = lerColunasExpandir(existentes);
      if (!r.colunas.length) return 'Marque pelo menos uma coluna. Para não trazer nenhuma, exclua a etapa no ×.';
      c.etapas[i] = { ...e, colunas: r.colunas, novos: r.novos };
      salvar(); render();
      const falha = exec(c).erro;
      aviso(falha ? `Etapa "${e.nome}" salva, mas a etapa "${falha.etapa}" ficou com erro (ela usava uma coluna que mudou de nome?).` : `Etapa "${e.nome}" atualizada.`, falha ? 'erro' : 'ok', 5000);
    },
  });
}

// Janela simples de confirmação (o navegador do artefato não mostra confirm())
function confirmar(titulo, texto, ok, acao) {
  abrirJanela({ titulo, ok, corpo: `<p style="margin:0">${texto}</p>`, aoConfirmar: () => { acao(); } });
}

/* ---------------- 6. ações ---------------- */
function adicionarEtapa(etapaOuLista) {
  ui.editandoFormula = false;
  const c = atual(); if (!c) return;
  const pos = indiceEtapa();
  const noFim = pos === c.etapas.length - 1;
  let novo = pos;
  (Array.isArray(etapaOuLista) ? etapaOuLista : [etapaOuLista]).forEach(e => { novo = M.inserirEtapa(c, e, novo); });
  ui.etapaSel = noFim ? null : novo;
  ui.msgCelula = '';
  salvar(); render();
  const nome = c.etapas[novo].nome;
  const falha = exec(c).erro;
  if (falha) aviso(`Etapa "${nome}" criada, mas a etapa "${falha.etapa}" ficou com erro. Clique nela para ver.`, 'erro', 6000);
  else if (!noFim) aviso(`Etapa "${nome}" inserida depois de "${c.etapas[pos].nome}". As etapas seguintes continuam na consulta.`);
  else aviso(`Etapa "${nome}" aplicada.`, 'ok', 2400);
}
function excluirEtapa(i) {
  const c = atual(); if (!c || i < 1) return;
  const nome = c.etapas[i].nome;
  const fazer = () => {
    c.etapas.splice(i, 1);
    if (ui.etapaSel !== null && ui.etapaSel >= i) ui.etapaSel = Math.max(0, ui.etapaSel - 1);
    if (ui.etapaSel !== null && ui.etapaSel >= c.etapas.length - 1) ui.etapaSel = null;
    salvar(); render();
    const falha = exec(c).erro;
    aviso(falha ? `Etapa "${nome}" excluída. A etapa "${falha.etapa}" dependia dela e agora está com erro.` : `Etapa "${nome}" excluída.`, falha ? 'erro' : 'ok', 5000);
  };
  if (i === c.etapas.length - 1) fazer();
  else confirmar('Excluir etapa', `Excluir a etapa <b>${esc(nome)}</b>? Ela está no meio da consulta, e as etapas seguintes podem depender dela.`, 'Excluir', fazer);
}
// Quais consultas usam uma consulta (em Mesclar ou Acrescentar)
const usaConsulta = (e, nome) => e.consulta === nome || (e.consultas || []).includes(nome);
const consultasQueUsam = nome => ui.consultas.filter(q => q.nome !== nome && q.etapas.some(e => usaConsulta(e, nome))).map(q => q.nome);
function excluirConsulta(id) {
  const c = ui.consultas.find(x => x.id === id); if (!c) return;
  const usadaPor = consultasQueUsam(c.nome);
  confirmar('Excluir consulta', `Excluir a consulta <b>${esc(c.nome)}</b> e todas as suas etapas?${usadaPor.length ? `<br><br>Atenção: ela é usada por <b>${usadaPor.map(esc).join(', ')}</b>, que vai(ão) ficar com erro.` : ''}`, 'Excluir', () => {
    ui.consultas = ui.consultas.filter(x => x.id !== id);
    ui.modelo.relacionamentos = ui.modelo.relacionamentos.filter(r => r.de.consulta !== c.nome && r.para.consulta !== c.nome);
    delete ui.modelo.posicoes[c.nome];
    if (ui.sel === id) { ui.sel = ui.consultas[0] ? ui.consultas[0].id : null; ui.etapaSel = null; }
    salvar(); render(); aviso(`Consulta "${c.nome}" excluída.`);
  });
}
function ferramenta(nome) {
  ui.editandoFormula = false;
  if (nome === 'nova') return janelaNova();
  if (nome === 'codigo') { ui.codigoAberto = !ui.codigoAberto; if (!ui.codigoAberto) ui.editandoCodigo = false; return render(); }
  if (nome === 'editor') { if (ui.editandoCodigo) { ui.editandoCodigo = false; return render(); } return abrirEditorAvancado(); }
  const res = resultadoAtual();
  if (!res || !res.tabela) return aviso('Abra uma consulta sem erro na etapa selecionada para usar as ferramentas.', 'erro');
  if (nome === 'escolher' || nome === 'remover') return janelaColunas(nome);
  if (nome === 'filtrar') return janelaFiltrar();
  if (nome === 'tipos') return janelaTipos();
  if (nome === 'renomear') return janelaRenomear();
  if (nome === 'adicionar') return janelaPersonalizada();
  if (nome === 'mesclar') return janelaMesclar();
  if (nome === 'acrescentar') return janelaAcrescentar();
  if (nome === 'agrupar') return janelaAgrupar();
}

/* ---------------- 7. início ---------------- */
document.addEventListener('click', ev => {
  const alvo = ev.target;
  const tl = alvo.closest('[data-tela]'); if (tl) { ui.tela = tl.dataset.tela; fecharMenuColuna(); return render(); }
  if (!alvo.closest('.menu-col') && !alvo.closest('[data-coluna]')) fecharMenuColuna();
  const f = alvo.closest('[data-ferr]'); if (f && !f.disabled) return ferramenta(f.dataset.ferr);
  const x1 = alvo.closest('[data-excluir-consulta]'); if (x1) { ev.stopPropagation(); return excluirConsulta(x1.dataset.excluirConsulta); }
  const ed = alvo.closest('[data-editar-etapa]'); if (ed) { ev.stopPropagation(); const c = atual(); const i = +ed.dataset.editarEtapa; ui.editandoFormula = false; ui.etapaSel = i === c.etapas.length - 1 ? null : i; render(); return c.etapas[i].tipo === 'expandir' ? janelaEditarExpandir(i) : janelaFiltrar(); }
  const x2 = alvo.closest('[data-excluir-etapa]'); if (x2) { ev.stopPropagation(); return excluirEtapa(+x2.dataset.excluirEtapa); }
  const lc = alvo.closest('[data-consulta]'); if (lc) { ui.editandoFormula = false; ui.editandoCodigo = false; ui.sel = lc.dataset.consulta; ui.etapaSel = null; ui.msgCelula = ''; salvar(); return render(); }
  const le = alvo.closest('[data-etapa]'); if (le) { ui.editandoFormula = false; const c = atual(); const i = +le.dataset.etapa; ui.etapaSel = i === c.etapas.length - 1 ? null : i; ui.msgCelula = ''; return render(); }
  const ir = alvo.closest('[data-ir-etapa]'); if (ir) { ui.etapaSel = +ir.dataset.irEtapa; return render(); }
  const col = alvo.closest('[data-coluna]'); if (col) return abrirMenuColuna(+col.dataset.coluna, col);
  const cel = alvo.closest('td.erro'); if (cel) { ui.msgCelula = cel.dataset.erro; return renderCentro(); }
});
// a rolagem que o próprio clique provoca (cabeçalho meio escondido) não fecha o menu que acabou de abrir
$('grade-area').addEventListener('scroll', () => { if (Date.now() - (ui.menuAbertoEm || 0) > 400) fecharMenuColuna(); });
window.addEventListener('resize', fecharMenuColuna);
$('modal-ok').addEventListener('click', confirmarJanela);
$('modal-cancelar').addEventListener('click', fecharJanela);
$('modal-x').addEventListener('click', fecharJanela);
$('modal-caixa').addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.matches('input[type=text]') && !$('modal-ok').hidden) { ev.preventDefault(); confirmarJanela(); } });
$('nome-consulta').addEventListener('change', ev => {
  const c = atual(); if (!c) return;
  const novo = ev.target.value.trim();
  if (!novo) { ev.target.value = c.nome; return aviso('O nome da consulta não pode ficar vazio.', 'erro'); }
  if (novo !== c.nome && ui.consultas.some(x => x.nome === novo)) { ev.target.value = c.nome; return aviso(`Já existe uma consulta chamada "${novo}".`, 'erro'); }
  const antigo = c.nome; c.nome = novo;
  ui.modelo.relacionamentos.forEach(r => { [r.de, r.para].forEach(l => { if (l.consulta === antigo) l.consulta = novo; }); });
  if (ui.modelo.posicoes[antigo]) { ui.modelo.posicoes[novo] = ui.modelo.posicoes[antigo]; delete ui.modelo.posicoes[antigo]; }
  let trocas = 0;
  ui.consultas.forEach(q => q.etapas.forEach(e => {
    if (e.consulta === antigo) { e.consulta = novo; trocas++; }
    if (e.consultas && e.consultas.includes(antigo)) { e.consultas = e.consultas.map(n => (n === antigo ? novo : n)); trocas++; }
  }));
  salvar(); render();
  if (trocas) aviso(`Consulta renomeada. ${trocas} etapa(s) que usavam "${antigo}" foram atualizadas.`);
});
$('formula').addEventListener('focus', () => { if ($('formula').disabled) return; ui.editandoFormula = true; $('formula-acoes').hidden = false; });
$('formula').addEventListener('input', ajustarAlturaFormula);
$('formula').addEventListener('blur', () => { // saiu sem mudar nada: volta ao normal
  const c = atual(); if (!c || !ui.editandoFormula) return;
  if ($('formula').value === M.gerarMEtapa(c, indiceEtapa())) { ui.editandoFormula = false; $('formula-acoes').hidden = true; $('formula-erro').hidden = true; }
});
$('formula').addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); aplicarFormula(); }
  if (ev.key === 'Escape') { ev.preventDefault(); cancelarFormula(); }
});
$('formula-ok').addEventListener('mousedown', ev => ev.preventDefault()); // não deixa o clique tirar o foco antes de aplicar
$('formula-ok').addEventListener('click', aplicarFormula);
$('formula-cancelar').addEventListener('mousedown', ev => ev.preventDefault());
$('formula-cancelar').addEventListener('click', cancelarFormula);
$('btn-editar-codigo').addEventListener('click', abrirEditorAvancado);
$('btn-aplicar-codigo').addEventListener('click', aplicarCodigo);
$('btn-cancelar-codigo').addEventListener('click', () => { ui.editandoCodigo = false; render(); });
$('codigo-edicao').addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); aplicarCodigo(); }
  if (ev.key === 'Tab') { ev.preventDefault(); const t = ev.target, a = t.selectionStart; t.value = t.value.slice(0, a) + '    ' + t.value.slice(t.selectionEnd); t.selectionStart = t.selectionEnd = a + 4; }
});
$('btn-copiar').addEventListener('click', () => {
  const c = atual(); if (!c) return;
  const texto = M.gerarM(c);
  const selecionar = () => { const r = document.createRange(); r.selectNodeContents($('codigo-m')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); aviso('Código selecionado: use Ctrl+C para copiar.'); };
  try { navigator.clipboard.writeText(texto).then(() => aviso('Código M copiado.'), selecionar); } catch { selecionar(); }
});
$('btn-zerar').addEventListener('click', () => confirmar('Zerar dados', 'Voltar às consultas de exemplo? As consultas e etapas criadas aqui serão apagadas deste navegador.', 'Zerar', async () => {
  await Armazenamento.zerar();
  ui.consultas = consultasDeExemplo(); ui.sel = ui.consultas[0] ? ui.consultas[0].id : null; ui.etapaSel = null;
  ui.modelo = modeloPadrao();
  await salvar(); render(); aviso('Dados de exemplo restaurados.');
}));
$('tema').addEventListener('change', ev => salvarPref('tema', ev.target.value));
$('fonte-menos').addEventListener('click', () => salvarPref('fonte', Math.max(1, (Number(lerPrefs().fonte) || 8) - 1)));
$('fonte-mais').addEventListener('click', () => salvarPref('fonte', Math.min(15, (Number(lerPrefs().fonte) || 8) + 1)));

(async function iniciar() {
  aplicarPrefs();
  const salvo = await Armazenamento.carregar();
  if (salvo && Array.isArray(salvo.consultas)) {
    ui.consultas = salvo.consultas; ui.sel = salvo.sel;
    // consultas salvas antes de 13/11 ganham a etapa "Espaços Removidos" logo depois do "Tipo Alterado" automático
    ui.consultas.forEach(c => {
      const i = c.etapas.findIndex(e => e.tipo === 'tipos');
      if (i !== 2 || c.etapas.some(e => e.tipo === 'limparEspacos')) return;
      const textos = c.etapas[i].lista.filter(([, t]) => t === 'texto').map(([col]) => col);
      if (textos.length) M.inserirEtapa(c, { tipo: 'limparEspacos', colunas: textos }, i);
    });
  }
  else { ui.consultas = consultasDeExemplo(); ui.sel = ui.consultas[0] ? ui.consultas[0].id : null; }
  ui.modelo = salvo && salvo.modelo ? salvo.modelo : modeloPadrao();
  if (!atual() && ui.consultas[0]) ui.sel = ui.consultas[0].id;
  render();
})();
