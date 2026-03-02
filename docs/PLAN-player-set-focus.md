# Planejamento: Experiência Simplificada de Séries no Player

## Visão Geral
O usuário deseja simplificar a visão do `WorkoutTracker` durante a execução de um exercício. A intenção é reduzir a carga cognitiva ("poluição visual"), destacando apenas a **Série Atual**, enquanto as **Séries Passadas** (concluídas) e **Séries Futuras** (pendentes) são agrupadas ou encolhidas no layout.
Ao mesmo tempo, deve haver uma manobra fácil de retorno rápido caso exista erro nos dados de uma série passada antes de apertar "Concluir" no player.

## 1. Arquitetura da UI (`WorkoutTracker Focused Mode`)

A estrutura do `WorkoutTracker` será refatorada para aderir ao modo variante "Compact/Focused":

- **Estado Atual (Current Set)**:
  - Fica em total destaque no centro/topo (abaixo do Timer).
  - Todos os inputs de Peso, Repetições, e RPE ficam visíveis e em tamanhos altamente interativos (botões grandes, tipografia limpa).
  - O botão de `CHECK` (Concluído) se torna um grande *Call to Action* na base da série.

- **Estado Passado (Completed Sets)**:
  - Condensados em uma lista "sanfona" (Accordion) visualmente achatada, ou estilo "Comprovante" de extrato.
  - Exibe apenas um resumo dos dados inseridos (Ex: `Série 1 ✓ - 100kg x 12`).
  - Ao clicar na linha dela, a série se re-expande para baixo de forma isolada, permitindo reabrir os inputs originais e retificar correções passadas caso o usuário lembre subitamente de um erro.

- **Estado Futuro (Upcoming Sets)**:
  - Exibidos de forma extremamente minimizada e opaca (greyed-out).
  - Ficam abaixo da linha de rolagem exibindo apenas a contagem e as especificações da Meta (Ex: `Série 3 • Meta: 10 - 12 Reps`).

## 2. Alterações Lógicas (`WorkoutPlayerContext` e `WorkoutTracker`)

- Desacoplar parcialmente o loop de renderização do `WorkoutTracker` atual.
- As manipulações matemáticas e os preenchimentos automáticos do "set anterior" continuarão sendo validados pelo Player global, porém a forma como iteramos a renderização difere se o index é `< currentSetIndex`, `=== currentSetIndex`, ou `> currentSetIndex`.
- Quando o usuário quiser editar uma série do passado, o React Context não precisará invalidar a série ativa atual do cronômetro global, mas o Component Tracker gerenciará um state local de edição (ex: `[editingId, setEditingId]`).

## 3. Estratégia de Verificação e QA

- **Teste Unitário/Manual:** Concluir Série 1, Timer começar, perceber que anotou "10" reps, mas fez "12", expandir Série 1 sem pausar Timer da 2, arrumar os dados, colapsar Série 1, sem perder o relógio.
- **Checagem Visual:** Validar o layout no form-factor mobile minimizando pulos abruptos entre as séries. Os botões não devem sobrepor e a rolagem de "Séries Anteriores" não pode empurrar exageradamente a UI pra fora da tela.

## 4. Portão Socrático (Para aprovação do UX)
*(Responder e definir estas três pendências documentadas no chat antes da implementação!)*

1. O que acontece com a tela quando o cronômetro do descanso inicia (foco fica na anterior ou pula logo pra próxima)?
2. Qual o estilo do agrupamento (Lista encolhida/Sanfona ou tipo Carrossel arrastável lateral)?
3. O comportamento de pré-preenchimento herda de quem? (Da meta do treino, da série anterior física, ou vazio obrigatório)?
