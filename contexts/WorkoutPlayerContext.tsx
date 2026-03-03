import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { db, Exercise, Training } from '../services/db';
import Dexie from 'dexie';
import { Preferences } from '@capacitor/preferences';

// Tipo principal do Player de Treino
export interface WorkoutPlayerState {
    // Info
    trainingId: number | null;
    trainingName: string;

    // Status do Player
    isPlaying: boolean;
    isStopwatch: boolean;
    timeLeft: number;
    duration: number;
    stopwatchTime: number;

    // Fila (Playlist)
    queue: Exercise[];
    currentExerciseIndex: number;
    currentSetIndex: number;

    // Tracking
    completedSets: { [exerciseId: number]: boolean[] };
    actualReps: { [exerciseId: number]: string[] };
    actualWeights: { [exerciseId: number]: string[] };
    actualRpes: { [exerciseId: number]: string[] };
    completedIndices: number[];

    // Controle Básico
    setIsPlaying: (playing: boolean) => void;
    togglePlayPause: () => void;
    setTimerMode: (isStopwatch: boolean) => void;

    // Controle da Fila
    startWorkout: (trainingId: number, name: string, exercises: Exercise[]) => void;
    finishWorkout: () => Promise<void>;
    abortWorkout: () => void;

    // Ações na Playlist
    skipNext: () => void;
    skipPrev: () => void;
    reorderQueue: (fromIndex: number, toIndex: number) => void;
    removeFromQueue: (index: number) => void;

    // Controle do Timer Manual
    resetTimer: () => void;
    adjustTimer: (amount: number) => void;

    // Interações de Série In-loco
    registerSet: (exerciseId: number, setIdx: number, weight: string, reps: string, rpe?: string) => void;
    completeCurrentSet: () => void;
    previousSet: () => void;
    addExtraSet: () => void;
    addExerciseToQueue: (exercise: Exercise) => void;
    resumeWorkout: () => Promise<void>;
}

const WorkoutPlayerContext = createContext<WorkoutPlayerState | undefined>(undefined);

