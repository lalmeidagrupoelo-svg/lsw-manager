/* =====================================================================
   ESTÚDIO · TELA "MODELO E RELACIONAMENTOS" (E4 · 13/11/2026)
   Cada consulta vira um cartão com as colunas; cada relação é uma linha entre
   as colunas-chave, com 1 e * nas pontas (como no Power BI).
   Usa o que o estudio.js já tem: ui, exec, salvar, render, abrirJanela, aviso, esc, $.
   O cálculo fica no js/modelo-motor.js (window.ModeloMotor).
   Seções: 1 dados · 2 desenhar · 3 linhas · 4 arrastar · 5 janelas · 6 ações
   ===================================================================== */
'use strict';
const Mod = window.ModeloMotor;
const LARGURA_CARTAO = 240;
const uiModelo = { selecionada: null, arrasto: null };

/* ---------------- 1. dados ---------------- */
// Resultado final de cada consulta (null se estiver com erro)
function tabelasModelo() {
  const out = {};
  ui.consultas.forEach(c => { const r = exec(c); out[c.nome] = r.tabela || null; });
  return out;
}
const rotuloLado = l => `${l.consulta}[${l.coluna}]`;
const DIRECOES = { unica: 'Única (do lado 1 para o lado *)', ambas: 'Ambas (nos dois sentidos)' };

/* ---------------- 2. desenhar ---------------- */
function posicaoPadrao(i) { return { x: 32 + (i % 3) * (LARGURA_CARTAO + 150), y: 28 + Math.floor(i / 3) * 380 }; }
function renderModelo() {
  const tabelas = tabelasModelo();
  const rels = ui.modelo.relacionamentos;
  const usos = {}; // coluna → '1' ou '*' (para marcar no cartão)
  rels.forEach(r => { usos[`${r.de.consulta}|${r.de.coluna}`] = r.cardinalidade === '1:1' ? '1' : '*'; usos[`${r.para.consulta}|${r.para.coluna}`] = '1'; });
  const tela = $('modelo-tela');
  tela.innerHTML = '<svg class="modelo-linhas" id="modelo-linhas" aria-hidden="true"></svg>' + ui.consultas.map((c, i) => {
    const pos = ui.modelo.posicoes[c.nome] || posicaoPadrao(i);
    const t = tabelas[c.nome];
    return `<div class="cartao-tab${t ? '' : ' com-erro'}" data-cartao="${esc(c.nome)}" style="left:${pos.x}px;top:${pos.y}px;width:${LARGURA_CARTAO}px">
      <div class="cartao-tab-topo" data-arrastar title="Arraste para mudar o lugar"><b>${esc(c.nome)}</b><small>${t ? `${t.linhas.length.toLocaleString('pt-BR')} linhas` : 'com erro'}</small></div>
      ${t ? `<ul>${t.colunas.filter(x => x.tipo !== 'tabela').map(x => { const u = usos[`${c.nome}|${x.nome}`]; return `<li data-col="${esc(x.nome)}" draggable="true" title="Arraste até uma coluna de outro cartão para criar uma relação"><span class="tipo">${M.TIPOS[x.tipo].icone}</span><span class="nome">${esc(x.nome)}</span>${u ? `<span class="chave-uso" title="${u === '1' ? 'Lado 1 de uma relação (valores únicos)' : 'Lado muitos de uma relação'}">${u === '1' ? '1' : '∗'}</span>` : ''}</li>`; }).join('')}</ul>`
        : `<p class="cartao-erro">Esta consulta está com erro. Corrija-a em Transformar dados para usar no modelo.</p>`}
    </div>`;
  }).join('');
  // tamanho da área de desenho = até o cartão mais distante
  let maxX = 0, maxY = 0;
  tela.querySelectorAll('.cartao-tab').forEach(el => { maxX = Math.max(maxX, el.offsetLeft + el.offsetWidth); maxY = Math.max(maxY, el.offsetTop + el.offsetHeight); });
  tela.style.width = (maxX + 120) + 'px'; tela.style.height = (maxY + 120) + 'px';
  desenharLinhas(tabelas);
  renderListaRelacoes(tabelas);
}

