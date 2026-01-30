
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
import WorkoutTracker from '../components/WorkoutTracker';

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
    const completedExercises = useRef<{
        name: string;
        sets: number;
        reps?: string[];
        weights?: number[];
        rpes?: number[];
        totalDuration?: number;
    }[]>([]);

    // Combine standard DB exercises with session-only extra exercises
    const [deletedExerciseIndices, setDeletedExerciseIndices] = useState<number[]>([]);
    const [exerciseOverrides, setExerciseOverrides] = useState<{ [key: string]: Partial<Exercise> }>({});

    const exercises = useMemo(() => {
        if (!dbExercises) return undefined;
        const combined = [...dbExercises, ...extraExercises];
        return combined.filter((_, i) => !deletedExerciseIndices.includes(i));
    }, [dbExercises, extraExercises, deletedExerciseIndices]);

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

    // Advanced Set State
    const [completedSets, setCompletedSets] = useState<{ [exerciseId: number]: boolean[] }>({});
    const [actualReps, setActualReps] = useState<{ [exerciseId: number]: string[] }>({});
    const [actualWeights, setActualWeights] = useState<{ [exerciseId: number]: string[] }>({});

    // Current Exercise Helper
    const currentExId = useMemo(() => {
        const id = exercises?.[currentExerciseIndex]?.id;
        return typeof id === 'number' ? id : currentExerciseIndex + 1000;
    }, [exercises, currentExerciseIndex]);

    const currentExercise = useMemo(() => {
        const ex = exercises?.[currentExerciseIndex];
        if (!ex) return ex;
        const key = ex.id ? ex.id.toString() : `temp-${ex.name}`;
        if (exerciseOverrides[key]) {
            return { ...ex, ...exerciseOverrides[key] };
        }
        return ex;
    }, [exercises, currentExerciseIndex, exerciseOverrides]);

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

        // Poll for Widget/Notification commands
        const commandInterval = setInterval(async () => {
            const { value: command } = await Preferences.get({ key: 'neopulse_widget_command' });
            if (command) {
                console.log("Widget Command Received:", command);
                if (command === 'pause') window.dispatchEvent(new CustomEvent('NEOPULSE_PAUSE'));
                else if (command === 'reset') window.dispatchEvent(new CustomEvent('NEOPULSE_RESET'));
                else if (command === 'next') window.dispatchEvent(new CustomEvent('NEOPULSE_NEXT_SET'));

                // Clear command after consumption
                await Preferences.remove({ key: 'neopulse_widget_command' });
            }
        }, 1000);

        return () => {
            window.removeEventListener('NEOPULSE_NEXT_SET', nextSetHandler);
            window.removeEventListener('NEOPULSE_PAUSE', pauseHandler);
            window.removeEventListener('NEOPULSE_RESET', resetHandler);
            clearInterval(commandInterval);
        };
    }, [currentExercise, currentSetIndex, isStopwatch, duration]);

    // Timer & Stopwatch Logic - Silent Notification Updates
    useEffect(() => {
        if (!hasRestored) return;

        const updateNotification = async () => {
            if (isActive && !isStopwatch) {
                await NotificationService.showStickyNotification(
                    `${currentExercise?.name}`,
                    `DESCANSO ATIVO | Série ${currentSetIndex + 1}`,
                    false,
                    1001,
                    'neopulse_ticker',
                    0,
                    Date.now() + timeLeft * 1000,
                    false
                );
            } else if (isActive && isStopwatch) {
                await NotificationService.showStickyNotification(
                    `${currentExercise?.name}`,
                    `EXECUÇÃO | Cronômetro Ativo`,
                    false,
                    1001,
                    'neopulse_ticker',
                    Date.now() - stopwatchTime * 1000,
                    0,
                    true
                );
            } else if (!isActive && currentExercise) {
                await NotificationService.showStickyNotification(
                    `${currentExercise?.name}`,
                    isStopwatch ? `PAUSADO | Cronômetro` : `PAUSADO | Série ${currentSetIndex + 1}`,
                    true,
                    1001,
                    'neopulse_ticker'
                );
            }
        };

        updateNotification();
    }, [isActive, isStopwatch, currentExercise?.name, currentSetIndex, hasRestored]);

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
                    }
                }

                // Also check DB for richer state (sets, reps, weights)
                const dbSession = await db.activeSession.get('current');
                if (dbSession && dbSession.trainingId === trainingId) {
                    setCompletedIndices(dbSession.completedIndices || []);
                    setExtraExercises(dbSession.extraExercises || []);
                }
            } catch (e) {
                console.error("Error restoring session:", e);
            } finally {
                setHasRestored(true);
            }
        };

        restoreSession();
    }, [trainingId]);

    // Persistence: Auto-save state to DB
    useEffect(() => {
        if (!hasRestored || !exercises || exercises.length === 0) return;

        const saveSession = async () => {
            await db.activeSession.put({
                id: 'current',
                trainingId,
                exerciseIndex: currentExerciseIndex,
                setIndex: currentSetIndex,
                startTime: Date.now(), // Minimalist start time tracking
                completedExercises: completedExercises.current,
                extraExercises,
                completedIndices
            });

            // Keep Preferences for compatibility/simple info
            Preferences.set({
                key: 'neopulse_persistent_session',
                value: JSON.stringify({
                    trainingId,
                    exerciseIndex: currentExerciseIndex,
                    setIndex: currentSetIndex,
                    exercise: currentExercise?.name,
                    lastTimestamp: Date.now(),
                })
            });
        };

        const timer = setTimeout(saveSession, 1000); // Debounce saves
        return () => clearTimeout(timer);
    }, [trainingId, currentExerciseIndex, currentSetIndex, timeLeft, isActive, isStopwatch, stopwatchTime, hasRestored, exercises, extraExercises, completedIndices]);

    // Reset auto-fill if possible when exercise/set changes
    useEffect(() => {
        if (currentExercise && hasRestored) {
            const newDuration = currentExercise.restTimes[Math.min(currentSetIndex, currentExercise.restTimes.length - 1)] || 90;
            setTimeLeft(newDuration);
            setDuration(newDuration);

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

        const setIdx = currentSetIndex;
        // Mark current set as completed if not already
        setCompletedSets(prev => ({
            ...prev,
            [currentExId]: prev[currentExId] ? prev[currentExId].map((v, i) => i === setIdx ? true : v) : Array(currentExercise.restTimes.length + 1).fill(false).map((v, i) => i === setIdx ? true : v)
        }));

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
            // Exercise finished! 
            // We use the last rest time of current exercise as transition time or default 60s
            const transitionRest = currentExercise.restTimes[currentExercise.restTimes.length - 1] || 60;
            finishExercise(transitionRest);
        }
    };

    const finishExercise = async (initialRest?: number) => {
        if (!currentExercise || !training || !exercises) return;

        // Log the exercise that just finished
        const currentEx = exercises[currentExerciseIndex];
        if (currentEx) {
            const reps = actualReps[currentExId] || [];
            const weights = (actualWeights[currentExId] || []).map(w => parseFloat(w) || 0);

            completedExercises.current.push({
                name: currentEx.name,
                sets: currentEx.restTimes.length + 1,
                reps: reps,
                weights: weights,
                rpes: Array(reps.length).fill(8) // Default RPE as select was removed
            });

            // Update Exercise Table with "Last Used" weights for next time
            if (currentEx.id !== undefined) {
                await db.exercises.update(currentEx.id, {
                    lastWeights: weights,
                    setReps: reps
                });
            }

            // Mark as visually completed
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
            setCompletedIndices(prev => Array.from(new Set([...prev, currentExerciseIndex])));
            setShowCompleteModal(true);
            setIsActive(false); // Stop any running timers
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
        await db.activeSession.delete('current');
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
        // Clear active session on finish
        await db.activeSession.delete('current');
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
            await db.exercises.add(exerciseToAdd);
        } else {
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

    const handleDeleteSet = (index: number) => {
        if (!currentExercise || currentExercise.restTimes.length < 1) return;

        const newRests = [...currentExercise.restTimes];
        const newSetReps = [...(currentExercise.setReps || Array(currentExercise.restTimes.length + 1).fill(''))];

        if (index < newRests.length) {
            newRests.splice(index, 1);
        } else {
            newRests.splice(newRests.length - 1, 1);
        }
        newSetReps.splice(index, 1);

        const key = currentExercise.id ? currentExercise.id.toString() : `temp-${currentExercise.name}`;
        setExerciseOverrides(prev => ({
            ...prev,
            [key]: { ...prev[key], restTimes: newRests, setReps: newSetReps }
        }));

        if (currentSetIndex >= newRests.length + 1) {
            setCurrentSetIndex(Math.max(0, newRests.length));
        }
    };

    const handleDeleteExercise = (index: number) => {
        if (!exercises || exercises.length <= 1) {
            alert("Não é possível deletar o último exercício.");
            return;
        }

        const combined = [...(dbExercises || []), ...extraExercises];
        // Find actual index in combined array
        let actualCombinedIndex = -1;
        let visibleCount = 0;
        for (let i = 0; i < combined.length; i++) {
            if (!deletedExerciseIndices.includes(i)) {
                if (visibleCount === index) {
                    actualCombinedIndex = i;
                    break;
                }
                visibleCount++;
            }
        }

        if (actualCombinedIndex === -1) return;
        const exToDelete = combined[actualCombinedIndex];
        if (!confirm(`Remover "${exToDelete.name}" apenas desta sessão?`)) return;

        if (index === currentExerciseIndex) setIsActive(false);

        // Session-only removal: Add to deleted indices list
        setDeletedExerciseIndices(prev => [...prev, actualCombinedIndex]);

        if (index < currentExerciseIndex) {
            setCurrentExerciseIndex(prev => prev - 1);
        } else if (index === currentExerciseIndex) {
            if (index === exercises.length - 1) {
                setCurrentExerciseIndex(prev => prev - 1);
            }
            setCurrentSetIndex(0);
        }
    };

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
                                    <div className="flex items-center gap-2">
                                        <button
                                            key={i}
                                            onClick={() => jumpToExercise(i)}
                                            className={`flex-1 p-4 rounded-2xl border flex items-center gap-4 transition-all ${isCurrent
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
                                                    {ex.restTimes.length + 1} Séries • {ex.restTimes[0]}s Descanso
                                                </div>
                                            </div>

                                            {isCurrent && (
                                                <div className="text-[10px] uppercase font-black text-[#00FF41] tracking-wider animate-pulse">
                                                    Atual
                                                </div>
                                            )}
                                        </button>
                                        {!isFreeTraining && (
                                            <div className="flex flex-col gap-1 h-full min-h-[64px]">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/training/${trainingId}`);
                                                    }}
                                                    className="flex-1 w-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex items-center justify-center text-zinc-600 hover:text-[#00FF41] transition-all"
                                                    title="Editar"
                                                >
                                                    <i className="fa-solid fa-pen-nib text-[10px]"></i>
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteExercise(i);
                                                    }}
                                                    className="flex-1 w-10 rounded-xl bg-zinc-900 hover:bg-red-950/20 border border-zinc-800 flex items-center justify-center text-zinc-800 hover:text-red-500 transition-all"
                                                    title="Excluir"
                                                >
                                                    <i className="fa-solid fa-trash-can text-[10px]"></i>
                                                </button>
                                            </div>
                                        )}
                                        {isFreeTraining && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteExercise(i);
                                                }}
                                                className="w-10 h-[inherit] min-h-[64px] rounded-2xl bg-zinc-900 hover:bg-red-950/20 border border-zinc-800 flex items-center justify-center text-zinc-800 hover:text-red-500 transition-all"
                                                title="Excluir"
                                            >
                                                <i className="fa-solid fa-trash-can text-xs"></i>
                                            </button>
                                        )}
                                    </div>
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

                            <button
                                onClick={() => handleFinalFinish()}
                                style={{ backgroundColor: theme.primary }}
                                className="w-full py-4 rounded-2xl text-black font-black uppercase tracking-widest active:scale-95 transition-transform"
                            >
                                Finalizar Agora
                            </button>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="py-4 rounded-2xl bg-zinc-800 text-white font-black uppercase tracking-[0.05em] text-[10px] active:scale-95 transition-transform border border-zinc-700"
                                >
                                    + Exercício
                                </button>
                                <button
                                    onClick={() => setShowCompleteModal(false)}
                                    className="py-4 rounded-2xl bg-black text-zinc-400 font-black uppercase tracking-[0.05em] text-[10px] active:scale-95 transition-transform border border-zinc-800"
                                >
                                    Revisar
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
            {/* Ultra-Compact Top Nav */}
            <div className="w-full px-5 pt-6 pb-2 flex items-center justify-between shrink-0">
                <div className="flex flex-col max-w-[70%]">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black italic text-[#00FF41]">
                            E{currentExerciseIndex + 1}
                        </span>
                        <div className="h-1 w-20 bg-zinc-900 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-[#00FF41] transition-all duration-500"
                                style={{ width: `${((currentExerciseIndex + 1) / exercises.length) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                    <h1 className="text-2xl font-black italic text-white uppercase tracking-tighter truncate leading-none mt-1">
                        {currentExercise?.name}
                    </h1>
                    {currentExercise?.notes && (
                        <div className="flex items-center gap-1.5 mt-1 opacity-70">
                            <i className="fa-solid fa-note-sticky text-[#00FF41] text-[8px]"></i>
                            <p className="text-[10px] text-zinc-400 font-medium leading-tight">
                                {currentExercise.notes}
                            </p>
                        </div>
                    )}
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                        SÉRIE {currentSetIndex + 1} DE {currentExercise.restTimes.length + 1}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowPlaylist(true)}
                        className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500"
                        title="Playlist"
                    >
                        <i className="fa-solid fa-list-ul text-[10px]"></i>
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500"
                        title="Adicionar"
                    >
                        <i className="fa-solid fa-plus text-[10px]"></i>
                    </button>
                </div>
            </div>

            {/* Global Progress Bar */}
            <div className="w-full px-6 flex gap-1 mb-2">
                {exercises.map((_, i) => (
                    <div
                        key={i}
                        className="h-1 flex-1 rounded-full transition-all duration-500"
                        style={{
                            backgroundColor: i <= currentExerciseIndex
                                ? '#00FF41'
                                : 'rgba(255,255,255,0.05)',
                            opacity: i < currentExerciseIndex ? 0.3 : 1
                        }}
                    ></div>
                ))}
            </div>


            {/* Compact Timer Stage */}
            <div className="w-full flex flex-col items-center justify-center py-2 shrink-0 relative bg-gradient-to-b from-black to-transparent">
                <div className="transform scale-90 transition-all duration-500">
                    <Timer
                        timeLeft={isStopwatch ? stopwatchTime : timeLeft}
                        isActive={isActive}
                        isStopwatch={isStopwatch}
                        duration={isStopwatch ? 0 : duration}
                        onToggle={() => {
                            const newActive = !isActive;
                            setIsActive(newActive);
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
            </div>

            {/* Workout Tracker Component */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
                <WorkoutTracker
                    exercise={currentExercise}
                    currentSetIndex={currentSetIndex}
                    completedSets={completedSets[currentExId] || Array(currentExercise.restTimes.length + 1).fill(false)}
                    actualReps={actualReps[currentExId] || Array(currentExercise.restTimes.length + 1).fill('')}
                    actualWeights={actualWeights[currentExId] || Array(currentExercise.restTimes.length + 1).fill('')}
                    onSetToggle={(idx) => {
                        setCompletedSets(prev => ({
                            ...prev,
                            [currentExId]: (prev[currentExId] || Array(currentExercise.restTimes.length + 1).fill(false)).map((v, i) => i === idx ? !v : v)
                        }));
                    }}
                    onRepChange={(idx, val) => {
                        setActualReps(prev => ({
                            ...prev,
                            [currentExId]: (prev[currentExId] || Array(currentExercise.restTimes.length + 1).fill('')).map((v, i) => i === idx ? val : v)
                        }));
                    }}
                    onWeightChange={(idx, val) => {
                        setActualWeights(prev => ({
                            ...prev,
                            [currentExId]: (prev[currentExId] || Array(currentExercise.restTimes.length + 1).fill('')).map((v, i) => i === idx ? val : v)
                        }));
                    }}
                    onDeleteSet={handleDeleteSet}
                />
            </div>

            {/* Actions Bar - Robust & Visual */}
            <div className="w-full shrink-0 bg-black/80 backdrop-blur-2xl border-t border-zinc-900 px-6 py-6 pb-8">
                <div className="flex gap-4">
                    <button
                        onClick={() => setShowCancelConfirm(true)}
                        className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-red-500/40 active:text-red-500 active:scale-90 transition-all"
                        title="Cancelar"
                    >
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>

                    <button
                        onClick={handleSetComplete}
                        disabled={isActive || (currentExerciseIndex === exercises.length - 1 && currentSetIndex === currentExercise.restTimes.length && showCompleteModal)}
                        style={{ backgroundColor: isActive ? '#18181b' : theme.primary }}
                        className={`flex-1 h-14 rounded-2xl font-black uppercase tracking-[0.1em] text-xs flex items-center justify-center gap-3 transition-all ${isActive ? 'text-zinc-700 border border-zinc-800' : 'text-black shadow-[0_15px_30px_rgba(0,255,65,0.15)] active:scale-[0.98]'}`}
                    >
                        <span className="text-sm">
                            {currentSetIndex === currentExercise.restTimes.length ? 'Finalizar Ex' : 'Próxima Série'}
                        </span>
                        <i className="fa-solid fa-bolt text-sm"></i>
                    </button>

                    <button
                        onClick={() => setShowFinishConfirm(true)}
                        className="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#00FF41]/40 active:text-[#00FF41] active:scale-90 transition-all"
                        title="Terminar"
                    >
                        <i className="fa-solid fa-flag-checkered text-lg"></i>
                    </button>
                </div>
            </div>

            {modals}
        </div>
    );
};

export default SessionView;
