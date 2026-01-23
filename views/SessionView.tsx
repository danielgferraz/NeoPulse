
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Exercise } from '../services/db';
import Timer from '../components/Timer';
import { NotificationService } from '../services/notificationService';
import { useTheme } from '../contexts/ThemeContext';
import { WidgetService } from '../services/widgetService';
import { Preferences } from '@capacitor/preferences';
import ExerciseEditor from '../components/ExerciseEditor';
import ExerciseSelector from '../components/ExerciseSelector';

const SessionView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const trainingId = parseInt(id || '0');
    const isFreeTraining = trainingId === 0;
    const navigate = useNavigate();
    const { theme, soundMode, hapticPattern } = useTheme();

    const training = useLiveQuery(async () =>
        isFreeTraining ? { id: 0, name: 'Treino Livre', order: -1 } : await db.trainings.get(trainingId)
        , [trainingId, isFreeTraining]);
    const dbExercises = useLiveQuery(() =>
        db.exercises.where('trainingId').equals(trainingId).sortBy('order')
        , [trainingId]);

    // Local State
    const [extraExercises, setExtraExercises] = useState<Exercise[]>([]);

    // History Tracking
    const completedExercises = useRef<{ name: string; sets: number; totalDuration?: number }[]>([]);

    // Combine standard DB exercises with session-only extra exercises
    const exercises = useMemo(() => {
        if (!dbExercises) return undefined;
        return [...dbExercises, ...extraExercises];
    }, [dbExercises, extraExercises]);
    const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
    const [currentSetIndex, setCurrentSetIndex] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [timeLeft, setTimeLeft] = useState(90);
    const [duration, setDuration] = useState(90);
    const [isStopwatch, setIsStopwatch] = useState(false);
    const [stopwatchTime, setStopwatchTime] = useState(0);
    const [hasRestored, setHasRestored] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [showFinishConfirm, setShowFinishConfirm] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [showPlaylist, setShowPlaylist] = useState(false);
    const [completedIndices, setCompletedIndices] = useState<number[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);

    // Deleted manual 'newExercise' state as it is now handled by ExerciseSelector
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
            else setTimeLeft(duration);
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
        if (isActive && !isStopwatch) {
            NotificationService.showStickyNotification(
                `Treino: ${currentExercise?.name} `,
                `Série ${currentSetIndex + 1} | Descanso Ativo`,
                !isActive,
                1001,
                'neopulse_ticker'
            );
        } else if (isActive && isStopwatch) {
            NotificationService.showStickyNotification(
                `Treino: ${currentExercise?.name} `,
                `Cronômetro Ativo`,
                !isActive,
                1001,
                'neopulse_ticker'
            );
        } else if (!isActive && currentExercise && hasRestored) {
            NotificationService.showStickyNotification(
                `Pausado: ${currentExercise?.name} `,
                isStopwatch ? `Cronômetro Pausado` : `Série ${currentSetIndex + 1} | Pausado`,
                true,
                1001,
                'neopulse_ticker'
            );
        }
    }, [isActive, isStopwatch, currentExercise, currentSetIndex, hasRestored]);

    // Timer Interval Only
    // Timer Interval Logic
    useEffect(() => {
        let interval: any = null;
        if (isActive) {
            interval = setInterval(() => {
                if (isStopwatch) {
                    setStopwatchTime(prev => prev + 1);
                } else {
                    setTimeLeft(prev => {
                        if (prev <= 1) {
                            return 0;
                        }
                        return prev - 1;
                    });
                }
            }, 1000);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [isActive, isStopwatch]);

    // Check for Timer Finish
    useEffect(() => {
        if (!isStopwatch && timeLeft === 0 && isActive) {
            setIsActive(false);
            scheduleAlert();
        }
    }, [timeLeft, isStopwatch, isActive]);

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
                        if (saved.extraExercises) {
                            setExtraExercises(saved.extraExercises);
                        }

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
                            setDuration(saved.duration || 60); // Restore duration or fallback
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
                duration,
                isActive,
                isStopwatch,
                stopwatchTime,
                lastTimestamp: Date.now(),
                extraExercises: isFreeTraining ? [] : extraExercises // Only save extra if not free, as free saves to DB directly
            })
        });
    }, [trainingId, currentExerciseIndex, currentSetIndex, timeLeft, isActive, isStopwatch, stopwatchTime, hasRestored, exercises, extraExercises]);

    // Reset timer whenever exercise/set changes
    useEffect(() => {
        if (currentExercise && hasRestored) {
            const isDifferent = lastSessionIndices.current.exercise !== currentExerciseIndex ||
                lastSessionIndices.current.set !== currentSetIndex;

            if (isDifferent) {
                const newDuration = currentExercise.restTimes[Math.min(currentSetIndex, currentExercise.restTimes.length - 1)] || 90;
                setTimeLeft(newDuration);
                setDuration(newDuration);
                lastSessionIndices.current = { exercise: currentExerciseIndex, set: currentSetIndex };

                // Sync widget (Initial state for this exercise/set)
                if (exercises) {
                    WidgetService.syncSession({
                        exercise: currentExercise.name,
                        next: exercises[currentExerciseIndex + 1]?.name || 'Fim do Treino',
                        currentSet: currentSetIndex + 1,
                        totalSets: currentExercise.restTimes.length + 1,
                        timerEnd: duration ? (Date.now() + duration * 1000) : null,
                        timerStart: null
                    });
                }
            }
        }
    }, [currentExercise, currentSetIndex, exercises, currentExerciseIndex, hasRestored]);

    const scheduleAlert = async () => {
        await NotificationService.showStickyNotification(
            "Tempo Esgotado! 🔔",
            `Prepare - se para: ${currentExercise?.name} `,
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
            setDuration(restDuration);
            setIsActive(true);

            if (exercises) {
                WidgetService.syncSession({
                    exercise: currentExercise.name,
                    next: exercises[currentExerciseIndex + 1]?.name || 'Fim do Treino',
                    currentSet: nextSet + 1,
                    totalSets: currentExercise.restTimes.length + 1,
                    timerEnd: Date.now() + (restDuration * 1000),
                    timerStart: null
                });
            }
        } else {
            const lastRest = currentExercise.restTimes[currentExercise.restTimes.length - 1];
            finishExercise(lastRest);
        }
    };

    const finishExercise = async (initialRest?: number) => {
        if (!currentExercise || !training || !exercises) return;

        // Log the exercise that just finished (whether it's intermediate or the last one)
        const currentEx = exercises[currentExerciseIndex];
        if (currentEx) {
            completedExercises.current.push({
                name: currentEx.name,
                sets: currentEx.restTimes.length
            });
            // Mark as visually completed in cronograma list
            setCompletedIndices(prev => [...prev, currentExerciseIndex]);
        }

        if (currentExerciseIndex < exercises.length - 1) {
            const nextExercise = exercises[currentExerciseIndex + 1];
            setCurrentExerciseIndex(prev => prev + 1);
            setCurrentSetIndex(0);

            const restTime = initialRest || 60;
            setTimeLeft(restTime);
            setDuration(restTime);
            setIsActive(true);

            WidgetService.syncSession({
                exercise: nextExercise.name,
                next: exercises[currentExerciseIndex + 2]?.name || 'Fim do Treino',
                currentSet: 1,
                totalSets: nextExercise.restTimes.length + 1,
                timerEnd: Date.now() + (restTime * 1000),
                timerStart: null
            });
        } else {
            // Last exercise finished
            setCompletedIndices(prev => [...prev, currentExerciseIndex]);
            setShowCompleteModal(true);
        }
    };

    const handleFinalFinish = async () => {
        if (!training || !exercises) return;
        await db.history.add({
            exerciseName: "Sessão Completa",
            sets: exercises.length,
            trainingName: training.name,
            timestamp: Date.now(),
            details: completedExercises.current
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
            timestamp: Date.now(),
            details: completedExercises.current
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
        navigate(`/summary?tid=${trainingId}&dur=00:00&free=${isFreeTraining}`, {
            state: {
                history: completedExercises.current,
            }
        });
    };

    const addFreeExercise = async (exerciseToAdd: Exercise) => {
        if (isFreeTraining) {
            // Original behavior: Add to DB (persistent for this "Free Workout" pseudo-list)
            await db.exercises.add(exerciseToAdd);
        } else {
            // New behavior: Add to local state (session only)
            setExtraExercises(prev => [...prev, exerciseToAdd]);
        }

        // If we were in the "Complete" state, continue/resume
        if (showCompleteModal) {
            setShowCompleteModal(false);
        }

        setShowAddModal(false);
        // Reset timer logic for new exercise if needed
        setCurrentSetIndex(0);
        setTimeLeft(exerciseToAdd.restTimes[0] || 60);
        setDuration(exerciseToAdd.restTimes[0] || 60);
    }

    function currentExercisesCount() {
        return currentExerciseIndex + 1;
    }

    const jumpToExercise = (index: number) => {
        if (index === currentExerciseIndex) {
            setShowPlaylist(false);
            return;
        }

        // Save progress of current exercise if needed? 
        // For now, simpler to just switch. Ideally we might want to "pause" the current one.

        setCurrentExerciseIndex(index);
        setCurrentSetIndex(0);

        const targetExercise = exercises[index];
        const initialRest = targetExercise?.restTimes[0] || 60;
        setTimeLeft(initialRest);
        setDuration(initialRest);
        setIsActive(true); // Auto-start or wait? Let's wait.
        setIsActive(false);

        setShowPlaylist(false);

        // Sync widget
        WidgetService.syncSession({
            exercise: targetExercise.name,
            next: exercises[index + 1]?.name || 'Fim do Treino',
            currentSet: 1,
            totalSets: targetExercise.restTimes.length + 1,
            timerEnd: null,
            timerStart: null
        });
    };

    const modals = (
        <>
            {showPlaylist && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-zinc-950 border-t sm:border border-zinc-800 w-full max-w-sm sm:rounded-[32px] rounded-t-[32px] p-6 animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 shadow-2xl flex flex-col max-h-[85vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">Cronograma</h3>
                            <button onClick={() => setShowPlaylist(false)} className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500 hover:text-white">
                                <i className="fa-solid fa-times"></i>
                            </button>
                        </div>

                        <div className="overflow-y-auto pr-2 -mr-2 space-y-2">
                            {exercises?.map((ex, i) => {
                                const isCurrent = i === currentExerciseIndex;
                                const isCompleted = completedIndices.includes(i);

                                return (
                                    <button
                                        key={i}
                                        onClick={() => jumpToExercise(i)}
                                        className={`w-full p-4 rounded-2xl border flex items-center gap-4 transition-all ${isCurrent
                                            ? 'bg-zinc-900 border-[#00FF41] shadow-[0_0_15px_rgba(0,255,65,0.1)]'
                                            : isCompleted
                                                ? 'bg-zinc-950 border-zinc-900 opacity-60' // Dimmed for completed
                                                : 'bg-black border-zinc-900 hover:bg-zinc-900/50' // Defualt for Waiting
                                            }`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${isCurrent ? 'bg-[#00FF41] text-black' :
                                            isCompleted ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-900 text-zinc-700 border border-zinc-800'
                                            }`}>
                                            {isCompleted ? <i className="fa-solid fa-check"></i> :
                                                isCurrent ? <i className="fa-solid fa-play text-[10px]"></i> :
                                                    i + 1}
                                        </div>

                                        <div className="flex-1 text-left">
                                            <div className={`font-bold text-sm uppercase leading-tight ${isCurrent ? 'text-white' : isCompleted ? 'text-zinc-500 line-through' : 'text-zinc-400'}`}>
                                                {ex.name}
                                            </div>
                                            <div className="text-[10px] text-zinc-600 mt-0.5 font-medium">
                                                {ex.restTimes.length} Séries • {ex.restTimes[0]}s Descanso
                                            </div>
                                        </div>

                                        {isCurrent && (
                                            <div className="text-[10px] uppercase font-black text-[#00FF41] tracking-wider animate-pulse">
                                                Atual
                                            </div>
                                        )}
                                    </button>
                                );
                            })}


                            <button
                                onClick={() => setShowAddModal(true)}
                                className="w-full p-4 rounded-2xl border border-dashed border-zinc-800 flex items-center justify-center gap-2 text-zinc-600 hover:text-white hover:border-zinc-600 transition-all mt-4"
                            >
                                <i className="fa-solid fa-plus"></i> <span className="font-bold text-xs uppercase tracking-widest">Adicionar Exercício</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {
                showAddModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-zinc-900 border border-white/10 w-full max-w-lg rounded-[32px] p-6 animate-in zoom-in-95 duration-300 shadow-2xl flex flex-col max-h-[90vh]">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Novo Exercício</h3>
                                <button title="Fechar" onClick={() => setShowAddModal(false)} className="text-zinc-500 hover:text-white">
                                    <i className="fa-solid fa-times text-lg"></i>
                                </button>
                            </div>

                            <div className="h-[60vh]">
                                <ExerciseSelector
                                    trainingId={trainingId}
                                    initialOrder={exercises?.length || 0}
                                    onSelect={addFreeExercise}
                                    onCancel={() => setShowAddModal(false)}
                                />
                            </div>
                        </div>
                    </div>
                )
            }

            {
                showCancelConfirm && (
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
                )
            }

            {
                showFinishConfirm && (
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
                )
            }

            {
                showCompleteModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[32px] p-8 animate-in zoom-in-95 duration-300 shadow-2xl text-center">
                            <div className="w-20 h-20 rounded-full bg-[#00FF41]/20 flex items-center justify-center mx-auto mb-6">
                                <i className="fa-solid fa-trophy text-4xl text-[#00FF41]"></i>
                            </div>
                            <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">Treino Concluído!</h3>
                            <p className="text-zinc-400 text-sm mb-8">Parabéns! Você finalizou todos os exercícios previstos.</p>

                            <div className="space-y-3">
                                <button
                                    onClick={() => handleFinalFinish()}
                                    style={{ backgroundColor: theme.primary }}
                                    className="w-full py-4 rounded-2xl text-black font-black uppercase tracking-widest active:scale-95 transition-transform"
                                >
                                    Finalizar Agora
                                </button>
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="w-full py-4 rounded-2xl bg-zinc-800 text-white font-black uppercase tracking-widest active:scale-95 transition-transform border border-zinc-700"
                                >
                                    + Adicionar Exercício
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
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
                    <div className="flex gap-2">
                        <button
                            title="Ver Cronograma"
                            onClick={() => setShowPlaylist(true)}
                            className="bg-zinc-900 text-white w-8 h-8 rounded-lg flex items-center justify-center border border-zinc-800 active:scale-90 transition-transform"
                        >
                            <i className="fa-solid fa-list-ul text-[10px]"></i>
                        </button>
                        <button
                            title="Adicionar Exercício"
                            onClick={() => setShowAddModal(true)}
                            className="bg-zinc-900 text-white w-8 h-8 rounded-lg flex items-center justify-center border border-zinc-800 active:scale-90 transition-transform"
                        >
                            <i className="fa-solid fa-plus text-[10px]"></i>
                        </button>
                    </div>
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
                                        ? `${theme.primary} 40`
                                        : 'rgba(255,255,255,0.05)',
                                boxShadow: i < currentSetIndex
                                    ? `0 0 10px ${theme.primary} 40`
                                    : 'none'
                            }}
                        ></div>
                    ))}
                </div>

                {/* Reps and Notes */}
                <div className="flex flex-col gap-1 mt-2">
                    {/* Current Set Reps Target */}
                    {currentExercise.setReps?.[currentSetIndex] && (
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-zinc-600 uppercase">🎯 Meta:</span>
                            <span className="text-sm font-bold text-zinc-300">
                                {currentExercise.setReps[currentSetIndex]} reps
                            </span>
                        </div>
                    )}
                    {currentExercise.notes && (
                        <div className="mt-2 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 flex gap-3 items-start">
                            <i className="fa-solid fa-note-sticky text-zinc-600 text-xs mt-0.5"></i>
                            <p className="text-xs text-zinc-300 font-medium leading-relaxed">
                                {currentExercise.notes}
                            </p>
                        </div>
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
                        duration={isStopwatch ? 0 : duration}
                        onToggle={() => {
                            const newActive = !isActive;
                            setIsActive(newActive);

                            // Sync widget on manual toggle
                            if (exercises) {
                                WidgetService.syncSession({
                                    exercise: currentExercise.name,
                                    next: exercises[currentExerciseIndex + 1]?.name || 'Fim do Treino',
                                    currentSet: currentSetIndex + 1,
                                    totalSets: currentExercise.restTimes.length + 1,
                                    timerEnd: newActive && !isStopwatch ? Date.now() + (timeLeft * 1000) : null,
                                    timerStart: newActive && isStopwatch ? Date.now() - (stopwatchTime * 1000) : null
                                });
                            }
                        }}
                        onReset={() => {
                            setIsActive(false);
                            if (isStopwatch) setStopwatchTime(0);
                            else setTimeLeft(duration);
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
                    className={`flex-1 h-12 rounded-xl font-black text-xs tracking-[0.15em] flex items-center justify-center transition-all active:scale-[0.96] shadow-lg ${isActive
                        ? 'bg-zinc-900 text-zinc-600 border border-zinc-900 cursor-not-allowed'
                        : 'bg-white text-black'
                        } `}
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
        </div >
    );
};

export default SessionView;
