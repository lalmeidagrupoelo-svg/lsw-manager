---
name: paleta-proativa
description: Paleta de cores, temas (Escuro e Claro), semáforo, cores de gráfico, tipografia e regras de uso da identidade Proativa, extraídas da apresentação institucional (logo "P" laranja sobre azul-noite). Use sempre que for criar ou ajustar telas, sites, painéis de BI, dashboards, artifacts, slides, relatórios ou gráficos com a cara da Proativa, ou quando o usuário falar em "paleta Proativa", "cores da Proativa", "tema Proativa", "modo escuro/claro da Proativa" ou pedir para aplicar a identidade visual da Proativa, mesmo sem citar a skill pelo nome.
---

# Paleta Proativa

Identidade visual para tudo que for feito com a cara da Proativa. A paleta tem **um conjunto de cores e dois modos** (Escuro e Claro), mais o Automático, que segue o sistema.

Origem de cada cor (apresentação institucional da Proativa):

| Elemento da apresentação | Cor | Papel na paleta |
|---|---|---|
| "P" do logo | degradê `#FFB12B` → `#FE9007` | cor de ação e destaque |
| Fundo da capa | azul-noite `#0B1224` / `#0F172A` | fundo do Escuro, texto do Claro |
| Textos dos slides | ardósia `#0F172A`, `#475569`, `#64748B`, `#F1F5F9` | textos e fundo do Claro |
| Ícones dos slides | azul, verde-água, verde-lima, âmbar e rosa | cores de série dos gráficos |
| Fonte | Trebuchet MS | títulos |

## Tokens

Os valores prontos para colar estão em `tokens.css`, ao lado deste arquivo. Ele já tem o bloco claro, o escuro por preferência do sistema e os seletores `[data-theme]`. Use esses nomes de token; não escreva cores soltas nos componentes.

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--bg` | `#0B1224` | `#F1F5F9` | fundo da página |
| `--surface` | `#111A2E` | `#FFFFFF` | cartões, tabelas, janelas |
| `--surface-2` | `#18233B` | `#F8FAFC` | cabeçalho de tabela, campos |
| `--surface-3` | `#1F2C47` | `#E3EBF5` | selecionado, hover, zebra |
| `--border` | `#26334D` | `#CBD5E1` | bordas e divisórias |
| `--border-strong` | `#3A4A66` | `#94A3B8` | borda de foco, divisória forte |
| `--text` | `#F1F5F9` | `#0F172A` | texto principal e números |
| `--text-2` | `#94A3B8` | `#475569` | texto de apoio |
| `--muted` | `#7A89A0` | `#64748B` | rótulos pequenos, legendas, datas |
| `--accent` | `#FFB12B` | `#FE9007` | botão principal, item ativo, destaque |
| `--accent-2` | `#FE9007` | `#E07B00` | hover do botão, fim do degradê |
| `--accent-soft` | `rgba(255,177,43,.14)` | `rgba(254,144,7,.12)` | fundo do item ativo |
| `--on-accent` | `#0B1224` | `#0F172A` | texto sobre o laranja |
| `--link` | `#FFC35C` | `#9A4A06` | links e ações em texto |

Contraste (WCAG) já conferido: texto principal acima de 16:1 nos dois modos; `--text-2` acima de 6,9; `--link` 11,7 (Escuro). O texto escuro sobre o laranja tem contraste 7,8.

### Semáforo (separado da marca)

O semáforo **não usa o laranja da marca**, para "atenção" não parecer botão. No Claro, use etiqueta com fundo claro e texto escuro; no Escuro, texto claro com fundo translúcido.

| Estado | Escuro (texto · fundo) | Claro (texto · fundo) |
|---|---|---|
| ok / na meta | `#4ADE80` · `rgba(74,222,128,.14)` | `#166534` · `#DCFCE7` |
| atenção | `#FACC15` · `rgba(250,204,21,.14)` | `#854D0E` · `#FEF9C3` |
| crítico | `#FB7185` · `rgba(251,113,133,.14)` | `#9F1239` · `#FFE4E6` |
| informação | `#38BDF8` · `rgba(56,189,248,.14)` | `#075985` · `#E0F2FE` |

### Cores de série (gráficos), nesta ordem