function renderListaRelacoes(tabelas) {
  const rels = ui.modelo.relacionamentos;
  $('titulo-relacoes').textContent = `Relacionamentos (${rels.length})`;
  $('lista-relacoes').innerHTML = rels.length ? rels.map(r => {
    const s = Mod.situacao(r, tabelas);
    const estado = s.estado === 'quebrada' ? 'quebrada' : r.ativo === false ? 'inativa' : 'ativa';
    return `<li class="${r.id === uiModelo.selecionada ? 'on' : ''}" data-relacao="${esc(r.id)}" title="${esc(s.motivo || '')}">
      <span class="ico rel-${estado}">${estado === 'quebrada' ? '⚠' : r.direcao === 'ambas' ? '⇄' : '→'}</span>
      <span class="nome">${esc(rotuloLado(r.de))} <b>${r.cardinalidade === '1:1' ? '1—1' : r.cardinalidade === 'N:N' ? '∗—∗' : '∗—1'}</b> ${esc(rotuloLado(r.para))}</span></li>`;
  }).join('') : '<li class="vazio-lista">Nenhuma relação ainda. Use "Detectar relacionamentos" ou arraste uma coluna até outra.</li>';
  const sel = rels.find(r => r.id === uiModelo.selecionada);
  if (!sel) { $('detalhe-relacao').innerHTML = ''; return; }
  const s = Mod.situacao(sel, tabelas);
  const an = s.estado === 'ok' ? Mod.analisarRelacao(tabelas[sel.de.consulta], sel.de.coluna, tabelas[sel.para.consulta], sel.para.coluna) : null;
  $('detalhe-relacao').innerHTML = `<div class="detalhe-rel">
    <div><span class="rotulo">Lado muitos (∗)</span><b>${esc(rotuloLado(sel.de))}</b></div>
    <div><span class="rotulo">Lado um (1)</span><b>${esc(rotuloLado(sel.para))}</b></div>
    <div><span class="rotulo">Direção do filtro</span>${esc(DIRECOES[sel.direcao])}</div>
    <div><span class="rotulo">Situação</span>${s.estado === 'quebrada' ? `<span class="chip-rel quebrada">quebrada</span> ${esc(s.motivo)}` : sel.ativo === false ? '<span class="chip-rel inativa">inativa</span> não filtra os dados' : '<span class="chip-rel ativa">ativa</span>'}</div>
    ${an ? `<div><span class="rotulo">Correspondência</span>${Math.round(an.correspondencia * 100)}% dos valores de ${esc(sel.de.consulta)} acham par${an.linhasSemPar ? ` · ${an.linhasSemPar.toLocaleString('pt-BR')} linha(s) sem par` : ''}</div>` : ''}
    <div class="acoes">
      <button class="btn peq" type="button" data-rel-acao="editar">Editar</button>
      <button class="btn peq" type="button" data-rel-acao="ativar">${sel.ativo === false ? 'Ativar' : 'Desativar'}</button>
      <button class="btn peq perigo" type="button" data-rel-acao="excluir">Excluir</button>
    </div></div>`;
}

