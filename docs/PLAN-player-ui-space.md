# Plan: Player UI Space Optimization

**Socratic Gate - Perguntas de Esclarecimento:**
Antes de seguirmos com o código, tenho algumas perguntas para garantir que o espaço seja otimizado exatamente como você imagina:
1. **Controles (Play/Pause/Skip):** Podemos alinhá-los horizontalmente *ao lado* ou *abaixo* do texto do cronômetro, em vez de ocuparem linhas separadas?
2. **Modo Timer/Crono:** Você usaria esse seletor como ícones compactos (ex: ampulheta / relógio) dentro do próprio mostrador de tempo, em vez de botões grandes que ocupam a largura inteira?
3. **Redundância:** O texto "NOW PLAYING" e a barra de progresso no topo podem ser comprimidos ou combinados com o título do exercício para salvar espaço vertical?

*(Por favor, responda às perguntas acima ou nos instrua a prosseguir com o plano abaixo se ele te parecer ideal!)*

---

## 🎯 Visão Geral
Redistribuir e compactar a área do Cabeçalho e do Timer na tela do Player (PlayerView), liberando o máximo de espaço vertical possível para a exibição das Séries (WorkoutTracker) sem perder a usabilidade dos botões e a visibilidade do tempo.

## 📱 Tipo do Projeto
**WEB** (Mobile-first web app)
**Agent Recomendado:** `frontend-specialist` + Skill `frontend-design`

## 🏆 Critérios de Sucesso
- A seção superior (Header + Timer) deve ocupar idealmente no máximo 30-35% da altura da tela.
- Os controles do Timer continuam ergonomicamente acessíveis sem scroll.
- As séries do exercício atual (Tracker) ganham área folgada para visualização do histórico e das próximas repetições.

## 🛠️ Stack Tecnológico
- React + Tailwind CSS (Uso intensivo de flex/grid layout para agrupar elementos).
- Ícones Lucide-react (para substituir textos em botões secundários).

## 📁 Estrutura Afetada
- `views/PlayerView.tsx` (Layout principal e Header)
- `components/Timer.tsx` (Layout interno dos botões do relógio)

## 📋 Divisão de Tarefas

| Task | Componente | Operação | INPUT → OUTPUT → VERIFY |
|------|------------|----------|-------------------------|
| 1. Modificar Header | `PlayerView.tsx` | Reduzir espaçamentos ("NOW PLAYING", Título, Progresso). Agrupar título em uma única linha superior. | **IN:** Layout atual <br/> **OUT:** Header fino <br/> **VER:** Check UI height visualmente |
| 2. Redesenhar Timer | `Timer.tsx` | Transformar o botão "Timer / Crono" em Toggle pequeno. Colocar controles (Play/Skip/Reset) em uma única "Action Bar" embutida logo abaixo dos grandes números. | **IN:** Timer com blocos verticais <br/> **OUT:** Timer horizontalmente compacto <br/> **VER:** Botões funcionam, área vertical reduzida |
| 3. Ajustar Viewport | `PlayerView.tsx` | Ajustar flex-growth da área "scrollable" para garantir que o Tracker expanda o máximo possível. | **IN:** Margens do Tracker <br/> **OUT:** Tracker flui até o topo <br/> **VER:** Scrolling ocorre só depois de muitas séries |

## ✅ CHECKLIST de Verificação (Fase X)
- [ ] O Header e Timer estão combinados?
- [ ] Espaço em tela é favorável para as séries?
- [ ] Botões Play/Pause/Skip/Timer mode funcionam como o original?
- [ ] `npm run lint` passou (zero inlines de CSS)?
- [ ] Regra Anti-clichê & Anti-templating de CSS puritano do Frontend-specialist seguida.
