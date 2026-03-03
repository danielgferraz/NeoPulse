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
    finishCurrentExercise: () => void;
    isProcessingTransition: boolean;
    isActuallyPlaying: boolean;
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
    const [isProcessingTransition, setIsProcessingTransition] = useState(false);

    // 2. Lógica de Persistência (Capacitor Preferences)
    const saveSession = async () => {
        // Bloqueio rigoroso se estivermos finalizando, sem ID definido, ou se chegamos ao fim (Conclusão)
        if (trainingId === null || isProcessingTransition || currentExerciseIndex >= queue.length) return;

        try {
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

            // Salvar no Dexie (Fallback e Reatividade da Home)
            await db.activeSession.put({
                id: 'current',
                trainingId: trainingId,
                trainingName: trainingName,
                exerciseIndex: currentExerciseIndex,
                setIndex: currentSetIndex,
                queue: queue,
                completedSets: completedSets,
                actualWeights: actualWeights,
                actualReps: actualReps,
                actualRpes: actualRpes,
                isPlaying: isPlaying,
                isStopwatch: isStopwatch,
                timeLeft: timeLeft,
                stopwatchTime: stopwatchTime,
                timestamp: Date.now()
            });

            // Salvar no Preferences (Widget e Persistência Hard)
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
        } catch (error) {
            console.error("Erro ao salvar sessão:", error);
        }
    };

    useEffect(() => {
        if (trainingId !== null && !isProcessingTransition) {
            saveSession();
        }
    }, [trainingId, currentExerciseIndex, currentSetIndex, completedSets, actualWeights, actualReps, actualRpes, isPlaying, isProcessingTransition]);

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
        }
    }, [timeLeft, isStopwatch, isPlaying]);


    // 3. Ações
    const togglePlayPause = () => setIsPlaying(!isPlaying);
    const setTimerMode = (sw: boolean) => setIsStopwatch(sw);

    const resetTimer = () => {
        const currentExercise = queue[currentExerciseIndex];
        if (currentExercise && currentExercise.restTimes[currentSetIndex - 1]) {
            const rest = currentExercise.restTimes[currentSetIndex - 1];
            setTimeLeft(rest);
            setDuration(rest);
        }
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

    const abortWorkout = async () => {
        setIsProcessingTransition(true);
        setIsPlaying(false);

        try {
            await Preferences.remove({ key: 'neopulse_persistent_session' });
            await db.activeSession.delete('current').catch(console.error);

            setQueue([]);
            setTrainingId(null);
            setTrainingName('');
            setCurrentExerciseIndex(0);
            setCurrentSetIndex(0);
            setCompletedSets({});
            setActualReps({});
            setActualWeights({});
            setActualRpes({});
            setCompletedIndices([]);
            setStopwatchTime(0);
            setIsStopwatch(false);
        } finally {
            setIsProcessingTransition(false);
        }
    };

    const finishWorkout = async () => {
        if (trainingId === null || queue.length === 0) return;

        setIsProcessingTransition(true);

        try {
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

            await Preferences.remove({ key: 'neopulse_persistent_session' });
            await db.activeSession.delete('current');

            const currentTrainingName = trainingName;

            setQueue([]);
            setTrainingId(null);
            setTrainingName('');
            setIsPlaying(false);
            setCurrentExerciseIndex(0);
            setCurrentSetIndex(0);
            setCompletedSets({});
            setActualReps({});
            setActualWeights({});
            setActualRpes({});
            setCompletedIndices([]);
            setStopwatchTime(0);
            setIsStopwatch(false);

            await db.history.add({
                exerciseName: currentTrainingName,
                sets: details.reduce((acc, curr) => acc + curr.sets, 0),
                timestamp: Date.now(),
                trainingName: currentTrainingName,
                details: details
            });

        } catch (error) {
            console.error("Erro ao finalizar treino:", error);
        } finally {
            setIsProcessingTransition(false);
        }
    };

    const addExerciseToQueue = (exercise: Exercise) => {
        setQueue(prev => [...prev, exercise]);
    };

    const skipNext = () => {
        if (currentExerciseIndex < queue.length - 1) {
            setCurrentExerciseIndex(prev => prev + 1);
            setCurrentSetIndex(0);
            setIsPlaying(false);
            setStopwatchTime(0);
            const nextRest = queue[currentExerciseIndex + 1]?.restTimes[0] || 90;
            setDuration(nextRest);
            setTimeLeft(nextRest);
        }
    };

    const skipPrev = () => {
        if (currentExerciseIndex > 0) {
            setCurrentExerciseIndex(prev => prev - 1);
            setCurrentSetIndex(0);
            setIsPlaying(false);
            setStopwatchTime(0);
            const prevRest = queue[currentExerciseIndex - 1]?.restTimes[0] || 90;
            setDuration(prevRest);
            setTimeLeft(prevRest);
        }
    };

    const finishCurrentExercise = () => {
        const currentExercise = queue[currentExerciseIndex];
        if (!currentExercise) return;

        if (currentExerciseIndex < queue.length - 1) {
            setCurrentExerciseIndex(prev => prev + 1);
            setCurrentSetIndex(0);
            setIsPlaying(false);
            setStopwatchTime(0);
            const nextRest = queue[currentExerciseIndex + 1]?.restTimes[0] || 90;
            setDuration(nextRest);
            setTimeLeft(nextRest);
        } else {
            setCurrentExerciseIndex(queue.length);
        }
    };

    const resumeWorkout = async () => {
        const { value } = await Preferences.get({ key: 'neopulse_persistent_session' });
        if (value) {
            if (trainingId === null) {
                const active = await db.activeSession.get('current');
                if (active) {
                    const tr = await db.trainings.get(active.trainingId);
                    const exes = active.queue || await db.exercises.where('trainingId').equals(active.trainingId).sortBy('order');

                    setTrainingId(active.trainingId);
                    setTrainingName(active.trainingName || tr?.name || 'Treino Ativo');
                    setQueue(exes);
                    setCurrentExerciseIndex(active.exerciseIndex);
                    setCurrentSetIndex(active.setIndex);
                    setCompletedSets(active.completedSets || {});
                    setActualWeights(active.actualWeights || {});
                    setActualReps(active.actualReps || {});
                    setActualRpes(active.actualRpes || {});
                }
            }
        }
    };

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
        const currentExercise = queue[currentExerciseIndex];
        if (!currentExercise) return;
        const exId = currentExercise.id ? currentExercise.id : currentExerciseIndex + 1000;

        setCompletedSets(prev => {
            const arr = [...(prev[exId] || [])];
            arr[currentSetIndex] = true;
            return { ...prev, [exId]: arr };
        });

        if (currentSetIndex < currentExercise.restTimes.length) {
            const rest = currentExercise.restTimes[currentSetIndex];
            setDuration(rest);
            setTimeLeft(rest);
            setStopwatchTime(0);
            setIsPlaying(true);
            setCurrentSetIndex(prev => prev + 1);
        } else {
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
            setCurrentSetIndex(prev => prev - 1);
            const exId = currentExercise.id ? currentExercise.id : currentExerciseIndex + 1000;
            setCompletedSets(prev => {
                const arr = [...(prev[exId] || [])];
                arr[currentSetIndex - 1] = false;
                return { ...prev, [exId]: arr };
            });
            setIsPlaying(false);
            setStopwatchTime(0);
        } else if (currentExerciseIndex > 0) {
            setCurrentExerciseIndex(prev => prev - 1);
            const prevExercise = queue[currentExerciseIndex - 1];
            setCurrentSetIndex(prevExercise.restTimes.length);
            setIsPlaying(false);
            setStopwatchTime(0);
        }
    };

    const addExtraSet = () => {
        const currentExercise = queue[currentExerciseIndex];
        if (!currentExercise) return;

        const lastRest = currentExercise.restTimes[currentExercise.restTimes.length - 1] || 90;
        const updatedExercise = {
            ...currentExercise,
            restTimes: [...currentExercise.restTimes, lastRest]
        };

        setQueue(prev => {
            const arr = [...prev];
            arr[currentExerciseIndex] = updatedExercise;
            return arr;
        });
    };

    const isActuallyPlaying = useMemo(() => {
        return trainingId !== null &&
            queue.length > 0 &&
            currentExerciseIndex < queue.length &&
            !isProcessingTransition;
    }, [trainingId, queue.length, currentExerciseIndex, isProcessingTransition]);

    const value: WorkoutPlayerState = {
        trainingId, trainingName,
        isPlaying, isStopwatch, timeLeft, duration, stopwatchTime,
        queue, currentExerciseIndex, currentSetIndex,
        completedSets, actualReps, actualWeights, actualRpes, completedIndices,
        setIsPlaying, togglePlayPause, setTimerMode, resetTimer, adjustTimer,
        startWorkout, finishWorkout, abortWorkout,
        skipNext, skipPrev, reorderQueue, removeFromQueue,
        registerSet, completeCurrentSet, previousSet, addExtraSet, addExerciseToQueue, resumeWorkout, finishCurrentExercise,
        isProcessingTransition, isActuallyPlaying
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