/* ---------------- 3. linhas entre os cartões ---------------- */
function pontoColuna(consulta, coluna) {
  const cartao = $('modelo-tela').querySelector(`[data-cartao="${CSS.escape(consulta)}"]`);
  if (!cartao) return null;
  const li = cartao.querySelector(`li[data-col="${CSS.escape(coluna)}"]`);
  const y = cartao.offsetTop + (li ? li.offsetTop + li.offsetHeight / 2 : 18);
  return { cartao, y, esq: cartao.offsetLeft, dir: cartao.offsetLeft + cartao.offsetWidth, achou: !!li };
}
function desenharLinhas(tabelas = tabelasModelo()) {
  const svg = $('modelo-linhas'); if (!svg) return;
  const tela = $('modelo-tela');
  svg.setAttribute('width', tela.offsetWidth); svg.setAttribute('height', tela.offsetHeight);
  svg.innerHTML = ui.modelo.relacionamentos.map(r => {
    const a = pontoColuna(r.de.consulta, r.de.coluna), b = pontoColuna(r.para.consulta, r.para.coluna);
    if (!a || !b) return '';
    const quebrada = Mod.situacao(r, tabelas).estado === 'quebrada';
    // sai pela lateral que fica de frente para o outro cartão
    const aDireita = a.cartao.offsetLeft + a.cartao.offsetWidth / 2 < b.cartao.offsetLeft + b.cartao.offsetWidth / 2;
    const x1 = aDireita ? a.dir : a.esq, x2 = aDireita ? b.esq : b.dir;
    const d = Math.max(50, Math.abs(x2 - x1) / 2) * (aDireita ? 1 : -1);
    const caminho = `M ${x1} ${a.y} C ${x1 + d} ${a.y}, ${x2 - d} ${b.y}, ${x2} ${b.y}`;
    const mx = (x1 + x2) / 2, my = (a.y + b.y) / 2;
    const seta = r.direcao === 'ambas' || r.cardinalidade === '1:1' ? '⇄' : aDireita ? '◀' : '▶'; // o filtro anda do 1 para o ∗
    const cls = `rel${r.id === uiModelo.selecionada ? ' sel' : ''}${r.ativo === false ? ' inativa' : ''}${quebrada ? ' quebrada' : ''}`;
    const fimA = r.cardinalidade === '1:1' ? '1' : '∗', fimB = r.cardinalidade === 'N:N' ? '∗' : '1';
    return `<g class="${cls}" data-relacao="${esc(r.id)}">
      <path class="rel-toque" d="${caminho}"></path><path class="rel-linha" d="${caminho}"></path>
      <text x="${x1 + (aDireita ? 10 : -10)}" y="${a.y - 6}" text-anchor="${aDireita ? 'start' : 'end'}" class="rel-card">${fimA}</text>
      <text x="${x2 + (aDireita ? -10 : 10)}" y="${b.y - 6}" text-anchor="${aDireita ? 'end' : 'start'}" class="rel-card">${fimB}</text>
      <circle cx="${mx}" cy="${my}" r="11" class="rel-meio"></circle><text x="${mx}" y="${my + 4}" text-anchor="middle" class="rel-seta">${seta}</text>
    </g>`;
  }).join('');
}

