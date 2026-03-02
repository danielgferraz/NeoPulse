# PLAN: Metrics & Evolution Tracking

**Socratic Gate - Perguntas de Esclarecimento:**
Para criar o melhor sistema de métricas para você, preciso entender como você prefere visualizar esses dados:
1. **Frequência de Registro:** Para o peso corporal, você prefere um lembrete diário ao abrir o app ou um botão específico na Dashboard?
2. **Dashboards de Evolução:** Você prefere ver gráficos de linha (evolução no tempo) ou apenas resumos numéricos de "Recorde Pessoal" (ex: Maior carga no Agachamento)?
3. **Fotos de Progresso:** Seria interessante ter uma área para anexar fotos de "antes e depois" vinculadas ao registro de peso?

---

## 🎯 Visão Geral
Transformar o NeoPulse em um centro de inteligência de treino, registrando não apenas as séries, mas o progresso antropométrico (peso/medidas) e a progressão de carga (overload) automática baseada no histórico.

## 📱 Tipo do Projeto
**WEB** (Mobile-first)
**Agent Recomendado:** `backend-specialist` (para Schema/DB) + `frontend-specialist` (para Gráficos/UI)

## 🛠️ Stack Tecnológico
- **Database:** Dexie.js (novas tabelas: `bodyMetrics`, `personalRecords`).
- **Charts:** Chart.js ou Recharts (leve e responsivo).
- **Icons:** Lucide-react para identificar tipos de métricas.

## 📋 Divisão de Tarefas

### Fase 1: Expansão do Banco de Dados
- Criar tabela `bodyMetrics` (id, date, weight, bodyFat, muscleMass).
- Criar tabela `personalRecords` para rastrear a carga máxima por exercício.

### Fase 2: Interface de Registro (Daily Metrics)
- Nova View: `MetricsView.tsx` para entrada de dados corporais.
- Widget na Home mostrando o peso atual e a variação da semana.

### Fase 3: Analytics de Treino
- Gráfico de "Volume Total" por treino.
- Histórico de Carga por Exercício (ver a curva de força subindo).

### Fase 4: Gamificação e Insights
- "Badges" de conquista (ex: 10 treinos no mês, recorde de carga batido).
- Sugestão automática de carga baseada no RPE anterior.

## ✅ CHECKLIST de Verificação (Fase X)
- [ ] O usuário consegue registrar o peso em menos de 3 cliques?
- [ ] O banco de dados persiste as informações localmente (Dexie)?
- [ ] Os gráficos são responsivos e legíveis no celular?
- [ ] Existe uma forma de exportar ou limpar esses dados?
