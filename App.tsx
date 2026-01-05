import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Timer from './components/Timer';
import UpdateChecker from './components/UpdateChecker';
import { Icons } from './constants';
import { WorkoutState, HistoryItem, ExerciseConfig } from './types';
import { getWorkoutTip } from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<WorkoutState>({
    routine: [
      { id: '1', name: 'Supino Reto', restTimes: [90, 90, 90, 90] }
    ],
    currentExerciseIndex: 0,
    currentSetIndex: 0,
    timeLeft: 90,
    isActive: false,
    lastTimestamp: 0,
  });

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showRoutineMenu, setShowRoutineMenu] = useState(false);
  const [tip, setTip] = useState<string | null>(null);
  const [loadingTip, setLoadingTip] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const currentExercise = useMemo(() =>
    state.routine[state.currentExerciseIndex] || state.routine[0],
    [state.routine, state.currentExerciseIndex]
  );

  // Sincronizar com o Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator && notifPermission === 'granted') {
      const updateSW = async () => {
        const registration = await navigator.serviceWorker.ready;
        if (registration.active) {
          registration.active.postMessage({
            type: 'UPDATE_TIMER',
            timeLeft: state.timeLeft,
            isActive: state.isActive,
            exerciseName: currentExercise.name
          });
        }
      };
      updateSW();
    }
  }, [state.timeLeft, state.isActive, currentExercise, notifPermission]);

  // Load/Save Persistência
  useEffect(() => {
    const savedHistory = localStorage.getItem('hyperlift_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));

    const savedState = localStorage.getItem('hyperlift_state_v4');
    if (savedState) {
      const parsed: WorkoutState = JSON.parse(savedState);
      let finalTimeLeft = parsed.timeLeft;
      if (parsed.isActive && parsed.lastTimestamp > 0) {
        const elapsed = Math.floor((Date.now() - parsed.lastTimestamp) / 1000);
        finalTimeLeft = Math.max(0, parsed.timeLeft - elapsed);
      }
      setState({
        ...parsed,
        timeLeft: finalTimeLeft,
        isActive: parsed.isActive && finalTimeLeft > 0
      });
    }
  }, []);

  useEffect(() => {
    const dataToSave = { ...state, lastTimestamp: Date.now() };
    localStorage.setItem('hyperlift_state_v4', JSON.stringify(dataToSave));
  }, [state]);

  // Timer Core
  useEffect(() => {
    let interval: any = null;
    if (state.isActive && state.timeLeft > 0) {
      interval = setInterval(() => {
        setState(prev => ({
          ...prev,
          timeLeft: Math.max(0, prev.timeLeft - 1),
          lastTimestamp: Date.now()
        }));
      }, 1000);
    } else if (state.timeLeft === 0 && state.isActive) {
      setState(prev => ({ ...prev, isActive: false }));
    }
    return () => clearInterval(interval);
  }, [state.isActive, state.timeLeft]);

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);
    if (permission === 'granted') {
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification("NeoPulse", { body: "Timer ativado!", silent: true });
    }
  };

  const handleSetComplete = () => {
    if (state.currentSetIndex < currentExercise.restTimes.length) {
      const nextSetIndex = state.currentSetIndex + 1;
      const nextRest = currentExercise.restTimes[Math.min(state.currentSetIndex, currentExercise.restTimes.length - 1)];
      setState(prev => ({
        ...prev,
        currentSetIndex: nextSetIndex,
        timeLeft: nextRest,
        isActive: true
      }));
    }
  };

  const finishExercise = () => {
    if (state.currentSetIndex === 0) return;

    // Salva no histórico
    const newItem = {
      id: Date.now().toString(),
      exercise: currentExercise.name,
      sets: state.currentSetIndex,
      timestamp: Date.now()
    };
    const newHistory = [newItem, ...history].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem('hyperlift_history', JSON.stringify(newHistory));

    // Próximo exercício se houver
    const nextIndex = state.currentExerciseIndex + 1;
    if (nextIndex < state.routine.length) {
      setState(prev => ({
        ...prev,
        currentExerciseIndex: nextIndex,
        currentSetIndex: 0,
        isActive: false,
        timeLeft: prev.routine[nextIndex].restTimes[0] || 90
      }));
    } else {
      // Fim do treino
      setState(prev => ({
        ...prev,
        currentExerciseIndex: 0,
        currentSetIndex: 0,
        isActive: false,
        timeLeft: prev.routine[0].restTimes[0] || 90
      }));
      alert("Treino Finalizado! Ótimo trabalho.");
    }
    setTip(null);
  };

  const addExerciseToRoutine = () => {
    const newEx: ExerciseConfig = {
      id: Date.now().toString(),
      name: 'Novo Exercício',
      restTimes: [60, 60, 60]
    };
    setState(prev => ({
      ...prev,
      routine: [...prev.routine, newEx]
    }));
  };

  const updateExerciseName = (id: string, name: string) => {
    setState(prev => ({
      ...prev,
      routine: prev.routine.map(ex => ex.id === id ? { ...ex, name } : ex)
    }));
  };

  const moveExercise = (index: number, direction: 'up' | 'down') => {
    setState(prev => {
      const newRoutine = [...prev.routine];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newRoutine.length) return prev;

      const temp = newRoutine[index];
      newRoutine[index] = newRoutine[targetIndex];
      newRoutine[targetIndex] = temp;

      return {
        ...prev,
        routine: newRoutine,
        // Ajusta o index atual se o exercício que moveu for o ativo
        currentExerciseIndex: prev.currentExerciseIndex === index ? targetIndex :
          prev.currentExerciseIndex === targetIndex ? index : prev.currentExerciseIndex
      };
    });
  };

  const removeExercise = (id: string) => {
    setState(prev => {
      if (prev.routine.length <= 1) return prev;
      const filtered = prev.routine.filter(ex => ex.id !== id);
      return {
        ...prev,
        routine: filtered,
        currentExerciseIndex: 0,
        currentSetIndex: 0,
        isActive: false
      };
    });
  };

  const updateRestTime = (exId: string, setIdx: number, delta: number) => {
    setState(prev => {
      const newRoutine = prev.routine.map(ex => {
        if (ex.id !== exId) return ex;
        const newRests = [...ex.restTimes];
        newRests[setIdx] = Math.max(5, newRests[setIdx] + delta);
        return { ...ex, restTimes: newRests };
      });
      return { ...prev, routine: newRoutine };
    });
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center p-6 pb-36 text-white overflow-x-hidden">
      {/* Header */}
      <header className="w-full flex justify-between items-center mb-6 pt-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#00FF41] rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(0,255,65,0.4)]">
            <i className="fa-solid fa-bolt-lightning text-black text-sm"></i>
          </div>
          <h1 className="text-xl font-black italic tracking-tighter text-[#00FF41]">NEOPULSE</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={requestPermission} className="w-11 h-11 rounded-2xl flex items-center justify-center border border-zinc-800 bg-zinc-900 text-zinc-400 active:scale-90">
            <i className={`fa-solid ${notifPermission === 'granted' ? 'fa-bell text-[#00FF41]' : 'fa-bell-slash'}`}></i>
          </button>
          <button onClick={() => setShowRoutineMenu(!showRoutineMenu)} className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all border ${showRoutineMenu ? 'bg-[#00FF41] text-black border-[#00FF41]' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}>
            <i className="fa-solid fa-list-ul"></i>
          </button>
        </div>
      </header>

      {/* Main UI */}
      {!showRoutineMenu ? (
        <main className="w-full max-w-md flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Active Exercise Card */}
          <section className="bg-zinc-900/50 border border-zinc-800/50 p-6 rounded-[2rem] relative">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <span className="text-[10px] font-black text-[#00FF41] tracking-[0.2em] uppercase">Em Execução</span>
                <h2 className="text-3xl font-black uppercase tracking-tight text-white">{currentExercise.name}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex gap-1">
                    {currentExercise.restTimes.map((_, i) => (
                      <div key={i} className={`h-1.5 w-6 rounded-full transition-all duration-500 ${i < state.currentSetIndex ? 'bg-[#00FF41]' : 'bg-zinc-800'}`} />
                    ))}
                  </div>
                  <span className="text-[10px] text-zinc-600 font-black uppercase tracking-tighter ml-1">Série {state.currentSetIndex}/{currentExercise.restTimes.length}</span>
                </div>
              </div>
              <button onClick={() => { setLoadingTip(true); getWorkoutTip(currentExercise.name).then(t => { setTip(t); setLoadingTip(false); }) }}
                className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-[#00FF41]">
                {loadingTip ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <Icons.Sparkles />}
              </button>
            </div>
            {tip && <div className="mt-4 p-4 bg-black/30 rounded-2xl border border-[#00FF41]/10 text-xs text-zinc-400 italic">"{tip}"</div>}
          </section>

          {/* Timer Section */}
          <div className="flex-1 flex items-center justify-center py-6">
            <Timer
              timeLeft={state.timeLeft}
              isActive={state.isActive}
              duration={currentExercise.restTimes[Math.max(0, state.currentSetIndex - 1)] || 90}
              onToggle={() => setState(p => ({ ...p, isActive: !p.isActive }))}
              onReset={() => setState(p => ({ ...p, isActive: false, timeLeft: currentExercise.restTimes[Math.max(0, p.currentSetIndex - 1)] || 90 }))}
              onAdjust={(delta) => setState(p => ({ ...p, timeLeft: Math.max(1, p.timeLeft + delta) }))}
            />
          </div>

          {/* Bottom History/Status Bar */}
          <div className="flex items-center gap-4 px-2 opacity-50 mb-4">
            <div className="flex-1 h-[1px] bg-zinc-800"></div>
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Próximo: {state.routine[state.currentExerciseIndex + 1]?.name || 'Fim'}</span>
            <div className="flex-1 h-[1px] bg-zinc-800"></div>
          </div>
        </main>
      ) : (
        /* Routine Editor Menu */
        <main className="w-full max-w-md flex-1 flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">Minha Rotina</h2>
            <button onClick={addExerciseToRoutine} className="bg-[#00FF41] text-black px-4 py-2 rounded-xl text-[10px] font-black tracking-widest">+ ADICIONAR</button>
          </div>
          <UpdateChecker />

          <div className="space-y-4 pb-20">
            {state.routine.map((ex, idx) => (
              <div key={ex.id} className={`p-5 rounded-3xl border transition-all ${state.currentExerciseIndex === idx ? 'bg-zinc-900 border-[#00FF41]' : 'bg-zinc-900/40 border-zinc-800'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex flex-col gap-1">
                    <button onClick={() => moveExercise(idx, 'up')} className="text-zinc-600 hover:text-[#00FF41] disabled:opacity-0" disabled={idx === 0}><i className="fa-solid fa-chevron-up"></i></button>
                    <button onClick={() => moveExercise(idx, 'down')} className="text-zinc-600 hover:text-[#00FF41] disabled:opacity-0" disabled={idx === state.routine.length - 1}><i className="fa-solid fa-chevron-down"></i></button>
                  </div>
                  <input
                    className="flex-1 bg-transparent border-none text-xl font-black focus:outline-none uppercase placeholder:text-zinc-800"
                    value={ex.name}
                    onChange={(e) => updateExerciseName(ex.id, e.target.value)}
                    placeholder="Nome do Exercício"
                  />
                  <button onClick={() => removeExercise(ex.id)} className="w-8 h-8 text-red-900 hover:text-red-500 transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {ex.restTimes.map((rest, ridx) => (
                    <div key={ridx} className="bg-black/40 px-3 py-2 rounded-xl flex items-center gap-2 border border-zinc-800">
                      <span className="text-[10px] font-bold text-zinc-600">S{ridx + 1}</span>
                      <span className="mono font-black text-xs w-8">{rest}s</span>
                      <div className="flex flex-col">
                        <button onClick={() => updateRestTime(ex.id, ridx, 5)} className="text-[10px] text-[#00FF41] active:scale-125"><i className="fa-solid fa-caret-up"></i></button>
                        <button onClick={() => updateRestTime(ex.id, ridx, -5)} className="text-[10px] text-[#00FF41] active:scale-125"><i className="fa-solid fa-caret-down"></i></button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setState(p => ({
                      ...p,
                      routine: p.routine.map(e => e.id === ex.id ? { ...e, restTimes: [...e.restTimes, 60] } : e)
                    }))}
                    className="w-10 h-10 rounded-xl bg-zinc-800 border border-dashed border-zinc-700 flex items-center justify-center text-zinc-500"
                  >
                    <i className="fa-solid fa-plus text-xs"></i>
                  </button>
                  {ex.restTimes.length > 1 && (
                    <button
                      onClick={() => setState(p => ({
                        ...p,
                        routine: p.routine.map(e => e.id === ex.id ? { ...e, restTimes: e.restTimes.slice(0, -1) } : e)
                      }))}
                      className="w-10 h-10 rounded-xl bg-red-950/10 border border-red-900/20 flex items-center justify-center text-red-900"
                    >
                      <i className="fa-solid fa-minus text-xs"></i>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* Footer Controls */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black to-transparent safe-bottom z-[100]">
        <div className="max-w-md mx-auto flex gap-4">
          <button
            onClick={handleSetComplete}
            disabled={state.currentSetIndex >= currentExercise.restTimes.length || showRoutineMenu}
            className={`flex-1 h-16 rounded-2xl font-black text-sm tracking-[0.2em] flex items-center justify-center transition-all active:scale-[0.96] shadow-2xl ${state.currentSetIndex >= currentExercise.restTimes.length || showRoutineMenu
              ? 'bg-zinc-900 text-zinc-700 border border-zinc-800'
              : 'bg-white text-black'
              }`}
          >
            SÉRIE OK <i className="fa-solid fa-plus-circle ml-2 text-base opacity-20"></i>
          </button>

          <button
            onClick={finishExercise}
            disabled={state.currentSetIndex === 0 || showRoutineMenu}
            className={`w-20 h-16 rounded-2xl flex flex-col items-center justify-center border transition-all active:scale-[0.96] ${state.currentSetIndex === 0 || showRoutineMenu ? 'bg-zinc-950 border-zinc-900 text-zinc-800' : 'bg-zinc-900 border-zinc-800 text-[#00FF41]'
              }`}
          >
            <Icons.Check />
            <span className="text-[9px] font-black mt-1 uppercase">{state.currentExerciseIndex < state.routine.length - 1 ? 'Next' : 'Fim'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;