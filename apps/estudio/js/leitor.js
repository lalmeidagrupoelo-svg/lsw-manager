/* =====================================================================
   ESTÚDIO · JANELA DO LEITOR DE FÓRMULAS (E6 · 13/11/2026)
   Abre por: menu lateral, aba Exibir e o botão "Ler" da barra fx.
   Abas (uma coisa de cada vez): Em português · Passo a passo · Árvore · A consulta inteira.
   Usa do estudio.js: M, ui, exec, atual, indiceEtapa, abrirJanela, esc, $.
   O texto vem do js/leitor-motor.js (window.LeitorMotor).
   ===================================================================== */
'use strict';
const Leitor = window.LeitorMotor;
const EXEMPLOS_LEITOR = [
  'if [CHAMADAS] = null then null else Number.Round([TEMPO_FALADO_S] / [CHAMADAS], 1)',
  '[OPERAÇÃO] = "COBRANÇA" and ([CANAL] = "CHAT" or [DATA] = #date(2026, 11, 4))',
  'Text.Upper([OPERAÇÃO]) & " · " & Text.From([MATRICULA])',
  'if Date.DayOfWeek([DATA]) = 0 then "domingo" else "dia de semana"',
];

// Rótulo curto de cada bloco da árvore
function rotuloNo(no) {
  if (no.k === 'lit') return no.v === null ? 'vazio' : Leitor.valorPt(no.v);
  if (no.k === 'col') return `coluna ${no.nome}`;
  if (no.k === 'fn') return no.nome;
  if (no.k === 'se') return 'se … então … senão';
  if (no.k === 'not') return 'não';
  if (no.k === 'neg') return 'sinal de menos';
  return { '+': 'soma (+)', '-': 'subtração (−)', '*': 'multiplicação (×)', '/': 'divisão (÷)', '&': 'juntar textos (&)', '=': 'igual (=)', '<>': 'diferente (<>)', '>': 'maior (>)', '>=': 'maior ou igual (>=)', '<': 'menor (<)', '<=': 'menor ou igual (<=)', and: 'E (and)', or: 'OU (or)' }[no.op];
}
function htmlArvore(no, linha) {
  let valor; try { valor = M.avaliar(no, linha); } catch (e) { valor = new M.ErroM(e.message); }
  const filhos = no.k === 'se' ? [['condição', no.c], ['então', no.a], ['senão', no.b]]
    : no.k === 'fn' ? no.args.map((a, i) => [`${i + 1}º valor`, a])
    : no.k === 'bin' ? [['', no.a], ['', no.b]] : no.a ? [['', no.a]] : [];
  const folha = !filhos.length;
  return `<div class="arv-no${folha ? ' folha' : ''} arv-${no.k}">
    <div class="arv-topo"><span class="arv-rotulo">${esc(rotuloNo(no))}</span><span class="arv-valor${M.ehErro(valor) ? ' erro' : ''}" title="${M.ehErro(valor) ? esc(valor.mensagem) : 'valor nesta linha'}">${esc(Leitor.valorPt(valor))}</span></div>
    ${folha ? '' : `<div class="arv-filhos">${filhos.map(([r, f]) => `<div class="arv-ramo">${r ? `<span class="arv-ramo-rot">${esc(r)}</span>` : ''}${htmlArvore(f, linha)}</div>`).join('')}</div>`}
  </div>`;
}