export const WorkoutPlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // 1. Estados base
    const [trainingId, setTrainingId] = useState<number | null>(null);
    const [trainingName, setTrainingName] = useState('');

    const [isPlaying, setIsPlaying] = useState(false);
    const [isStopwatch, setIsStopwatch] = useState(false);

    // Timers
    const [duration, setDuration] = useState(90);
    const [timeLeft, setTimeLeft] = useState(0);
    const [stopwatchTime, setStopwatchTime] = useState(0);

    // Queue e Progressão
    const [queue, setQueue] = useState<Exercise[]>([]);
    const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
    const [currentSetIndex, setCurrentSetIndex] = useState(0);

    // Tracking Dictionary
    const [completedSets, setCompletedSets] = useState<{ [exerciseId: number]: boolean[] }>({});
    const [actualReps, setActualReps] = useState<{ [exerciseId: number]: string[] }>({});
    const [actualWeights, setActualWeights] = useState<{ [exerciseId: number]: string[] }>({});
    const [actualRpes, setActualRpes] = useState<{ [exerciseId: number]: string[] }>({});
    const [completedIndices, setCompletedIndices] = useState<number[]>([]);

    // 2. Lógica de Persistência (Capacitor Preferences)
    const saveSession = async () => {
        if (!trainingId) return;
        const sessionData = {
            trainingId,
            trainingName,
            queue,
            currentExerciseIndex,
            currentSetIndex,
            completedSets,
            actualReps,
            actualWeights,
            actualRpes,
            completedIndices,
            lastUpdated: Date.now()
        };
        await db.activeSession.put({
            id: 'current',
            trainingId: trainingId || 0,
            startTime: Date.now(), // Simplificado por enquanto
            exerciseIndex: currentExerciseIndex,
            setIndex: currentSetIndex,
            completedExercises: [], // TODO: mapear se necessário
            extraExercises: [],
            completedIndices: completedIndices
        });
        // Também salvar no Preferences para garantir o botão da Home
        await Preferences.set({
            key: 'neopulse_persistent_session',
            value: JSON.stringify({
                trainingId,
                exercise: queue[currentExerciseIndex]?.name || 'Treino',
                next: queue[currentExerciseIndex + 1]?.name || '---',
                setIndex: currentSetIndex,
                totalSets: queue[currentExerciseIndex]?.restTimes.length + 1 || 0,
                lastTimestamp: Date.now(),
                isActive: isPlaying,
                isStopwatch,
                timeLeft,
                stopwatchTime
            })
        });
    };

    useEffect(() => {
        if (trainingId) {
            saveSession();
        }
    }, [trainingId, currentExerciseIndex, currentSetIndex, completedSets, actualWeights, actualReps, actualRpes, isPlaying]);

    // 3. Lógica do Relógio (Engine)
    useEffect(() => {
        let interval: any = null;
        if (isPlaying) {
            interval = setInterval(() => {
                if (isStopwatch) {
                    setStopwatchTime(prev => prev + 1);
                } else {
                    setTimeLeft(prev => {
                        if (prev <= 1) return 0;
                        return prev - 1;
                    });
                }
            }, 1000);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [isPlaying, isStopwatch]);

    // Parar timer quando chegar a zero
    useEffect(() => {
        if (!isStopwatch && timeLeft === 0 && isPlaying) {
            setIsPlaying(false);
            // scheduleAlert TODO: abstrair notificações pra cá futuramente
        }
    }, [timeLeft, isStopwatch, isPlaying]);


    // 3. Ações
    const togglePlayPause = () => setIsPlaying(!isPlaying);
    const setTimerMode = (sw: boolean) => setIsStopwatch(sw);

    const resetTimer = () => {
        const currentExercise = queue[currentExerciseIndex];
        if (currentExercise && currentExercise.restTimes[currentSetIndex]) {
            const rest = currentExercise.restTimes[currentSetIndex];
            setTimeLeft(rest);
            setDuration(rest);
        } else {
            setTimeLeft(90);
            setDuration(90);
        }
        setStopwatchTime(0);
    };

    const adjustTimer = (amount: number) => {
        if (isStopwatch) return;
        setTimeLeft(prev => {
            const newVal = prev + amount;
            return newVal > 0 ? newVal : 0;
        });
    };

    const startWorkout = (tId: number, tName: string, exercises: Exercise[]) => {
        setTrainingId(tId);
        setTrainingName(tName);
        setQueue(exercises);
        setCurrentExerciseIndex(0);
        setCurrentSetIndex(0);
        setTimeLeft(exercises[0]?.restTimes[0] || 90);
        setDuration(exercises[0]?.restTimes[0] || 90);
        setCompletedSets({});
        setActualReps({});
        setActualWeights({});
        setActualRpes({});
        setCompletedIndices([]);
        setIsPlaying(false);
        setStopwatchTime(0);
        setIsStopwatch(false);
    };

    const abortWorkout = () => {
        setTrainingId(null);
        setQueue([]);
        setIsPlaying(false);
        // Clear ActiveSession fallback db
        db.activeSession.delete('current').catch(console.error);
    };

    const finishWorkout = async () => {
        if (!trainingId || queue.length === 0) return;

        // 1. Limpar as preferências IMEDIATAMENTE para evitar race conditions com saveSession
        await Preferences.remove({ key: 'neopulse_persistent_session' });
        await db.activeSession.delete('current');

        // 2. Mapear detalhes para o histórico
        const details = queue.map((ex, idx) => {
            const exId = ex.id || idx + 1000;
            return {
                name: ex.name,
                sets: ex.restTimes.length + 1,
                reps: actualReps[exId] || [],
                weights: (actualWeights[exId] || []).map(w => parseFloat(w.replace(',', '.')) || 0),
                rpes: (actualRpes[exId] || []).map(r => parseFloat(r.replace(',', '.')) || 0)
            };
        });

        // 3. Salvar no Banco
        await db.history.add({
            exerciseName: trainingName,
            sets: details.reduce((acc, curr) => acc + curr.sets, 0),
            timestamp: Date.now(),
            trainingName: trainingName,
            details: details
        });

        // 4. Resetar contexto local
        setTrainingId(null);
        setQueue([]);
        setIsPlaying(false);
    };

    const addExerciseToQueue = (exercise: Exercise) => {
        setQueue(prev => [...prev, exercise]);
    };

    const resumeWorkout = async () => {
        const { value } = await Preferences.get({ key: 'neopulse_persistent_session' });
        if (value) {
            const session = JSON.parse(value);
            // Se já estamos no player e o ID bate, não faz nada ou recarrega.
            // Para NeoPulse, vamos confiar no estado do Context se ele já estiver carregado.
            // Mas se o Context estiver vazio (pós restart), carregamos do DB.
            if (!trainingId) {
                const active = await db.activeSession.get('current');
                if (active) {
                    const tr = await db.trainings.get(active.trainingId);
                    const exes = await db.exercises.where('trainingId').equals(active.trainingId).sortBy('order');
                    if (tr) {
                        setTrainingId(active.trainingId);
                        setTrainingName(tr.name);
                        setQueue(exes);
                        setCurrentExerciseIndex(active.exerciseIndex);
                        setCurrentSetIndex(active.setIndex);
                        setCompletedIndices(active.completedIndices || []);
                        // Nota: pesos/reps seriam melhor salvos em uma tabela separada ou no blob da session
                        // Por ora, vamos garantir que o fluxo de navegação funciona.
                    }
                }
            }
        }
    };

    const skipNext = () => { /* Em breve iterar exercicios */ };
    const skipPrev = () => { /* Em breve iterar exercicios */ };

    const reorderQueue = (fromIndex: number, toIndex: number) => {
        setQueue(prev => {
            const arr = [...prev];
            const [moved] = arr.splice(fromIndex, 1);
            arr.splice(toIndex, 0, moved);
            return arr;
        });
    };

    const removeFromQueue = (index: number) => {
        setQueue(prev => {
            const arr = [...prev];
            arr.splice(index, 1);
            return arr;
        });
        if (index < currentExerciseIndex) {
            setCurrentExerciseIndex(prev => prev - 1);
        } else if (index === currentExerciseIndex) {
            setCurrentSetIndex(0);
        }
    };

    const registerSet = (exerciseId: number, setIdx: number, weight: string, reps: string, rpe?: string) => {
        setActualWeights(prev => {
            const arr = [...(prev[exerciseId] || [])];
            arr[setIdx] = weight;
            return { ...prev, [exerciseId]: arr };
        });
        setActualReps(prev => {
            const arr = [...(prev[exerciseId] || [])];
            arr[setIdx] = reps;
            return { ...prev, [exerciseId]: arr };
        });
        if (rpe) {
            setActualRpes(prev => {
                const arr = [...(prev[exerciseId] || [])];
                arr[setIdx] = rpe;
                return { ...prev, [exerciseId]: arr };
            });
        }
    };

    const completeCurrentSet = () => {
        // Logica para pular para a proxima serie via Player
        const currentExercise = queue[currentExerciseIndex];
        if (!currentExercise) return;
        const exId = currentExercise.id ? currentExercise.id : currentExerciseIndex + 1000;

        // Marca Set como completo
        setCompletedSets(prev => {
            const arr = [...(prev[exId] || [])];
            arr[currentSetIndex] = true;
            return { ...prev, [exId]: arr };
        });

        // Configura Timer Proxima Serie
        if (currentSetIndex < currentExercise.restTimes.length) {
            const rest = currentExercise.restTimes[currentSetIndex];
            setDuration(rest);
            setTimeLeft(rest);
            setStopwatchTime(0);
            setIsPlaying(true); // Auto-start the rest
            setCurrentSetIndex(prev => prev + 1);
        } else {
            // Fim do exercicio via "Next Track"
            if (!completedIndices.includes(currentExerciseIndex)) {
                setCompletedIndices(prev => [...prev, currentExerciseIndex]);
            }
            setIsPlaying(false);
            if (currentExerciseIndex < queue.length - 1) {
                setCurrentExerciseIndex(prev => prev + 1);
                setCurrentSetIndex(0);
                const nextRest = queue[currentExerciseIndex + 1]?.restTimes[0] || 90;
                setDuration(nextRest);
                setTimeLeft(nextRest);
                setStopwatchTime(0);
            }
        }
    };

    const previousSet = () => {
        const currentExercise = queue[currentExerciseIndex];
        if (!currentExercise) return;

        if (currentSetIndex > 0) {
            // Volta uma série no mesmo exercício
            setCurrentSetIndex(prev => prev - 1);

            // Retoma desmarcando o status se estiver true? Vamos manter fiel ao toggle,
            // ou apenas voltamos o foco principal
            const exId = currentExercise.id ? currentExercise.id : currentExerciseIndex + 1000;
            setCompletedSets(prev => {
                const arr = [...(prev[exId] || [])];
                arr[currentSetIndex - 1] = false; // Desmarca a série ao voltar para forçar usuário a confirmar
                return { ...prev, [exId]: arr };
            });

            setIsPlaying(false);
            setStopwatchTime(0);
        } else if (currentExerciseIndex > 0) {
            // Volta para o último set do exercício anterior
            setCurrentExerciseIndex(prev => prev - 1);
            const prevExercise = queue[currentExerciseIndex - 1];
            setCurrentSetIndex(prevExercise.restTimes.length - 1);
            setIsPlaying(false);
            setStopwatchTime(0);
        }
    };

    const addExtraSet = () => {
        const currentExercise = queue[currentExerciseIndex];
        if (!currentExercise) return;

        // Duplicar configs do ultimo Set
        const lastRest = currentExercise.restTimes[currentExercise.restTimes.length - 1] || 90;
        const lastTargetRep = currentExercise.targetReps?.[currentExercise.restTimes.length - 1]
            || currentExercise.setReps?.[currentExercise.restTimes.length - 1]
            || "0";

        // Gerar nova instânica de exercise
        const updatedExercise = {
            ...currentExercise,
            restTimes: [...currentExercise.restTimes, lastRest]
        };

        // Target / Set Reps array extension
        if (updatedExercise.targetReps) {
            updatedExercise.targetReps = [...updatedExercise.targetReps, lastTargetRep];
        } else if (updatedExercise.setReps) {
            updatedExercise.setReps = [...updatedExercise.setReps, lastTargetRep];
        }

        // Apply
        setQueue(prev => {
            const arr = [...prev];
            arr[currentExerciseIndex] = updatedExercise;
            return arr;
        });
    };

    const value: WorkoutPlayerState = {
        trainingId, trainingName,
        isPlaying, isStopwatch, timeLeft, duration, stopwatchTime,
        queue, currentExerciseIndex, currentSetIndex,
        completedSets, actualReps, actualWeights, actualRpes, completedIndices,
        setIsPlaying, togglePlayPause, setTimerMode, resetTimer, adjustTimer,
        startWorkout, finishWorkout, abortWorkout,
        skipNext, skipPrev, reorderQueue, removeFromQueue,
        registerSet, completeCurrentSet, previousSet, addExtraSet, addExerciseToQueue, resumeWorkout
    };

    return (
        <WorkoutPlayerContext.Provider value={value}>
            {children}
        </WorkoutPlayerContext.Provider>
    );
};

export const useWorkoutPlayer = () => {
    const context = useContext(WorkoutPlayerContext);
    if (context === undefined) {
        throw new Error('useWorkoutPlayer must be used within a WorkoutPlayerProvider');
    }
    return context;
};