/* ---------------- 4. arrastar cartões e colunas ---------------- */
$('modelo-tela').addEventListener('pointerdown', ev => {
  const topo = ev.target.closest('[data-arrastar]'); if (!topo) return;
  const cartao = topo.closest('.cartao-tab');
  uiModelo.arrasto = { cartao, nome: cartao.dataset.cartao, x0: ev.clientX, y0: ev.clientY, left: cartao.offsetLeft, top: cartao.offsetTop };
  topo.setPointerCapture(ev.pointerId); cartao.classList.add('arrastando');
});
$('modelo-tela').addEventListener('pointermove', ev => {
  const a = uiModelo.arrasto; if (!a) return;
  a.cartao.style.left = Math.max(0, a.left + ev.clientX - a.x0) + 'px';
  a.cartao.style.top = Math.max(0, a.top + ev.clientY - a.y0) + 'px';
  desenharLinhas();
});
$('modelo-tela').addEventListener('pointerup', () => {
  const a = uiModelo.arrasto; if (!a) return;
  uiModelo.arrasto = null; a.cartao.classList.remove('arrastando');
  ui.modelo.posicoes[a.nome] = { x: a.cartao.offsetLeft, y: a.cartao.offsetTop };
  salvar(); renderModelo();
});
// arrastar uma coluna até a coluna de outro cartão abre a janela da relação já preenchida
$('modelo-tela').addEventListener('dragstart', ev => {
  const li = ev.target.closest('li[data-col]'); if (!li) return;
  ev.dataTransfer.setData('text/plain', JSON.stringify({ consulta: li.closest('.cartao-tab').dataset.cartao, coluna: li.dataset.col }));
  ev.dataTransfer.effectAllowed = 'link';
  uiModelo.colunaArrastada = li.closest('.cartao-tab').dataset.cartao;
});
$('modelo-tela').addEventListener('dragover', ev => {
  const li = ev.target.closest('li[data-col]');
  if (!li || li.closest('.cartao-tab').dataset.cartao === uiModelo.colunaArrastada) return;
  ev.preventDefault(); ev.dataTransfer.dropEffect = 'link';
  $('modelo-tela').querySelectorAll('li.alvo').forEach(x => x.classList.remove('alvo')); li.classList.add('alvo');
});
$('modelo-tela').addEventListener('dragleave', ev => { const li = ev.target.closest('li[data-col]'); if (li) li.classList.remove('alvo'); });
$('modelo-tela').addEventListener('drop', ev => {
  const li = ev.target.closest('li[data-col]'); if (!li) return;
  ev.preventDefault(); li.classList.remove('alvo');
  let origem; try { origem = JSON.parse(ev.dataTransfer.getData('text/plain')); } catch { return; }
  const destino = { consulta: li.closest('.cartao-tab').dataset.cartao, coluna: li.dataset.col };
  if (origem.consulta === destino.consulta) return;
  janelaRelacao(null, origem, destino);
});
$('modelo-tela').addEventListener('dragend', () => { uiModelo.colunaArrastada = null; });

