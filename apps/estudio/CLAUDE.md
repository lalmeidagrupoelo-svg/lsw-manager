# Estúdio — contexto do módulo

> Módulo do LSW Manager (rota `/estudio`, projeto Vercel `lsw-estudio`). Leia também o `CLAUDE.md` da raiz: as regras de trabalho e as regras inegociáveis valem aqui.
> Identidade: skill `paleta-proativa` (`.claude/skills/paleta-proativa/`). Só tokens, nada de cor solta.

## O que é

Ferramenta para **montar bases e relatórios** no estilo Power BI, dentro do navegador:
- **Transformar dados** (E1, pronto): editor de consultas no estilo Power Query. Cada clique vira uma **etapa** e cada etapa vira uma linha de **código M**. Importar e tratar acontecem na mesma tela.
- **Modelo e relacionamentos** (E4): tabelas ligadas por colunas-chave, como no Power BI.
- **Relatórios** e **Medidas DAX**: vêm do Estúdio do DashBI (`_referencia/02-dashbi/FrontEnd/estudio*.js`).
- **Funções M e DAX** (E5): central de ajuda no estilo do Estúdio de medidas do Intrahora.
- **Leitor de fórmulas** (E6): explica uma fórmula em português, depois do Power Query.

## Arquivos

| Arquivo | Papel |
|---|---|
| `index.html` | Estrutura da tela (menu lateral, faixa de ferramentas, editor, código M, janela) |
| `css/tema.css` | Tokens da paleta Proativa + escala de fonte 1–15 (`--fs-N`). Vira import do `compartilhado/` na frente F1 |
| `css/estudio.css` | Estilo do editor |
| `js/m-motor.js` | **Motor do M**: tipos, conversões pt-BR, CSV, expressões `each …`, funções M, catálogo de etapas, gerar M, executar. Sem dependências; roda no navegador e no Node |
| `js/armazenamento.js` | Única porta para salvar/ler consultas. Hoje `localStorage`; na F15 passa a chamar a API (Neon) sem mudar a tela |
| `js/estudio.js` | Tela: desenha, abre as janelas das ferramentas e liga tudo ao motor |
| `js/modelo-motor.js` | **Motor do modelo** (E4): analisar relação (cardinalidade, % de correspondência, tipos), sugerir relações, situação (quebrada), caminho pelas relações ativas e `consultarModelo` (agrupa e resume passando pelas relações) |
| `js/modelo.js` | Tela Modelo e relacionamentos: cartões arrastáveis, linhas 1/∗ em SVG, criar por arrasto ou janela, detectar, editar/ativar/excluir, Explorar dados |
| `dados-demo/gerar.js` | Gera `atendimentos.csv`, `quadro.csv` e `exemplos.js` (fictícios, semente fixa) |
| `testes/motor.test.js` | Testes do motor M: `node apps/estudio/testes/motor.test.js` |
| `testes/modelo.test.js` | Testes do modelo: `node apps/estudio/testes/modelo.test.js` |

## Como o motor funciona

- Consulta = `{ id, nome, fonte: { arquivo, texto }, etapas: [...] }`.
- Etapa = `{ id, tipo, nome, ...dados }`. Tipos (catálogo `ETAPAS`):

| tipo | Nome padrão | M gerado |
|---|---|---|
| `fonte` | Fonte | `Csv.Document(File.Contents(...), [Delimiter=";", Encoding=65001])` |
| `promover` | Cabeçalhos Promovidos | `Table.PromoteHeaders(..., [PromoteAllScalars=true])` |
| `limparEspacos` | Espaços Removidos (automática na importação, colunas de texto) | `Table.TransformColumns(..., {{"COL", each Text.Combine(List.Select(Text.Split(_, " "), each _ <> ""), " "), type text}})` |
| `tipos` | Tipo Alterado | `Table.TransformColumnTypes(..., {{"COL", Int64.Type}})` |
| `escolher` | Outras Colunas Removidas | `Table.SelectColumns(..., {"A", "B"})` |
| `remover` | Colunas Removidas | `Table.RemoveColumns(..., {"A"})` |
| `filtrar` | Linhas Filtradas | `Table.SelectRows(..., each <expr>)` |
| `renomear` | Colunas Renomeadas | `Table.RenameColumns(..., {{"A", "B"}})` |
| `adicionar` | Personalização Adicionada | `Table.AddColumn(..., "COL", each <expr>, type number)` |
| `mesclar` | Consultas Mescladas | `Table.NestedJoin(..., {"K"}, outra, {"K"}, "outra", JoinKind.LeftOuter)` (coluna de tabelas, tipo `tabela`) |
| `expandir` | `<coluna> Expandido` | `Table.ExpandTableColumn(..., "outra", {"A"}, {"outra.A"})` |
| `acrescentar` | Consulta Acrescentada | `Table.Combine({..., outra})` |
| `agrupar` | Linhas Agrupadas | `Table.Group(..., {"K"}, {{"Soma", each List.Sum([C]), type number}, {"Contagem", each Table.RowCount(_), Int64.Type}})` |

