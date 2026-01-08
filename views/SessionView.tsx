import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import Timer from '../components/Timer';
import { NotificationService } from '../services/notificationService';
import { useTheme } from '../contexts/ThemeContext';
import { WidgetService } from '../services/widgetService';
import { Preferences } from '@capacitor/preferences';

const SessionView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const trainingId = parseInt(id || '0');
    const isFreeTraining = trainingId === 0;
    const navigate = useNavigate();
    const { theme, soundMode, hapticPattern } = useTheme();

    const training = useLiveQuery(async () =>
        isFreeTraining ? { id: 0, name: 'Treino Livre', order: -1 } : await db.trainings.get(trainingId)
        , [trainingId, isFreeTraining]);
    const exercises = useLiveQuery(() =>
        db.exercises.where('trainingId').equals(trainingId).sortBy('order')
        , [trainingId]);

    // Local State
    const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
    const [currentSetIndex, setCurrentSetIndex] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [timeLeft, setTimeLeft] = useState(90);
    const [isStopwatch, setIsStopwatch] = useState(false);
    const [stopwatchTime, setStopwatchTime] = useState(0);
    const [hasRestored, setHasRestored] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [showFinishConfirm, setShowFinishConfirm] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [addName, setAddName] = useState('');
    const [addSets, setAddSets] = useState(3);
    const [addRest, setAddRest] = useState(60);
    const lastSessionIndices = useRef({ exercise: -1, set: -1 });

    const currentExercise = useMemo(() => exercises?.[currentExerciseIndex], [exercises, currentExerciseIndex]);

    // Init Notifications
    useEffect(() => {
        NotificationService.init();

        const listener = NotificationService.addListener('localNotificationActionPerformed', (action) => {
            console.log("Notification Action:", action.actionId);
            if (action.actionId === 'SET_COMPLETE') {
                window.dispatchEvent(new CustomEvent('NEOPULSE_NEXT_SET'));
            } else if (action.actionId === 'PAUSE_TIMER') {
                window.dispatchEvent(new CustomEvent('NEOPULSE_PAUSE'));
            } else if (action.actionId === 'RESET_TIMER') {
                window.dispatchEvent(new CustomEvent('NEOPULSE_RESET'));
            }
        });

        return () => { listener.then(l => l.remove()); };
    }, []);

    // Handle Events from Notification
    useEffect(() => {
        const nextSetHandler = () => handleSetComplete();
        const pauseHandler = () => setIsActive(prev => !prev);
        const resetHandler = () => {
            setIsActive(false);
            if (isStopwatch) setStopwatchTime(0);
            else if (currentExercise) setTimeLeft(currentExercise.restTimes[currentSetIndex] || 60);
        };

        window.addEventListener('NEOPULSE_NEXT_SET', nextSetHandler);
        window.addEventListener('NEOPULSE_PAUSE', pauseHandler);
        window.addEventListener('NEOPULSE_RESET', resetHandler);

        return () => {
            window.removeEventListener('NEOPULSE_NEXT_SET', nextSetHandler);
            window.removeEventListener('NEOPULSE_PAUSE', pauseHandler);
            window.removeEventListener('NEOPULSE_RESET', resetHandler);
        };
    }, [currentExercise, currentSetIndex, isStopwatch]);

    // Timer & Stopwatch Logic
    useEffect(() => {
        let interval: any = null;

        if (isActive && !isStopwatch) {
            NotificationService.showStickyNotification(
                `Treino: ${currentExercise?.name}`,
                `Série ${currentSetIndex + 1} | Descanso: ${timeLeft}s`,
                !isActive,
                1001,
                'neopulse_ticker'
            );

            if (timeLeft > 0) {
                interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
            } else {
                setIsActive(false);
                scheduleAlert();
            }
        } else if (isActive && isStopwatch) {
            NotificationService.showStickyNotification(
                `Treino: ${currentExercise?.name}`,
                `Cronômetro: ${stopwatchTime}s`,
                !isActive,
                1001,
                'neopulse_ticker'
            );
            interval = setInterval(() => setStopwatchTime(prev => prev + 1), 1000);
        } else if (!isActive && currentExercise && hasRestored) {
            NotificationService.showStickyNotification(
                `Pausado: ${currentExercise?.name}`,
                isStopwatch ? `Cronômetro: ${stopwatchTime}s` : `Série ${currentSetIndex + 1} | Pausado em ${timeLeft}s`,
                true,
                1001,
                'neopulse_ticker'
            );
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isActive, timeLeft, stopwatchTime, isStopwatch, currentExercise, currentSetIndex, hasRestored]);

    // Persistence: Restore state
    useEffect(() => {
        const restoreSession = async () => {
            try {
                const { value } = await Preferences.get({ key: 'neopulse_persistent_session' });
                if (value) {
                    const saved = JSON.parse(value);
                    if (saved.trainingId === trainingId) {
                        console.log("Restoring session...", saved);
                        setCurrentExerciseIndex(saved.exerciseIndex);
                        setCurrentSetIndex(saved.setIndex);

                        const now = Date.now();
                        const elapsed = Math.floor((now - saved.lastTimestamp) / 1000);

                        if (saved.isActive) {
                            if (saved.isStopwatch) {
                                setStopwatchTime(saved.stopwatchTime + elapsed);
                                setIsStopwatch(true);
                                setIsActive(true);
                            } else {
                                const newTimeLeft = Math.max(0, saved.timeLeft - elapsed);
                                setTimeLeft(newTimeLeft);
                                setIsStopwatch(false);
                                if (newTimeLeft > 0) {
                                    setIsActive(true);
                                }
                            }
                        } else {
                            setTimeLeft(saved.timeLeft);
                            setStopwatchTime(saved.stopwatchTime);
                            setIsStopwatch(saved.isStopwatch);
                            setIsActive(false);
                        }
                        // Update ref so that reset effect knows we've already set these
                        lastSessionIndices.current = { exercise: saved.exerciseIndex, set: saved.setIndex };
                    }
                }
            } catch (e) {
                console.error("Error restoring session:", e);
            } finally {
                setHasRestored(true);
            }
        };

        restoreSession();
    }, [trainingId]);

    // Persistence: Auto-save state
    useEffect(() => {
        if (!hasRestored || !exercises || exercises.length === 0) return;

        Preferences.set({
            key: 'neopulse_persistent_session',
            value: JSON.stringify({
                trainingId,
                exerciseIndex: currentExerciseIndex,
                setIndex: currentSetIndex,
                exercise: currentExercise.name,
                next: exercises[currentExerciseIndex + 1]?.name || 'Fim do Treino',
                totalSets: currentExercise.restTimes.length + 1,
                timeLeft,
                isActive,
                isStopwatch,
                stopwatchTime,
                lastTimestamp: Date.now()
            })
        });
    }, [trainingId, currentExerciseIndex, currentSetIndex, timeLeft, isActive, isStopwatch, stopwatchTime, hasRestored, exercises]);

    // Reset timer whenever exercise/set changes
    useEffect(() => {
        if (currentExercise && hasRestored) {
            const isDifferent = lastSessionIndices.current.exercise !== currentExerciseIndex ||
                lastSessionIndices.current.set !== currentSetIndex;

            if (isDifferent) {
                const duration = currentExercise.restTimes[Math.min(currentSetIndex, currentExercise.restTimes.length - 1)] || 90;
                setTimeLeft(duration);
                lastSessionIndices.current = { exercise: currentExerciseIndex, set: currentSetIndex };

                // Sync widget (Initial state for this exercise/set)
                if (exercises) {
                    WidgetService.syncSession({
                        exercise: currentExercise.name,
                        next: exercises[currentExerciseIndex + 1]?.name || 'Fim do Treino',
                        currentSet: currentSetIndex + 1,
                        totalSets: currentExercise.restTimes.length + 1,
                        timerEnd: null
                    });
                }
            }
        }
    }, [currentExercise, currentSetIndex, exercises, currentExerciseIndex, hasRestored]);

    const scheduleAlert = async () => {
        await NotificationService.showStickyNotification(
            "Tempo Esgotado! 🔔",
            `Prepare-se para: ${currentExercise?.name}`,
            false, // isPaused
            2002 // Alert ID
        );
    };

    const handleSetComplete = async () => {
        if (!currentExercise) return;

        if (currentSetIndex < currentExercise.restTimes.length) {
            const restDuration = currentExercise.restTimes[currentSetIndex];
            const nextSet = currentSetIndex + 1;
            setCurrentSetIndex(nextSet);
            setTimeLeft(restDuration);
            setIsActive(true);

            if (exercises) {
                WidgetService.syncSession({
                    exercise: currentExercise.name,
                    next: exercises[currentExerciseIndex + 1]?.name || 'Fim do Treino',
                    currentSet: nextSet + 1,
                    totalSets: currentExercise.restTimes.length + 1,
                    timerEnd: Date.now() + (restDuration * 1000)
                });
            }
        } else {
            const lastRest = currentExercise.restTimes[currentExercise.restTimes.length - 1];
            finishExercise(lastRest);
        }
    };

    const finishExercise = async (initialRest?: number) => {
        if (!currentExercise || !training || !exercises) return;

        if (currentExerciseIndex < exercises.length - 1) {
            const nextExercise = exercises[currentExerciseIndex + 1];
            setCurrentExerciseIndex(prev => prev + 1);
            setCurrentSetIndex(0);

            const restTime = initialRest || 60;
            setTimeLeft(restTime);
            setIsActive(true);

            WidgetService.syncSession({
                exercise: nextExercise.name,
                next: exercises[currentExerciseIndex + 2]?.name || 'Fim do Treino',
                currentSet: 1,
                totalSets: nextExercise.restTimes.length + 1,
                timerEnd: Date.now() + (restTime * 1000)
            });
        } else {
            handleFinalFinish();
        }
    };

    const handleFinalFinish = async () => {
        if (!training || !exercises) return;
        await db.history.add({
            exerciseName: "Sessão Completa",
            sets: exercises.length,
            trainingName: training.name,
            timestamp: Date.now()
        });
        await finalizeAndNavigate();
    };

    const handleCancelWorkout = async () => {
        await Preferences.remove({ key: 'neopulse_persistent_session' });
        WidgetService.syncSession(null);
        navigate('/');
    };

    const handleManualFinish = async () => {
        if (!training || !exercises) return;
        await db.history.add({
            exerciseName: "Sessão Finalizada",
            sets: currentExerciseIndex + 1,
            trainingName: training.name,
            timestamp: Date.now()
        });
        await finalizeAndNavigate();
    };

    const finalizeAndNavigate = async () => {
        const recentHistory = await db.history.where('timestamp').above(Date.now() - 30 * 24 * 60 * 60 * 1000).toArray();
        const weightLogs = await db.weightLogs.orderBy('timestamp').reverse().limit(1).toArray();

        WidgetService.sync({
            count: recentHistory.length,
            goal: parseInt(localStorage.getItem('neopulse_monthly_goal') || '12'),
            weight: weightLogs[0]?.weight?.toString() || '---'
        });

        await Preferences.remove({ key: 'neopulse_persistent_session' });
        WidgetService.syncSession(null);
        navigate(`/summary?tid=${trainingId}&dur=00:00&free=${isFreeTraining}`);
    };

    const addFreeExercise = async () => {
        if (!addName) return;

        await db.exercises.add({
            trainingId: 0,
            name: addName.toUpperCase(),
            restTimes: Array(Math.max(0, addSets - 1)).fill(addRest),
            order: exercises?.length || 0
        });

        setShowAddModal(false);
        setAddName('');
        setAddSets(3);
        setAddRest(60);
    };

    function currentExercisesCount() {
        return currentExerciseIndex + 1;
    }

    const modals = (
        <>
            {showAddModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[32px] p-8 animate-in zoom-in-95 duration-300 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Novo Exercício</h3>
                            <button title="Fechar" onClick={() => setShowAddModal(false)} className="text-zinc-500 hover:text-white">
                                <i className="fa-solid fa-times text-lg"></i>
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black uppercase text-[#00FF41] tracking-widest block mb-2">Nome do Exercício</label>
                                <input
                                    autoFocus
                                    className="w-full bg-black/40 border border-zinc-800 rounded-2xl px-5 py-4 text-white font-bold uppercase focus:border-[#00FF41] outline-none transition-colors"
                                    placeholder="EX: SUPINO INCLINADO"
                                    value={addName}
                                    onChange={(e) => setAddName(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest block mb-2">Séries</label>
                                    <div className="bg-black/40 border border-zinc-800 rounded-2xl flex items-center p-1">
                                        <button title="Diminuir Séries" onClick={() => setAddSets(Math.max(1, addSets - 1))} className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-white"><i className="fa-solid fa-minus"></i></button>
                                        <span className="flex-1 text-center font-black text-white italic text-lg">{addSets}</span>
                                        <button title="Aumentar Séries" onClick={() => setAddSets(addSets + 1)} className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-white"><i className="fa-solid fa-plus"></i></button>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest block mb-2">Descanso (s)</label>
                                    <div className="bg-black/40 border border-zinc-800 rounded-2xl flex items-center p-1">
                                        <button title="Reduzir Descanso" onClick={() => setAddRest(Math.max(0, addRest - 15))} className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-white"><i className="fa-solid fa-minus"></i></button>
                                        <span className="flex-1 text-center font-black text-white italic text-lg">{addRest}s</span>
                                        <button title="Aumentar Descanso" onClick={() => setAddRest(addRest + 15)} className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-white"><i className="fa-solid fa-plus"></i></button>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={addFreeExercise}
                                disabled={!addName}
                                style={{ backgroundColor: theme.primary }}
                                className="w-full py-5 rounded-2xl text-black font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-30 disabled:grayscale mt-4"
                            >
                                Confirmar Adição
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCancelConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[32px] p-8 animate-in zoom-in-95 duration-300 shadow-2xl">
                        <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Cancelar Treino?</h3>
                        <p className="text-zinc-400 text-sm leading-relaxed mb-8">Todo o progresso desta sessão será perdido. Tem certeza que deseja sair?</p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleCancelWorkout}
                                className="h-14 rounded-2xl font-black text-xs tracking-widest uppercase transition-all active:scale-95 bg-red-600 text-white"
                            >
                                Sim, Cancelar
                            </button>
                            <button
                                onClick={() => setShowCancelConfirm(false)}
                                className="h-14 rounded-2xl font-black text-xs tracking-widest uppercase text-zinc-500 hover:text-white transition-colors"
                            >
                                Voltar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showFinishConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[32px] p-8 animate-in zoom-in-95 duration-300 shadow-2xl">
                        <h3 className="text-xl font-black text-white uppercase tracking-tight mb-2">Finalizar Treino?</h3>
                        <p className="text-zinc-400 text-sm leading-relaxed mb-8">Deseja encerrar o treino agora e salvar o progresso atual no histórico?</p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleManualFinish}
                                className="h-14 rounded-2xl font-black text-xs tracking-widest uppercase transition-all active:scale-95 bg-[#00FF41] text-black"
                            >
                                Sim, Finalizar
                            </button>
                            <button
                                onClick={() => setShowFinishConfirm(false)}
                                className="h-14 rounded-2xl font-black text-xs tracking-widest uppercase text-zinc-500 hover:text-white transition-colors"
                            >
                                Voltar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    // Widget Command Polling and Cleanup
    useEffect(() => {
        const checkCommands = async () => {
            const res = await Preferences.get({ key: 'neopulse_widget_command' });
            if (res.value) {
                const cmd = res.value;
                await Preferences.remove({ key: 'neopulse_widget_command' });

                if (cmd === 'pause') setIsActive(prev => !prev);
                else if (cmd === 'reset') {
                    setIsActive(false);
                    if (isStopwatch) setStopwatchTime(0);
                    else if (currentExercise) setTimeLeft(currentExercise.restTimes[currentSetIndex] || 60);
                } else if (cmd === 'next') {
                    handleSetComplete();
                }
            }
        };

        const interval = setInterval(checkCommands, 500);
        return () => {
            clearInterval(interval);
            WidgetService.syncSession(null);
            Preferences.remove({ key: 'neopulse_widget_command' });
            NotificationService.cancel(1001);
        };
    }, [currentExercise, currentSetIndex, isStopwatch, exercises, currentExerciseIndex]);

    const activeExerciseSets = useMemo(() => {
        if (!currentExercise) return [];
        return Array.from({ length: currentExercise.restTimes.length + 1 });
    }, [currentExercise]);

    if (!exercises || exercises.length === 0) {
        return (
            <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-10 z-[60]">
                <div className="w-20 h-20 rounded-full bg-zinc-900 flex items-center justify-center mb-6 border border-zinc-800">
                    <i className="fa-solid fa-dumbbell text-2xl text-zinc-700"></i>
                </div>
                <h3 className="text-xl font-black text-white uppercase italic mb-2">Treino Livre</h3>
                <p className="text-zinc-500 mb-8 text-center text-sm">Adicione seu primeiro exercício para começar.</p>
                <button
                    onClick={() => setShowAddModal(true)}
                    style={{ backgroundColor: theme.primary }}
                    className="w-full max-w-xs py-4 rounded-2xl text-black font-black uppercase tracking-widest active:scale-95 transition-transform"
                >
                    + Adicionar Exercício
                </button>
                <button
                    onClick={() => navigate('/')}
                    className="mt-6 text-zinc-600 font-bold uppercase text-[10px] tracking-widest hover:text-white"
                >
                    Voltar
                </button>
                {modals}
            </div>
        );
    }

    if (!currentExercise || !training) return <div className="p-10 text-center text-zinc-500">Carregando Sessão...</div>;

    return (
        <div className="fixed inset-0 bg-black flex flex-col animate-in fade-in duration-500 overflow-hidden z-[60]">
            {/* Header: Exercise Info */}
            <div className="p-6 pt-10 sm:p-8 sm:pt-12">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black uppercase text-[#00FF41] tracking-[0.2em] opacity-80">
                        Exercício {currentExerciseIndex + 1}/{exercises.length}
                    </span>
                    {isFreeTraining && (
                        <button
                            title="Adicionar Exercício"
                            onClick={() => setShowAddModal(true)}
                            className="bg-zinc-900 text-white w-8 h-8 rounded-lg flex items-center justify-center border border-zinc-800 active:scale-90 transition-transform"
                        >
                            <i className="fa-solid fa-plus text-[10px]"></i>
                        </button>
                    )}
                </div>
                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white leading-none break-words">
                    {currentExercise.name}
                </h2>

                {/* Set Progress Dashes */}
                <div className="flex gap-1.5 mt-3 mb-1">
                    {activeExerciseSets.map((_, i) => (
                        <div
                            key={i}
                            className="h-1.5 flex-1 rounded-full transition-all duration-500"
                            style={{
                                backgroundColor: i < currentSetIndex
                                    ? theme.primary
                                    : i === currentSetIndex
                                        ? `${theme.primary}40`
                                        : 'rgba(255,255,255,0.05)',
                                boxShadow: i < currentSetIndex
                                    ? `0 0 10px ${theme.primary}40`
                                    : 'none'
                            }}
                        ></div>
                    ))}
                </div>

                {/* Reps and Notes */}
                <div className="flex flex-col gap-1 mt-2">
                    {currentExercise.reps && (
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-zinc-600 uppercase">🎯 Meta:</span>
                            <span className="text-sm font-bold text-zinc-300">{currentExercise.reps} reps</span>
                        </div>
                    )}
                    {currentExercise.notes && (
                        <p className="text-xs text-zinc-500 italic mt-1 bg-white/5 p-2 rounded-lg border border-white/5">
                            "{currentExercise.notes}"
                        </p>
                    )}
                </div>
            </div>

            {/* Main Timer Display */}
            <div className="flex-1 flex flex-col items-center justify-center -mt-6 sm:-mt-10 min-h-0">
                <div className="relative transform scale-90 sm:scale-100 transition-transform">
                    <Timer
                        timeLeft={isStopwatch ? stopwatchTime : timeLeft}
                        isActive={isActive}
                        isStopwatch={isStopwatch}
                        duration={isStopwatch ? 0 : (currentExercise.restTimes[currentSetIndex] || 60)}
                        onToggle={() => setIsActive(!isActive)}
                        onReset={() => {
                            setIsActive(false);
                            if (isStopwatch) setStopwatchTime(0);
                            else setTimeLeft(currentExercise.restTimes[currentSetIndex] || 60);
                        }}
                        onAdjust={(delta) => {
                            if (isStopwatch) setStopwatchTime(prev => Math.max(0, prev + delta));
                            else setTimeLeft(prev => Math.max(1, prev + delta));
                        }}
                        soundMode={soundMode}
                        hapticPattern={hapticPattern}
                    />
                </div>

                {/* Set Indicator */}
                <div className="mt-4 sm:mt-8 flex flex-col items-center">
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-0.5">Série Atual</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-6xl font-black italic text-white">{currentSetIndex + 1}</span>
                        <span className="text-xl font-black text-zinc-800 uppercase italic">/ {currentExercise.restTimes.length + 1}</span>
                    </div>
                </div>
            </div>

            {/* Main Action Button */}
            <div className="mt-auto flex gap-4 p-5 sm:p-6">
                <button
                    title="Próxima Série"
                    onClick={handleSetComplete}
                    disabled={isActive}
                    className={`flex-1 h-16 sm:h-20 rounded-3xl font-black text-sm tracking-[0.15em] flex items-center justify-center transition-all active:scale-[0.96] shadow-2xl ${isActive
                        ? 'bg-zinc-900 text-zinc-600 border border-zinc-900 cursor-not-allowed'
                        : 'bg-white text-black'
                        }`}
                >
                    {currentSetIndex === currentExercise.restTimes.length ? 'FINALIZAR EXERCÍCIO' : 'PRÓXIMA SÉRIE'}
                </button>
            </div>

            {/* Nav Peek */}
            <div className="flex justify-between px-8 pb-8 sm:pb-10">
                <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="text-[10px] font-black uppercase tracking-widest text-red-500/80 hover:text-red-500 transition-colors"
                >
                    <i className="fa-solid fa-xmark mr-2"></i> Cancelar
                </button>
                <div className="flex-1 flex justify-center">
                    {currentExercisesCount() < exercises.length && (
                        <div className="text-center opacity-40">
                            <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Próximo</p>
                            <p className="text-[10px] font-black uppercase italic text-zinc-400 truncate max-w-[120px]">{exercises[currentExerciseIndex + 1]?.name || '---'}</p>
                        </div>
                    )}
                </div>
                <button
                    onClick={() => setShowFinishConfirm(true)}
                    className="text-[10px] font-black uppercase tracking-widest text-[#00FF41] hover:text-white transition-colors"
                >
                    Terminar <i className="fa-solid fa-flag-checkered ml-2"></i>
                </button>
            </div>

            {modals}
        </div>
    );

    function currentExercisesCount() {
        return currentExerciseIndex + 1;
    }
};

export default SessionView;