/* ---------------- 5. janelas ---------------- */
// Criar ou editar uma relação. Descobre sozinho qual lado é o "1".
function janelaRelacao(existente, preA, preB) {
  const tabelas = tabelasModelo();
  const nomes = ui.consultas.map(c => c.nome).filter(n => tabelas[n]);
  if (nomes.length < 2) return aviso('São precisas pelo menos duas consultas sem erro para criar uma relação.', 'erro');
  const a = existente ? existente.de : preA || { consulta: nomes[0], coluna: tabelas[nomes[0]].colunas[0].nome };
  const b = existente ? existente.para : preB || { consulta: nomes[1], coluna: tabelas[nomes[1]].colunas[0].nome };
  const opcT = sel => nomes.map(n => `<option value="${esc(n)}" ${n === sel ? 'selected' : ''}>${esc(n)}</option>`).join('');
  const opcC = (nome, sel) => tabelas[nome].colunas.filter(x => x.tipo !== 'tabela').map(x => `<option value="${esc(x.nome)}" ${x.nome === sel ? 'selected' : ''}>${esc(x.nome)}</option>`).join('');
  abrirJanela({
    titulo: existente ? 'Editar relacionamento' : 'Novo relacionamento', largo: true, ok: existente ? 'Salvar' : 'Criar relacionamento',
    corpo: `<p class="ajuda">Uma relação liga duas consultas por colunas com o mesmo conteúdo (ex.: a matrícula). O lado com <b>valores únicos</b> é o lado <b>1</b>; o outro, o lado <b>muitos (∗)</b>. O Estúdio descobre isso sozinho.</p>
      <div class="rel-lados">
        <div class="campo"><span class="rotulo">Consulta e coluna</span><select id="r-ta">${opcT(a.consulta)}</select><select id="r-ca">${opcC(a.consulta, a.coluna)}</select></div>
        <div class="rel-liga" id="r-liga">—</div>
        <div class="campo"><span class="rotulo">Consulta e coluna</span><select id="r-tb">${opcT(b.consulta)}</select><select id="r-cb">${opcC(b.consulta, b.coluna)}</select></div>
      </div>
      <div class="linha-form" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
        <div class="campo"><label for="r-dir">Direção do filtro</label><select id="r-dir"><option value="unica">${DIRECOES.unica}</option><option value="ambas">${DIRECOES.ambas}</option></select></div>
        <div class="campo"><span class="rotulo">Situação</span><label class="ajuda" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="r-ativa" checked> Relação ativa (filtra os dados)</label></div>
      </div>
      <div class="resultado" id="r-res">—</div>`,
    aoAbrir() {
      if (existente) { $('r-dir').value = existente.direcao; $('r-ativa').checked = existente.ativo !== false; }
      let ativaMexida = !!existente;
      const ler = () => ({ a: { consulta: $('r-ta').value, coluna: $('r-ca').value }, b: { consulta: $('r-tb').value, coluna: $('r-cb').value } });
      const montar = () => {
        const { a: la, b: lb } = ler();
        if (la.consulta === lb.consulta) throw new Error('Escolha duas consultas diferentes.');
        let an = Mod.analisarRelacao(tabelas[la.consulta], la.coluna, tabelas[lb.consulta], lb.coluna);
        let de = la, para = lb;
        if (an.cardinalidade === '1:N') { an = Mod.analisarRelacao(tabelas[lb.consulta], lb.coluna, tabelas[la.consulta], la.coluna); [de, para] = [lb, la]; }
        if (an.tiposDiferentes) throw new Error(`Os tipos são diferentes (${M.TIPOS[an.tipoA].rotulo} × ${M.TIPOS[an.tipoB].rotulo}): nenhum valor vai combinar. Ajuste o tipo em Transformar dados.`);
        if (!an.achados) throw new Error('Nenhum valor combina entre as duas colunas. Confira se elas têm o mesmo conteúdo.');
        const outras = ui.modelo.relacionamentos.filter(r => !existente || r.id !== existente.id);
        const mesmoPar = outras.find(r => [r.de, r.para].every(l => [de, para].some(x => x.consulta === l.consulta && x.coluna === l.coluna)));
        if (mesmoPar) throw new Error('Essa relação já existe.');
        const ativaEntreAsMesmas = outras.find(r => r.ativo !== false && [r.de.consulta, r.para.consulta].sort().join('|') === [de.consulta, para.consulta].sort().join('|'));
        return { de, para, an, ativaEntreAsMesmas };
      };
      const atualizar = () => {
        try {
          const { de, para, an, ativaEntreAsMesmas } = montar();
          if (ativaEntreAsMesmas && !ativaMexida) $('r-ativa').checked = false;
          const card = an.cardinalidade === 'N:1' ? 'Muitos para um (∗:1)' : an.cardinalidade === '1:1' ? 'Um para um (1:1)' : 'Muitos para muitos (∗:∗)';
          $('r-liga').innerHTML = `<span>${an.cardinalidade === '1:1' ? '1' : '∗'}</span><i></i><span>${an.cardinalidade === 'N:N' ? '∗' : '1'}</span>`;
          $('r-res').className = 'resultado ' + (an.cardinalidade === 'N:N' ? 'ruim' : 'ok');
          $('r-res').innerHTML = `<b>${card}</b>: lado ∗ = ${esc(rotuloLado(de))}, lado 1 = ${esc(rotuloLado(para))}.<br>
            ${Math.round(an.correspondencia * 100)}% dos ${an.distintosA.toLocaleString('pt-BR')} valores diferentes de ${esc(de.coluna)} acham par${an.linhasSemPar ? ` · ${an.linhasSemPar.toLocaleString('pt-BR')} linha(s) sem par (ex.: ${an.exemplosSemPar.map(v => esc(String(v))).join(', ')}) ficam em "(em branco)" nos resumos` : ''}.
            ${an.cardinalidade === 'N:N' ? `<br>Nenhum dos lados tem valores únicos (${an.repetidosB.toLocaleString('pt-BR')} valor(es) repetido(s) em ${esc(para.consulta)}): os totais podem contar a mesma linha mais de uma vez. O ideal é ligar a uma consulta em que a coluna não se repete.` : ''}
            ${ativaEntreAsMesmas && !$('r-ativa').checked ? `<br>Já existe uma relação ativa entre ${esc(de.consulta)} e ${esc(para.consulta)} (${esc(rotuloLado(ativaEntreAsMesmas.de))}); esta entra <b>inativa</b>, como no Power BI.` : ''}`;
        } catch (e) { $('r-res').className = 'resultado ruim'; $('r-res').textContent = e.message; $('r-liga').textContent = '—'; }
      };
      const trocarTabela = (sel, col) => { $(col).innerHTML = opcC($(sel).value, ''); };
      $('r-ta').addEventListener('change', () => { trocarTabela('r-ta', 'r-ca'); atualizar(); });
      $('r-tb').addEventListener('change', () => { trocarTabela('r-tb', 'r-cb'); atualizar(); });
      $('r-ativa').addEventListener('change', () => { ativaMexida = true; atualizar(); });
      ['r-ca', 'r-cb', 'r-dir'].forEach(id => $(id).addEventListener('change', atualizar));
      uiModelo.montarRelacao = montar;
      atualizar();
    },
    aoConfirmar() {
      let m; try { m = uiModelo.montarRelacao(); } catch (e) { return e.message; }
      const dados = { de: m.de, para: m.para, cardinalidade: m.an.cardinalidade, direcao: $('r-dir').value, ativo: $('r-ativa').checked };
      if (dados.ativo && m.ativaEntreAsMesmas) return `Já existe uma relação ativa entre ${m.de.consulta} e ${m.para.consulta}. Desative-a antes, ou deixe esta inativa.`;
      if (existente) Object.assign(existente, dados);
      else { const nova = { id: 'r' + Date.now().toString(36), ...dados }; ui.modelo.relacionamentos.push(nova); uiModelo.selecionada = nova.id; }
      salvar(); renderModelo();
      aviso(existente ? 'Relacionamento atualizado.' : `Relacionamento criado: ${rotuloLado(m.de)} ∗—1 ${rotuloLado(m.para)}.`);
    },
  });
}

