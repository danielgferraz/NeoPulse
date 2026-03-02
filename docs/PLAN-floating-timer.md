# Plano de Implementação: Arquitetura "NeoPulse Player" e Dificuldade (RPE)

## 🎯 Conceito Central: Treino como uma Estação ("Spotify Style")
A sessão de treino deixa de ser uma "tela blocante" para se transformar em um **Estado Global**. 
O usuário interage com o treino através de um Mini-Player persitente na base do app. Quando ativado (tocado), o player expande revelando a tela *Now Playing* (Exercício Atual) e a fila de exercícios seguintes (a "Playlist").

## 🛠️ Objetivos
1. **Globalização**: Mini-Player presente em todas as telas, rodando o timer em segundo plano sem travar a navegação.
2. **Liberdade CRUD Extrema (On-the-fly)**: Editar, remover ou adicionar séries e exercícios a qualquer momento, *mesmo que o cronômetro esteja rodando*.
3. **Foco na Ação (Spotlight)**: A série ativa ganha um destaque visual massivo em tela cheia (Expanded View) para ser lida de longe.
4. **Métricas de Fundo (RPE)**: Adição de botões/seletor de dificuldade 1-10 ao final da série.

---

## 🏗️ Fase 1: Motor do Player (State Elevation)
`SessionView.tsx` será desmontado. A lógica pesada vai para a nuvem local.

**1.1. `contexts/WorkoutPlayerContext.tsx`**
- Gerencia o status `isPlaying`, `currentTrack` (Exercício Atual), `queue` (Fila de exercícios).
- Controla o timer central (`timeLeft`, `isStopwatch`).
- Provê as funções CRUD globais: `skipToNext`, `addExerciseToQueue`, `removeExercise`, `editCurrentSets`.

**1.2. Integração com o Dexie**
- Toda alteração feita na fila `queue` durante o treino reflete em mutações de backup no localStorage/IndexedDB, para não perder a sessão em caso de fechamento do app.

---

## 🎧 Fase 2: O "Mini-Player" (HUD)
O componente que vive em `App.tsx` na base da tela (absoluto).

- **Layout**: Ícone do músculo alvo, Nome do exercício em texto rolável (*marquee* se não couber), o tempo correndo no meio e botões de play/pause + avançar à direita.
- **Micro-interações**: Uma barra de progresso linear na base do player (1px de espessura) que indica o andamento da sessão baseada na quantidade total de séries previstas.
- Clicar na área fora dos botões dispara a animação para subir o "Bottom Sheet" do Player Expandido.

---

## 🚀 Fase 3: A Tela "Now Playing" e Edição Livre
A nova `components/ExpandedWorkoutPlayer.tsx` substitui visualmente a SessionView.

**3.1. Destaque da Série Atual**
- A série atual tem o triplo do tamanho das outras. Textos imensos focados em Peso, Repetições e as informações de descanso.
- Caixas de texto *Inline Edit*: Clicar no peso/rep permite editar imediatamente. O teclado se fecha e o valor já atualiza no `queue`.

**3.2. Edição de Séries (CRUD Rápido)**
- Adicionar/Remover botões em "+" e "-" grudados ao lado das séries, sem burocracia do menu superior.

**3.3. Dificuldade de Série (RPE - Rate of Perceived Exertion)**
- Assim que o usuário clica em "Concluir Série", uma tira de 10 botões surge instantaneamente sob a série deslizando (*Slide in*).
- O usuário toca entre 1 (fácil) e 10 (falha), salta para o repouso.
- Precisa de modificação na interface do Banco de Dados `Exercise` ou tabela de Log separada.

---

## 📋 Fase 4: O "Up Next" (Playlist / Fila)
Aba oculta (deslizar para cima, ou ícone de listagem) que mostra os próximos exercícios.
- Traz Drag and Drop para reordenar a fila dinamicamente.
- Função de *Swipe to Delete* (Deslizar para a esquerda) remove um exercício da fila.

---

## ✅ Verificações Finais
- [ ] O Mini-Player resiste a transições do React Router.
- [ ] O componente `WorkoutTracker` aguenta modo de "Spotlight" (escalável).
- [ ] A inclusão da propriedade de dificuldade (RPE) mantém salvamento e histórico retrocompatível para exercícios anteriores do BD.
- [ ] Verificar a lógica de adição dinâmica de exercícios com 0 atritos de fluxo.

---

## 🤖 Agentes Opcionais Durante Execução
- `frontend-specialist`: Contextos React e React-Router. Estilo do Player e Animações Framer Motion/CSS.
- `database-design`: Estruturação da Playlist e Persistência do RPE.