- Consultas que usam outras: `executar(consulta, ate, todas)` recebe todas as consultas; referência circular e consulta inexistente viram mensagem. Renomear uma consulta atualiza quem a usa; excluir avisa quem depende dela. A janela de Mesclar/Acrescentar só oferece consultas que não criam ciclo.
- Junções (`JUNCOES`): LeftOuter, Inner, FullOuter, RightOuter, LeftAnti, RightAnti. Agregações (`AGREGACOES`): soma, média, mediana, mínimo, máximo, contar linhas, contar distintos.

- Nomes repetidos ganham número no fim, como no Power Query (`Tipo Alterado1`).
- Uma ferramenta usada com uma etapa do meio selecionada entra **logo depois** dela.
- Célula que não converte vira **Error** (a linha fica). Etapa que não roda (coluna sumiu) mostra a mensagem e oferece "ver a etapa anterior" ou "excluir".
- Tabela interna = `{ colunas: [{ nome, tipo }], linhas: [[...]] }`. Data = `'AAAA-MM-DD'`, hora = `'HH:MM:SS'`, data e hora = `'AAAA-MM-DDTHH:MM:SS'`.
- Expressões aceitas: `[Coluna]`, números, `"textos"`, `true/false/null`, `+ - * / &`, `= <> < <= > >=`, `and or not`, `if … then … else …`, `#date(a,m,d)`, `#time(h,m,s)` e as funções de `FUNCOES_M` (cada uma com grupo, sintaxe, descrição, equivalente no Excel e exemplo — base da futura central de funções, E5).

## Modelo (E4)

- Guardado junto das consultas: `modelo = { relacionamentos: [...], posicoes: { consulta: {x, y} } }`.
- Relação = `{ id, de: {consulta, coluna}, para: {consulta, coluna}, cardinalidade: 'N:1'|'1:1'|'N:N', direcao: 'unica'|'ambas', ativo }`. **`de` é o lado ∗ e `para` é o lado 1**; o Estúdio descobre isso sozinho (o lado com valores únicos é o 1).
- Como no Power BI: entre as mesmas duas tabelas só uma relação ativa (a nova entra inativa); tipos diferentes ou nenhum valor em comum bloqueiam; ∗:∗ é permitido com aviso; linhas sem par vão para "(em branco)".
- O filtro anda do 1 para o ∗ (direção única) ou nos dois sentidos (ambas). `consultarModelo` leva cada linha da tabela do valor até a do grupo seguindo esse caminho — é o que os Relatórios e o DAX vão usar.
- Renomear consulta atualiza as relações; excluir consulta remove as relações dela; coluna renomeada no Transformar dados deixa a relação "quebrada" (linha vermelha tracejada) com o motivo.
- Demonstração começa com `atendimentos[MATRICULA] ∗—1 quadro[MATRICULA]`.

**Por que JavaScript e não DuckDB nesta etapa:** abre na hora, sem baixar ~30 MB, roda nos testes do Node e cobre bem as bases da demonstração (milhares de linhas). O Estúdio do DashBI usa DuckDB para bases grandes; quando as bases do Neon chegarem, o executor de cada etapa pode passar a gerar SQL sem mudar o catálogo nem a tela.

## Etapas do Estúdio (pendências do módulo)

- [x] **E1** — Transformar dados: 6 ferramentas, etapas aplicadas, prévia por etapa, qualidade da coluna, código M só leitura (12/11/2026)
- [x] **E2** — Editor de M (12/11/2026; filtro revisado em 13/11: editar filtro existente, lista de valores própria, condição sem valor bloqueia; um conector por nível + grupos (parênteses) + "Lendo como" em português): barra `fx` editável (Enter aplica, Esc cancela) e Editor avançado (`let … in`, Ctrl+Enter aplica). `lerM`/`lerLinhaEtapa` no motor fazem o caminho de volta do `gerarM`; cada etapa precisa usar a etapa logo acima; funções fora do catálogo dão mensagem com a lista aceita. Filtro com várias condições (+/×) e E/OU antes de cada uma.
- [ ] Editar etapa pela janela da ferramenta (engrenagem), com o formulário já preenchido
- [x] **E3** — Mesclar (6 junções, várias chaves, prévia de % de correspondência; colunas a trazer com nome final editável, prefixo opcional desligado, ✎ na etapa Expandido para mudar depois), Acrescentar e Agrupar (13/11/2026). Importação já cria a etapa Espaços Removidos.
- [x] **E4** — Modelo e relacionamentos (13/11/2026): cartões, linhas 1/∗, criar arrastando coluna, detectar, validação ao vivo, direção do filtro, ativa/inativa, Explorar dados. O DAX passa a usar o modelo quando as Medidas vierem.
- [ ] **E5** — Central de funções M e DAX
- [ ] **E6** — Leitor de fórmulas
- [ ] Trazer Relatórios e Medidas DAX do Estúdio do DashBI

## Como testar localmente

1. `node apps/estudio/testes/motor.test.js` — deve terminar com "15 testes passaram."
2. `node apps/estudio/testes/modelo.test.js` — deve terminar com "6 testes passaram."
3. Abrir `apps/estudio/index.html` com o Live Server (ou `python3 -m http.server` dentro de `apps/estudio`).