// Detectar: propõe as relações por colunas com o mesmo nome
function janelaDetectar() {
  const tabelas = tabelasModelo();
  const sugestoes = Mod.sugerirRelacoes(tabelas, ui.modelo.relacionamentos);
  if (!sugestoes.length) return aviso('Nenhuma relação nova encontrada. O Estúdio procura colunas com o mesmo nome, em que um dos lados não se repete.', 'ok', 5000);
  abrirJanela({
    titulo: 'Detectar relacionamentos', ok: 'Criar as marcadas',
    corpo: `<p class="ajuda">Colunas com o mesmo nome em consultas diferentes, em que um dos lados tem valores únicos. Marque as que fazem sentido.</p>
      <div class="checks" id="d-lista">${sugestoes.map((s, i) => `<label><input type="checkbox" value="${i}" checked> ${esc(rotuloLado(s.de))} ∗—1 ${esc(rotuloLado(s.para))} <small>${Math.round(s.analise.correspondencia * 100)}% combinam</small></label>`).join('')}</div>`,
    aoConfirmar() {
      const marcadas = [...$('d-lista').querySelectorAll('input:checked')].map(x => sugestoes[+x.value]);
      if (!marcadas.length) return 'Marque pelo menos uma.';
      marcadas.forEach((s, k) => ui.modelo.relacionamentos.push({ id: 'r' + Date.now().toString(36) + k, de: s.de, para: s.para, cardinalidade: s.analise.cardinalidade, direcao: 'unica', ativo: true }));
      salvar(); renderModelo(); aviso(`${marcadas.length} relacionamento(s) criado(s).`);
    },
  });
}

