
import React from 'react';
import { Exercise } from '../services/db';
import { useTheme } from '../contexts/ThemeContext';

interface WorkoutTrackerProps {
    exercise: Exercise;
    currentSetIndex: number;
    completedSets: boolean[];
    actualReps: string[];
    actualWeights: string[];
    onSetToggle: (index: number) => void;
    onRepChange: (index: number, value: string) => void;
    onWeightChange: (index: number, value: string) => void;
    onDeleteSet: (index: number) => void;
}

const WorkoutTracker: React.FC<WorkoutTrackerProps> = ({
    exercise,
    currentSetIndex,
    completedSets,
    actualReps,
    actualWeights,
    onSetToggle,
    onRepChange,
    onWeightChange,
    onDeleteSet
}) => {
    const { theme } = useTheme();
    const totalSets = exercise.restTimes.length + 1;

    return (
        <div className="w-full space-y-2 px-1">
            {Array.from({ length: totalSets }).map((_, i) => {
                const isCurrent = i === currentSetIndex;
                const isCompleted = completedSets[i];
                const targetText = exercise.targetReps?.[i] || exercise.setReps?.[i] || "0";

                return (
                    <div
                        key={i}
                        className={`grid grid-cols-[32px_1fr_62px_62px_38px_28px] gap-1.5 items-center px-3 py-2 rounded-xl border transition-all ${isCurrent
                            ? 'bg-zinc-900 border-[#00FF41]/30'
                            : isCompleted
                                ? 'bg-black/40 border-zinc-900/50 opacity-40'
                                : 'bg-black/20 border-zinc-900/30'
                            }`}
                    >
                        {/* Index */}
                        <div className={`text-[10px] font-black italic ${isCurrent ? 'text-[#00FF41]' : 'text-zinc-800'}`}>
                            #{i + 1}
                        </div>

                        {/* Goal HUD */}
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-zinc-700 uppercase leading-none mb-0.5">META</span>
                            <span className={`text-[10px] font-bold ${isCurrent ? 'text-white' : 'text-zinc-500'}`}>
                                {targetText} reps
                            </span>
                        </div>

                        {/* Weight Input */}
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[7px] font-black text-zinc-800 uppercase text-center">KG</span>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={actualWeights[i] || ''}
                                onChange={(e) => onWeightChange(i, e.target.value)}
                                placeholder={exercise.lastWeights?.[i]?.toString() || "--"}
                                className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg h-7 text-white font-black text-[10px] w-full text-center focus:outline-none focus:border-[#00FF41]/30 placeholder:text-zinc-700"
                            />
                        </div>

                        {/* Reps Input */}
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[7px] font-black text-zinc-800 uppercase text-center">REPS</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={actualReps[i] || ''}
                                onChange={(e) => onRepChange(i, e.target.value)}
                                placeholder={targetText}
                                className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg h-7 text-white font-black text-[10px] w-full text-center focus:outline-none focus:border-[#00FF41]/30 placeholder:text-zinc-700"
                            />
                        </div>

                        <button
                            onClick={() => onSetToggle(i)}
                            title="Completar Série"
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isCompleted
                                ? 'bg-[#00FF41] text-black'
                                : 'bg-zinc-900 border border-zinc-800 text-zinc-900'
                                }`}
                        >
                            <i className={`fa-solid ${isCompleted ? 'fa-check' : 'fa-circle-check'} text-[10px]`}></i>
                        </button>

                        {/* Delete Set Button */}
                        <button
                            onClick={() => {
                                if (totalSets > 1 && confirm('Excluir esta série?')) {
                                    onDeleteSet(i);
                                }
                            }}
                            title="Excluir Série"
                            className={`w-7 h-7 flex items-center justify-center text-zinc-900 hover:text-red-500 transition-colors ${totalSets <= 1 ? 'opacity-0 pointer-events-none' : ''}`}
                        >
                            <i className="fa-solid fa-trash-can text-[10px]"></i>
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

export default WorkoutTracker;
