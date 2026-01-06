import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import Timer from '../components/Timer';
import { NotificationService } from '../services/notificationService';
import { useTheme } from '../contexts/ThemeContext';

const SessionView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const trainingId = parseInt(id || '0');
    const navigate = useNavigate();
    const { theme, soundMode } = useTheme();

    const training = useLiveQuery(() => db.trainings.get(trainingId), [trainingId]);
    const exercises = useLiveQuery(() =>
        db.exercises.where('trainingId').equals(trainingId).sortBy('order')
        , [trainingId]);

    // Local State
    const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
    const [currentSetIndex, setCurrentSetIndex] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [timeLeft, setTimeLeft] = useState(90);

    const currentExercise = useMemo(() => exercises?.[currentExerciseIndex], [exercises, currentExerciseIndex]);

    // Init Notifications
    useEffect(() => {
        NotificationService.init();

        const listener = NotificationService.addListener('localNotificationActionPerformed', (action) => {
            if (action.actionId === 'SET_COMPLETE') {
                window.dispatchEvent(new CustomEvent('NEOPULSE_NEXT_SET'));
            }
        });

        return () => { listener.then(l => l.remove()); };
    }, []);

    // Handle Event from Notification
    useEffect(() => {
        const handler = () => {
            handleSetComplete();
        };
        window.addEventListener('NEOPULSE_NEXT_SET', handler);
        return () => window.removeEventListener('NEOPULSE_NEXT_SET', handler);
    });

    // Timer Logic & Notification Updates
    useEffect(() => {
        let interval: any = null;

        if (isActive && currentExercise) {
            NotificationService.showStickyNotification(
                `Treino em Andamento: ${currentExercise.name}`,
                `Série ${currentSetIndex + 1} | Descanso: ${timeLeft}s`,
                1001 // Ongoing ID
            );
        }

        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && isActive) {
            setIsActive(false);
            scheduleAlert();
        }

        if (!isActive) {
            NotificationService.cancel(1001);
        }

        return () => clearInterval(interval);
    }, [isActive, timeLeft, currentExercise, currentSetIndex]);

    // Reset timer whenever exercise/set changes
    useEffect(() => {
        if (currentExercise) {
            const duration = currentExercise.restTimes[Math.min(currentSetIndex, currentExercise.restTimes.length - 1)] || 90;
            setTimeLeft(duration);
        }
    }, [currentExercise, currentSetIndex]);


    const scheduleAlert = async () => {
        await NotificationService.showStickyNotification(
            "Tempo Esgotado! 🔔",
            `Prepare-se para: ${currentExercise?.name}`,
            2002 // Alert ID
        );
    };

    const handleSetComplete = async () => {
        if (!currentExercise) return;

        if (currentSetIndex < currentExercise.restTimes.length) {
            if (currentSetIndex < currentExercise.restTimes.length - 1) {
                const nextSet = currentSetIndex + 1;
                setCurrentSetIndex(nextSet);
                setTimeLeft(currentExercise.restTimes[nextSet]);
                setIsActive(true);
            } else {
                setIsActive(false);
            }
        }
    };

    const finishExercise = async () => {
        if (!currentExercise || !training) return;

        await db.history.add({
            exerciseName: currentExercise.name,
            sets: currentSetIndex + 1,
            trainingName: training.name,
            timestamp: Date.now()
        });

        if (currentExerciseIndex < (exercises?.length || 0) - 1) {
            setCurrentExerciseIndex(prev => prev + 1);
            setCurrentSetIndex(0);
            setIsActive(false);
        } else {
            navigate(`/summary?tid=${trainingId}&dur=00:00`);
        }
    };

    if (!exercises || exercises.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-10 h-screen">
                <p className="text-zinc-500 mb-4">Pasta vazia...</p>
                <button
                    title="Adicionar Exercícios"
                    onClick={() => navigate(`/training/${trainingId}`)}
                    style={{ color: theme.primary }}
                    className="underline"
                >
                    Adicionar Exercícios
                </button>
            </div>
        );
    }

    if (!currentExercise) return null;

    return (
        <div className="w-full max-w-md flex flex-col h-[calc(100vh-80px)] animate-in fade-in">
            {/* Header Info */}
            <div className="flex flex-col mb-4 px-2 pt-2">
                <span
                    className="text-[10px] font-black tracking-[0.2em] uppercase"
                    style={{ color: theme.primary }}
                >
                    Set {currentSetIndex + 1}/{currentExercise.restTimes.length}
                </span>
                <h2 className="text-3xl font-black uppercase tracking-tight text-white leading-none break-words">
                    {currentExercise.name}
                </h2>

                {/* Reps and Notes Display */}
                <div className="flex flex-col gap-1 mt-2">
                    {currentExercise.reps && (
                        <span className="text-xs text-zinc-400 font-bold uppercase">
                            <i className="fa-solid fa-dumbbell mr-1"></i> {currentExercise.reps}
                        </span>
                    )}
                    {currentExercise.notes && (
                        <span className="text-xs text-zinc-500 italic max-w-full">
                            {currentExercise.notes}
                        </span>
                    )}
                </div>
            </div>

            {/* Timer */}
            <div className="flex-1 flex items-center justify-center">
                <Timer
                    timeLeft={timeLeft}
                    isActive={isActive}
                    duration={currentExercise.restTimes[currentSetIndex] || 90}
                    onToggle={() => setIsActive(!isActive)}
                    onReset={() => { setIsActive(false); setTimeLeft(currentExercise.restTimes[currentSetIndex]); }}
                    onAdjust={(delta) => setTimeLeft(prev => Math.max(1, prev + delta))}
                    soundMode={soundMode}
                />
            </div>

            {/* Controls */}
            <div className="mt-auto flex gap-4 p-4">
                {currentSetIndex < currentExercise.restTimes.length ? (
                    <button
                        title="Próxima Série"
                        onClick={handleSetComplete}
                        disabled={isActive}
                        className={`flex-1 h-20 rounded-3xl font-black text-sm tracking-[0.2em] flex items-center justify-center transition-all active:scale-[0.96] shadow-2xl ${isActive
                            ? 'bg-zinc-900 text-zinc-600 border border-zinc-900 cursor-not-allowed'
                            : 'bg-white text-black'
                            }`}
                    >
                        {currentSetIndex === currentExercise.restTimes.length - 1 ? 'ÚLTIMA SÉRIE!' : 'PRÓXIMA SÉRIE'}
                    </button>
                ) : (
                    <button
                        title="Próximo Exercício"
                        onClick={finishExercise}
                        style={{ backgroundColor: theme.primary, boxShadow: `0 0 20px ${theme.primary}40` }}
                        className="flex-1 h-20 rounded-3xl text-black font-black tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
                    >
                        <i className="fa-solid fa-check"></i> PRÓXIMO EXERCÍCIO
                    </button>
                )}
            </div>

            {/* Prev/Next Peek */}
            <div className="px-6 py-2 text-center">
                <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                    Próximo: {exercises[currentExerciseIndex + 1]?.name || 'Fim do Treino'}
                </span>
            </div>
        </div>
    );
};

export default SessionView;