function janelaLeitor(inicial) {
  const c = atual();
  // de onde vêm os valores: a entrada da etapa que tem a fórmula, ou a tabela da etapa selecionada
  const est = { expr: inicial ? inicial.expr : '', tabela: null, linha: 0, aba: 'portugues', origem: inicial ? inicial.origem : null };
  const tabelaPara = idx => (c ? (idx !== null && idx !== undefined ? exec(c, idx - 1).tabela : resultadoAtual() && resultadoAtual().tabela) : null);
  est.tabela = tabelaPara(inicial ? inicial.indice : null);
  if (!est.expr) {
    const i = c ? c.etapas.findIndex(e => e.tipo === 'adicionar' || e.tipo === 'filtrar') : -1;
    if (i >= 0) { est.expr = c.etapas[i].expr; est.origem = c.etapas[i].nome; est.tabela = tabelaPara(i); }
    else est.expr = EXEMPLOS_LEITOR[0];
  }
  const formulasDaConsulta = c ? c.etapas.map((e, i) => ({ e, i })).filter(({ e }) => e.tipo === 'adicionar' || e.tipo === 'filtrar') : [];
  abrirJanela({
    titulo: 'Leitor de fórmulas', largo: true, semOk: true, cheia: true,
    corpo: `<div class="leitor">
      <div class="leitor-topo">
        <div class="campo"><label for="lf-expr">Fórmula em M <span class="mono" style="color:var(--muted)">(o que vem depois do each)</span></label>
          <textarea id="lf-expr" spellcheck="false">${esc(est.expr)}</textarea></div>
        <div class="leitor-fontes">
          ${formulasDaConsulta.length ? `<span class="rotulo">Desta consulta</span><div class="cf-colunas">${formulasDaConsulta.map(({ e, i }) => `<button type="button" data-carregar="${i}" title="${esc(e.expr)}">${esc(e.tipo === 'adicionar' ? `${e.nome} · ${e.coluna}` : e.nome)}</button>`).join('')}</div>` : ''}
          <span class="rotulo">Exemplos</span><div class="cf-colunas">${EXEMPLOS_LEITOR.map((x, k) => `<button type="button" data-exemplo="${k}">Exemplo ${k + 1}</button>`).join('')}</div>
        </div>
      </div>
      <div class="leitor-barra">
        <div class="abas" role="tablist" id="lf-abas">
          <button type="button" data-aba-lf="portugues">Em português</button><button type="button" data-aba-lf="passos">Passo a passo</button><button type="button" data-aba-lf="arvore">Árvore</button><button type="button" data-aba-lf="consulta">A consulta inteira</button>
        </div>
        <div class="leitor-linha" id="lf-linha"></div>
      </div>
      <div class="leitor-saida" id="lf-saida"></div>
    </div>`,
    aoAbrir() {
      const linhaAtual = () => (est.tabela && est.tabela.linhas[est.linha] ? Object.fromEntries(est.tabela.colunas.map((x, k) => [x.nome, est.tabela.linhas[est.linha][k]])) : {});
      const desenhar = () => {
        $('lf-abas').querySelectorAll('[data-aba-lf]').forEach(b => b.classList.toggle('on', b.dataset.abaLf === est.aba));
        const n = est.tabela ? est.tabela.linhas.length : 0;
        $('lf-linha').innerHTML = est.aba === 'consulta' ? '' : n
          ? `<span>Valores da linha</span><button class="btn peq" type="button" data-linha="-1" aria-label="Linha anterior">‹</button><b>${(est.linha + 1).toLocaleString('pt-BR')}</b><span>de ${n.toLocaleString('pt-BR')}</span><button class="btn peq" type="button" data-linha="1" aria-label="Próxima linha">›</button>${est.origem ? `<small>entrada da etapa “${esc(est.origem)}”</small>` : ''}`
          : '<span>Sem consulta aberta: as colunas ficam vazias.</span>';
        if (est.aba === 'consulta') return desenharConsulta();
        let arvore;
        try { arvore = M.analisar(est.expr.trim().replace(/^each\s+/, '')); }
        catch (e) { $('lf-saida').innerHTML = `<div class="resultado ruim">${esc(e.message.replace(/^Expression\./, ''))}</div>`; return; }
        const linha = linhaAtual();
        let resultado; try { resultado = M.avaliar(arvore, linha); } catch (e) { resultado = new M.ErroM(e.message.replace(/^Expression\./, '')); }
        const resHtml = `<div class="leitor-resultado${M.ehErro(resultado) ? ' erro' : ''}"><span>Resultado nesta linha</span><b>${esc(Leitor.valorPt(resultado))}</b>${M.ehErro(resultado) ? `<small>${esc(resultado.mensagem)}</small>` : ''}</div>`;
        if (est.aba === 'portugues') {
          // condição (filtro): "Verdadeiro quando …"; conta: a frase direto
          const condicao = (arvore.k === 'bin' && ['=', '<>', '<', '<=', '>', '>=', 'and', 'or'].includes(arvore.op)) || arvore.k === 'not' || (arvore.k === 'fn' && /^Text\.(Contains|StartsWith|EndsWith)$/.test(arvore.nome));
          const texto = esc(Leitor.frase(arvore));
          $('lf-saida').innerHTML = `<div class="leitor-frase">${condicao ? `<span class="frase-tipo">Verdadeiro quando</span> ${texto}` : texto.replace(/^./, x => x.toUpperCase())}.</div>${resHtml}
            <p class="ajuda">Dica: na aba <b>Passo a passo</b> você vê a ordem da conta e o valor de cada parte; na <b>Árvore</b>, o que fica dentro do quê.</p>`;
        } else if (est.aba === 'passos') {
          let lista; try { lista = Leitor.passos(arvore, linha); } catch (e) { lista = []; }
          $('lf-saida').innerHTML = `<ol class="leitor-passos">${lista.map(p => `<li class="${p.tipo}"><div><span class="passo-texto">${esc(p.texto)}</span><code>${esc(p.expr)}</code></div><span class="passo-valor${M.ehErro(p.valor) ? ' erro' : ''}">${esc(Leitor.valorPt(p.valor))}</span></li>`).join('')}</ol>${resHtml}`;
        } else {
          $('lf-saida').innerHTML = `<div class="leitor-arvore">${htmlArvore(arvore, linha)}</div>${resHtml}`;
        }
      };
      const desenharConsulta = () => {
        if (!c) { $('lf-saida').innerHTML = '<p class="ajuda">Abra uma consulta para ler as etapas dela.</p>'; return; }
        $('lf-saida').innerHTML = `<p class="ajuda">A consulta <b>${esc(c.nome)}</b> lida de cima para baixo. Clique numa etapa com fórmula para abri-la no leitor.</p>
          <ol class="leitor-consulta">${Leitor.lerConsulta(c).map((x, i) => `<li${c.etapas[i].expr ? ` data-carregar="${i}" class="clicavel"` : ''}><b>${esc(x.nome)}</b><span>${esc(x.frase)}</span></li>`).join('')}</ol>`;
      };
      const caixa = $('modal-corpo');
      caixa.addEventListener('click', ev => {
        const a = ev.target.closest('[data-aba-lf]'); if (a) { est.aba = a.dataset.abaLf; return desenhar(); }
        const l = ev.target.closest('[data-linha]'); if (l && est.tabela) { const n = est.tabela.linhas.length; est.linha = (est.linha + Number(l.dataset.linha) + n) % n; return desenhar(); }
        const car = ev.target.closest('[data-carregar]'); if (car) { const i = +car.dataset.carregar; est.expr = c.etapas[i].expr; est.origem = c.etapas[i].nome; est.tabela = tabelaPara(i); est.linha = 0; $('lf-expr').value = est.expr; if (est.aba === 'consulta') est.aba = 'portugues'; return desenhar(); }
        const ex = ev.target.closest('[data-exemplo]'); if (ex) { est.expr = EXEMPLOS_LEITOR[+ex.dataset.exemplo]; est.origem = null; est.tabela = tabelaPara(null); est.linha = 0; $('lf-expr').value = est.expr; if (est.aba === 'consulta') est.aba = 'portugues'; return desenhar(); }
      });
      $('lf-expr').addEventListener('input', ev => { est.expr = ev.target.value; desenhar(); });
      desenhar();
    },
  });
}
