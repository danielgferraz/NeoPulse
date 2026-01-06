import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Exercise } from '../services/db';
import Timer from '../components/Timer';
import { Icons } from '../constants';
import { getWorkoutTip } from '../services/geminiService';
import { LocalNotifications } from '@capacitor/local-notifications';

const SessionView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const trainingId = parseInt(id || '0');
    const navigate = useNavigate();

    const training = useLiveQuery(() => db.trainings.get(trainingId), [trainingId]);
    const exercises = useLiveQuery(() =>
        db.exercises.where('trainingId').equals(trainingId).sortBy('order')
        , [trainingId]);

    // Local State
    const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
    const [currentSetIndex, setCurrentSetIndex] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [timeLeft, setTimeLeft] = useState(90);
    const [tip, setTip] = useState<string | null>(null);
    const [loadingTip, setLoadingTip] = useState(false);

    const currentExercise = useMemo(() => exercises?.[currentExerciseIndex], [exercises, currentExerciseIndex]);

    // Timer Logic
    useEffect(() => {
        let interval: any = null;
        if (isActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && isActive) {
            setIsActive(false);
            scheduleNotification();
        }
        return () => clearInterval(interval);
    }, [isActive, timeLeft]);

    // Reset timer whenever exercise/set changes
    useEffect(() => {
        if (currentExercise) {
            const duration = currentExercise.restTimes[Math.min(currentSetIndex, currentExercise.restTimes.length - 1)] || 90;
            setTimeLeft(duration);
        }
    }, [currentExercise, currentSetIndex]);


    const scheduleNotification = async () => {
        // Implementação básica de notificação
        const permission = await LocalNotifications.checkPermissions();
        if (permission.display === 'granted') {
            await LocalNotifications.schedule({
                notifications: [{
                    title: "Tempo Esgotado!",
                    body: `Próxima série de ${currentExercise?.name}`,
                    id: Math.floor(Math.random() * 10000),
                    schedule: { at: new Date(Date.now() + 100) },
                    sound: 'beep.wav',
                    smallIcon: 'ic_stat_icon_config_sample',
                    actionTypeId: "",
                    extra: null
                }]
            });
        }
    };

    const handleSetComplete = async () => {
        if (!currentExercise) return;

        // Check if exercise is done
        if (currentSetIndex < currentExercise.restTimes.length - 1) {
            // Next Set
            const nextSet = currentSetIndex + 1;
            setCurrentSetIndex(nextSet);
            setTimeLeft(currentExercise.restTimes[nextSet]);
            setIsActive(true);
        } else {
            // Exercise Finished - Wait for user manual check
            // For UX, we might just stop timer and wait for "Check" button
            setIsActive(false);
        }
    };

    const finishExercise = async () => {
        if (!currentExercise || !training) return;

        // Save History
        await db.history.add({
            exerciseName: currentExercise.name,
            sets: currentSetIndex + 1,
            trainingName: training.name,
            timestamp: Date.now()
        });

        // Move to next exercise
        if (currentExerciseIndex < (exercises?.length || 0) - 1) {
            setCurrentExerciseIndex(prev => prev + 1);
            setCurrentSetIndex(0);
            setIsActive(false);
            setTip(null);
        } else {
            alert("Treino Finalizado! Parabéns machine! 🦍");
            navigate('/');
        }
    };

    if (!exercises || exercises.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-10 h-screen">
                <p className="text-zinc-500 mb-4">Pasta vazia...</p>
                <button onClick={() => navigate(`/training/${trainingId}`)} className="text-[#00FF41] underline">Adicionar Exercícios</button>
            </div>
        );
    }

    if (!currentExercise) return null;

    return (
        <div className="w-full max-w-md flex flex-col h-[calc(100vh-80px)] animate-in fade-in">
            {/* Header Info */}
            <div className="flex justify-between items-start mb-6 px-2">
                <div>
                    <span className="text-[10px] font-black text-[#00FF41] tracking-[0.2em] uppercase">Set {currentSetIndex + 1}/{currentExercise.restTimes.length}</span>
                    <h2 className="text-3xl font-black uppercase tracking-tight text-white leading-none">{currentExercise.name}</h2>
                </div>
                <button onClick={() => { setLoadingTip(true); getWorkoutTip(currentExercise.name).then(t => { setTip(t); setLoadingTip(false); }) }}
                    className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#00FF41]">
                    {loadingTip ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <Icons.Sparkles />}
                </button>
            </div>

            {tip && <div className="mb-6 p-4 bg-black/30 rounded-2xl border border-[#00FF41]/10 text-xs text-zinc-400 italic">"{tip}"</div>}

            {/* Timer */}
            <div className="flex-1 flex items-center justify-center">
                <Timer
                    timeLeft={timeLeft}
                    isActive={isActive}
                    duration={currentExercise.restTimes[currentSetIndex] || 90}
                    onToggle={() => setIsActive(!isActive)}
                    onReset={() => { setIsActive(false); setTimeLeft(currentExercise.restTimes[currentSetIndex]); }}
                    onAdjust={(delta) => setTimeLeft(prev => Math.max(1, prev + delta))}
                />
            </div>

            {/* Controls */}
            <div className="mt-auto flex gap-4 p-4">
                {currentSetIndex < currentExercise.restTimes.length ? (
                    <button
                        onClick={handleSetComplete}
                        disabled={isActive}
                        className={`flex-1 h-20 rounded-3xl font-black text-sm tracking-[0.2em] flex items-center justify-center transition-all active:scale-[0.96] shadow-2xl ${isActive
                            ? 'bg-zinc-900 text-zinc-600 border border-zinc-900 cursor-not-allowed'
                            : 'bg-white text-black'}`}
                    >
                        {currentSetIndex === currentExercise.restTimes.length - 1 ? 'ÚLTIMA SÉRIE!' : 'PRÓXIMA SÉRIE'}
                    </button>
                ) : (
                    <button
                        onClick={finishExercise}
                        className="flex-1 h-20 rounded-3xl bg-[#00FF41] text-black font-black tracking-widest flex items-center justify-center gap-2 hover:shadow-[0_0_20px_#00FF41]"
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
