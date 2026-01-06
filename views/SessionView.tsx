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
    const navigate = useNavigate();
    const { theme, soundMode, hapticPattern } = useTheme();

    const training = useLiveQuery(() => db.trainings.get(trainingId), [trainingId]);
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

        // If it's not the last set, move to next set and start rest
        if (currentSetIndex < currentExercise.restTimes.length) {
            const restDuration = currentExercise.restTimes[currentSetIndex];
            const nextSet = currentSetIndex + 1;
            setCurrentSetIndex(nextSet);
            setTimeLeft(restDuration);
            setIsActive(true);

            // Sync widget with Timer
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
            // It's the last set, advance to next exercise directly
            // Start timer with the last rest of the completed exercise
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

            // Start timer for the next exercise using provided rest
            const restTime = initialRest || 60;
            setTimeLeft(restTime);
            setIsActive(true);

            // Sync widget for context switch
            WidgetService.syncSession({
                exercise: nextExercise.name,
                next: exercises[currentExerciseIndex + 2]?.name || 'Fim do Treino',
                currentSet: 1,
                totalSets: nextExercise.restTimes.length + 1,
                timerEnd: Date.now() + (restTime * 1000)
            });
        } else {
            // End of entire training session
            await db.history.add({
                exerciseName: "Sessão Completa",
                sets: exercises.length,
                trainingName: training.name,
                timestamp: Date.now()
            });

            const recentHistory = await db.history.where('timestamp').above(Date.now() - 30 * 24 * 60 * 60 * 1000).toArray();
            const weightLogs = await db.weightLogs.orderBy('timestamp').reverse().limit(1).toArray();

            WidgetService.sync({
                count: recentHistory.length,
                goal: parseInt(localStorage.getItem('neopulse_monthly_goal') || '12'),
                weight: weightLogs[0]?.weight?.toString() || '---'
            });

            navigate(`/summary?tid=${trainingId}&dur=00:00`);
            Preferences.remove({ key: 'neopulse_persistent_session' });
        }
    };

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
            <div className="flex flex-col items-center justify-center p-10 h-screen">
                <p className="text-zinc-500 mb-4">Pasta vazia...</p>
                <button
                    title="Adicionar Exercícios"
                    onClick={() => navigate(`/training/${trainingId}`)}
                    className="underline text-[#00FF41]"
                >
                    Adicionar Exercícios
                </button>
            </div>
        );
    }

    if (!currentExercise || !training) return <div className="p-10 text-center">Carregando...</div>;

    return (
        <div className="fixed inset-0 bg-black flex flex-col animate-in fade-in duration-500 overflow-hidden">
            {/* Header: Exercise Info */}
            <div className="p-8 pt-12">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black uppercase text-[#00FF41] tracking-[0.3em]">
                        Exercício {currentExerciseIndex + 1}/{exercises.length}
                    </span>
                    <button onClick={() => navigate('/')} className="text-zinc-500 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors">SAIR</button>
                </div>
                <h2 className="text-3xl font-black uppercase tracking-tight text-white leading-none break-words">
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
            <div className="flex-1 flex flex-col items-center justify-center -mt-10">
                <div className="relative">
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
                <div className="mt-8 flex flex-col items-center">
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Série Atual</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-6xl font-black italic text-white">{currentSetIndex + 1}</span>
                        <span className="text-xl font-black text-zinc-800 uppercase italic">/ {currentExercise.restTimes.length + 1}</span>
                    </div>
                </div>
            </div>

            {/* Main Action Button */}
            <div className="mt-auto flex gap-4 p-6">
                <button
                    title="Próxima Série"
                    onClick={handleSetComplete}
                    disabled={isActive}
                    className={`flex-1 h-20 rounded-3xl font-black text-sm tracking-[0.2em] flex items-center justify-center transition-all active:scale-[0.96] shadow-2xl ${isActive
                        ? 'bg-zinc-900 text-zinc-600 border border-zinc-900 cursor-not-allowed'
                        : 'bg-white text-black'
                        }`}
                >
                    {currentSetIndex === currentExercise.restTimes.length ? 'FINALIZAR EXERCÍCIO' : 'PRÓXIMA SÉRIE'}
                </button>
            </div>

            {/* Nav Peek */}
            <div className="flex justify-between px-8 pb-10">
                <button
                    onClick={() => currentExerciseIndex > 0 && setCurrentExerciseIndex(prev => prev - 1)}
                    disabled={currentExerciseIndex === 0}
                    className={`text-[10px] font-black uppercase tracking-widest transition-opacity ${currentExerciseIndex === 0 ? 'opacity-0 pointer-events-none' : 'text-zinc-600 hover:text-white'}`}
                >
                    <i className="fa-solid fa-chevron-left mr-2"></i> Anterior
                </button>
                <div className="flex-1 flex justify-center">
                    {currentExerciseIndex < exercises.length - 1 && (
                        <div className="text-center opacity-40">
                            <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Próximo</p>
                            <p className="text-[10px] font-black uppercase italic text-zinc-400 truncate max-w-[120px]">{exercises[currentExerciseIndex + 1].name}</p>
                        </div>
                    )}
                </div>
                <button
                    onClick={() => finishExercise()}
                    disabled={currentExerciseIndex === exercises.length - 1}
                    className={`text-[10px] font-black uppercase tracking-widest transition-opacity ${currentExerciseIndex === exercises.length - 1 ? 'opacity-0 pointer-events-none' : 'text-zinc-600 hover:text-white'}`}
                >
                    Pular <i className="fa-solid fa-chevron-right ml-2"></i>
                </button>
            </div>
        </div>
    );
};

export default SessionView;