| # | Escuro | Claro |
|---|---|---|
| 1 | `#38BDF8` | `#0284C7` |
| 2 | `#2DD4BF` | `#0D9488` |
| 3 | `#FFB12B` | `#FE9007` |
| 4 | `#FB7185` | `#E11D48` |
| 5 | `#A3E635` | `#65A30D` |
| 6 | `#94A3B8` | `#64748B` |

Em gráficos de WFM, a série 3 (laranja) fica para a referência principal, como necessidade, meta ou previsto, desenhada em linha ou tracejado. O realizado e os escalados usam a série 1.

### Degradê da capa (só login, apresentação e capas)

```css
background:
  radial-gradient(120% 90% at 100% 0%, #16306B 0%, transparent 55%),
  radial-gradient(90% 80% at 0% 100%, #0F3A4A 0%, transparent 55%),
  #0B1224;
```

## Tipografia

- **Títulos:** `'Trebuchet MS', 'Segoe UI', system-ui, sans-serif`, a fonte da apresentação.
- **Texto, tabelas e números:** `'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif`, carregada do Google Fonts. Use `font-variant-numeric: tabular-nums` em colunas de números.
- **Rótulos técnicos ou códigos:** monoespaçada (`'JetBrains Mono', ui-monospace, Consolas, monospace`).
- Em slides (.pptx), mantenha Trebuchet MS em tudo, como na apresentação original.

## Regras de uso

1. **O laranja é escasso.** Ele aparece em um botão principal por tela, no item ativo do menu, no logo e na série de referência dos gráficos. Nunca em blocos grandes de fundo.
2. **Texto sobre o laranja é sempre azul-noite** (`--on-accent`). Branco sobre o laranja tem contraste de só 2,3 e fica ilegível.
3. **O degradê da capa** entra apenas no login, na apresentação e nas capas. As telas de trabalho usam fundo liso (`--bg`).
4. **Temas:** Escuro, Claro e Automático. O Automático segue `prefers-color-scheme`.
5. **Menu lateral:** azul-noite (`--surface`) no Escuro e branco no Claro. O item ativo tem fundo `--accent-soft`, uma barra de 3px em `--accent` à esquerda e texto `--text`.
6. **Logo:** só o "P" laranja da Proativa. Use texto branco no Escuro e texto azul-noite (`#0F172A`) no Claro. O símbolo "B" violeta (`#4003FF`) que aparece no modelo de slide **não** faz parte da marca.
7. **Nada de cobre** (`#c9793f`) nem de violeta; essas cores pertencem a outras identidades.
8. **Tamanho de fonte:** quando o sistema tiver escala de fonte, escreva os tamanhos como `calc(Npx * var(--escala-fonte))`.

## Como aplicar

- **Página HTML, site ou artifact:** copie o conteúdo de `tokens.css` para o topo do `<style>` (ou importe o arquivo) e construa tudo a partir dos tokens. O `body` precisa ter `background: var(--bg); color: var(--text)`.
- **Projeto com tema existente:** troque os valores dos tokens do projeto pelos desta paleta, mantendo os nomes que o projeto já usa. Mostre a tabela "token antigo → token Proativa" antes de alterar.
- **Gráficos (Chart.js, ECharts, Power BI):** use as cores de série na ordem acima e o semáforo para metas. Os eixos e rótulos usam `--muted` e as linhas de grade usam `--border`.
- **Power BI:** gere um tema JSON com `dataColors` = séries do modo Claro, `background` = `#FFFFFF`, `foreground` = `#0F172A`, `tableAccent` = `#FE9007`, `good` = `#166534`, `neutral` = `#854D0E`, `bad` = `#9F1239`.
- **Slides:** use o fundo da capa com o degradê, títulos em `#F1F5F9` no escuro ou `#0F172A` no claro, e o laranja só em destaques.

## Conferência antes de entregar

- [ ] Nenhuma cor escrita direto num componente: todas vêm dos tokens.
- [ ] Os dois modos foram conferidos (Escuro e Claro), não só um.
- [ ] Nenhum texto branco sobre o laranja.
- [ ] O laranja aparece só em ação, item ativo, logo e série de referência.
- [ ] O semáforo usa verde, amarelo e vermelho, não o laranja.
- [ ] O degradê aparece só em login, apresentação ou capa.
