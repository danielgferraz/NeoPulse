# Plano de Redesign UI/UX: Tela de Treino Ativa (SessionView)

![Goal](NeoPulse Redesign)

Este documento foi gerado através do comando `/plan` e utiliza a especialização `frontend-design`. O objetivo é responder à necessidade de uma tela de treino mais compacta, intuitiva, com legibilidade aprimorada e liberdade máxima de alteração "on the fly".

---

## 🛑 1. Análise da Dor (O que está errado hoje?)

1. **Cronômetro Opressor:** O temporizador circular ocupa ~40% da tela. A psicologia visual (Fitts' Law e Visual Hierarchy) diz que a visão foca nele, não no input de carga/reps, que é a ação principal do app de treino.
2. **Contraste "Sumido" (Acessibilidade Cega):** Labels como "META", "KG", "REPS" e seus inputs usam a cor `zinc-800` sobre texturas escuras, falhando nas diretrizes WCAG (contraste cego) e dificultando a visualização na luz da academia.
3. **Rigidez Estrutural:** Alterar a ordem de um exercício ou substituir uma técnica exige a abertura de um modal extra (Playlist) ou cancelar a sessão. Você deveria poder editar diretamente do Tracker.

---

## 🎨 2. A Solução (Proposta de Design)

O time sugeriu uma arquitetura baseada nos princípios *Bento Grid* e de legibilidade limpa (*Clean Architecture UI*).

### A. Cronômetro Inteligente (Visibilidade Contextual e Dual-Mode)
- O temporizador gigante será exibido com destaque **apenas quando estiver rodando** e deverá minimizar/apagar quando não houver descanso ativo ou quando o tracker estiver ocioso.
- Será adicionado um controle rápido "Dual Mode" (Radio Button ou Toggle Pill) permitindo ao usuário alternar instantaneamente entre **Timer** (Contagem Regressiva para Descanso) e **Cronômetro** (Contagem Progressiva Livre).
- **Resultado:** Maior precisão de ferramentas conforme a necessidade da série atual e tela altamente limpa quando o atleta deve focar "apenas em bater o próprio peso da meta".

### B. High-Contrast Tracker (NeoBento)
- Os cards das séries serão redesenhados. Em vez de sumir no fundo preto:
    - Fundo do input mais claro (ex: `zinc-800/80` com contorno base).
    - Labels ("KG", "REPS", "META") passarão de `zinc-800` para `zinc-500` (maior claridade na academia).
    - A série atualmente ativa ganhará um "Glow" ou borda `[#00FF41]` em destaque marcante.

### C. Menu de Contexto Inline (Liberdade Intuitiva)
- Adição de um botão "Kebab Menu" ou botão direto no cabeçalho de título visível.
- Um clique abre um Bottom Sheet rápido com opções instantâneas:
    - *✏️ Editar Exercício Atual*
    - *🔁 Adicionar/Trocar (Biblioteca vs Livre)*
    - *🗑️ Remover da Sessão Atual*

## 📋 3. Task Breakdown (Próximos Passos Válidos no /create)

- [ ] **Fase 1: Motor do Tempo e Ocultação Inteligente**
   - Melhorar o componente Timer atual com botões unificados para Iniciar e trocar modais (Timer vs Stopwatch).
   - Ocultar/minimizar totalmente a box visual do tempo quando `isActive === false`.
- [ ] **Fase 2: Tracker Typo & Colors**
   - Atualizar a malha do Grid no `WorkoutTracker.tsx` com novos contrastes textuais e caixas destacadas.
- [ ] **Fase 3: Barra de Ações Rápidas (BottomSheet)**
   - Criar as opções de edição (Deletar, Incluir Nota, Editar Séries) de cada exercício na tela principal.

## 🤝 4. Verificação

Para confirmar que a mudança atingiu a usabilidade, as inputs de "Peso/Reps" devem estar nativamente visíveis sem necessidade de rolagem logo ao iniciar um exercício standard. Contrario da imagem enviada pelo usuário, a zona central da tela abrigará os dados!

---
*Gerado por projeto-planner e frontend-design protocol.*