// Explorar dados: agrupa por uma coluna e resume colunas de outras consultas, passando pelas relações
function janelaExplorar() {
  const tabelas = tabelasModelo();
  const nomes = ui.consultas.map(c => c.nome).filter(n => tabelas[n]);
  if (!nomes.length) return aviso('Nenhuma consulta sem erro para explorar.', 'erro');
  const r0 = ui.modelo.relacionamentos.find(r => r.ativo !== false && tabelas[r.para.consulta] && tabelas[r.de.consulta]);
  const tGrupo = r0 ? r0.para.consulta : nomes[0];
  const colTexto = n => (tabelas[n].colunas.find(x => x.tipo === 'texto' && !/NOME/.test(x.nome) && x.nome !== (r0 && r0.para.coluna)) || tabelas[n].colunas[0]).nome;
  const tValor = r0 ? r0.de.consulta : nomes[0];
  const colNum = n => (tabelas[n].colunas.find(x => x.tipo === 'inteiro' && x.nome !== 'MATRICULA') || tabelas[n].colunas.find(x => x.tipo === 'decimal') || tabelas[n].colunas[0]).nome;
  const opcT = sel => nomes.map(n => `<option value="${esc(n)}" ${n === sel ? 'selected' : ''}>${esc(n)}</option>`).join('');
  const opcC = (nome, sel) => tabelas[nome].colunas.filter(x => x.tipo !== 'tabela').map(x => `<option value="${esc(x.nome)}" ${x.nome === sel ? 'selected' : ''}>${esc(x.nome)}</option>`).join('');
  const opcOp = sel => Object.entries(Mod.OPERACOES).map(([k, o]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${o.rotulo}</option>`).join('');
  const valorHtml = (op, t, c) => `<div class="val-linha"><select data-v="op">${opcOp(op)}</select><span>de</span><select data-v="t">${opcT(t)}</select><select data-v="c">${opcC(t, c)}</select><button class="cond-x" type="button" data-remover aria-label="Remover">×</button></div>`;
  abrirJanela({
    titulo: 'Explorar dados', largo: true, semOk: true,
    corpo: `<p class="ajuda">Funciona como um visual de tabela do Power BI: as <b>linhas</b> vêm de uma coluna e os <b>valores</b> podem vir de outras consultas. As relações ativas levam cada linha até o seu grupo. É assim que os relatórios vão usar o modelo.</p>
      <div class="campo"><span class="rotulo">Linhas (agrupar por)</span><div class="val-linha"><select id="x-tg">${opcT(tGrupo)}</select><select id="x-cg">${opcC(tGrupo, colTexto(tGrupo))}</select></div></div>
      <div class="campo"><span class="rotulo">Valores</span><div id="x-vals" class="conds">${valorHtml('contar', tValor, colNum(tValor))}${valorHtml('soma', tValor, colNum(tValor))}</div>
        <div><button class="btn peq" type="button" id="x-mais">+ Outro valor</button></div></div>
      <div class="resultado" id="x-res">—</div>`,
    aoAbrir() {
      const atualizar = () => {
        $('x-vals').querySelectorAll('.val-linha').forEach(el => { el.querySelector('[data-v=c]').disabled = !!Mod.OPERACOES[el.querySelector('[data-v=op]').value].semColuna; });
        const valores = [...$('x-vals').querySelectorAll('.val-linha')].map(el => {
          const op = el.querySelector('[data-v=op]').value, t = el.querySelector('[data-v=t]').value, c = el.querySelector('[data-v=c]').value;
          return { consulta: t, coluna: Mod.OPERACOES[op].semColuna ? null : c, op, nome: Mod.OPERACOES[op].semColuna ? `Linhas de ${t}` : `${Mod.OPERACOES[op].rotulo} de ${t}[${c}]` };
        });
        try {
          const r = Mod.consultarModelo(tabelas, ui.modelo.relacionamentos, { grupo: { consulta: $('x-tg').value, coluna: $('x-cg').value }, valores });
          const fmt = v => (v === null ? '' : typeof v === 'number' ? v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : esc(M.formatar(v, 'texto')));
          $('x-res').className = 'resultado ' + (r.avisos.length ? 'ruim' : 'ok');
          $('x-res').innerHTML = `${r.avisos.map(a => `<div>${esc(a)}</div>`).join('')}
            <div class="explorar-tabela"><table><thead><tr>${r.colunas.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>
            ${r.linhas.map(l => `<tr>${l.map((v, k) => `<td class="${k ? 'num' : ''}">${k === 0 && v === null ? '<i>(em branco)</i>' : fmt(v)}</td>`).join('')}</tr>`).join('')}
            </tbody><tfoot><tr><td><b>Total</b></td>${r.total.slice(1).map(v => `<td class="num"><b>${fmt(v)}</b></td>`).join('')}</tr></tfoot></table></div>`;
        } catch (e) { $('x-res').className = 'resultado ruim'; $('x-res').textContent = e.message; }
      };
      $('x-tg').addEventListener('change', () => { $('x-cg').innerHTML = opcC($('x-tg').value, colTexto($('x-tg').value)); atualizar(); });
      $('x-vals').addEventListener('change', ev => { if (ev.target.matches('[data-v=t]')) ev.target.parentElement.querySelector('[data-v=c]').innerHTML = opcC(ev.target.value, colNum(ev.target.value)); atualizar(); });
      $('x-cg').addEventListener('change', atualizar);
      $('x-mais').addEventListener('click', () => { $('x-vals').insertAdjacentHTML('beforeend', valorHtml('media', tValor, colNum(tValor))); atualizar(); });
      $('x-vals').addEventListener('click', ev => { const x = ev.target.closest('[data-remover]'); if (x && $('x-vals').children.length > 1) { x.parentElement.remove(); atualizar(); } });
      atualizar();
    },
  });
}

/* ---------------- 6. ações ---------------- */
document.querySelector('#tela-modelo .faixa').addEventListener('click', ev => {
  const b = ev.target.closest('[data-modelo]'); if (!b) return;
  if (b.dataset.modelo === 'nova') janelaRelacao(null);
  if (b.dataset.modelo === 'detectar') janelaDetectar();
  if (b.dataset.modelo === 'explorar') janelaExplorar();
  if (b.dataset.modelo === 'organizar') { ui.modelo.posicoes = {}; salvar(); renderModelo(); aviso('Cartões reorganizados.', 'ok', 2000); }
});
// clicar numa linha do desenho ou da lista seleciona a relação
document.getElementById('tela-modelo').addEventListener('click', ev => {
  const r = ev.target.closest('[data-relacao]');
  if (r) { uiModelo.selecionada = uiModelo.selecionada === r.dataset.relacao ? null : r.dataset.relacao; return renderModelo(); }
  const ac = ev.target.closest('[data-rel-acao]'); if (!ac) return;
  const rel = ui.modelo.relacionamentos.find(x => x.id === uiModelo.selecionada); if (!rel) return;
  if (ac.dataset.relAcao === 'editar') janelaRelacao(rel);
  if (ac.dataset.relAcao === 'ativar') {
    if (rel.ativo === false) {
      const outra = ui.modelo.relacionamentos.find(x => x.id !== rel.id && x.ativo !== false && [x.de.consulta, x.para.consulta].sort().join('|') === [rel.de.consulta, rel.para.consulta].sort().join('|'));
      if (outra) return aviso(`Já existe uma relação ativa entre ${rel.de.consulta} e ${rel.para.consulta}. Desative-a antes.`, 'erro');
    }
    rel.ativo = rel.ativo === false; salvar(); renderModelo();
  }
  if (ac.dataset.relAcao === 'excluir') confirmar('Excluir relacionamento', `Excluir a relação <b>${esc(rotuloLado(rel.de))} ∗—1 ${esc(rotuloLado(rel.para))}</b>?`, 'Excluir', () => {
    ui.modelo.relacionamentos = ui.modelo.relacionamentos.filter(x => x.id !== rel.id); uiModelo.selecionada = null; salvar(); renderModelo();
  });
});
window.addEventListener('resize', () => { if (ui.tela === 'modelo') desenharLinhas(); });
