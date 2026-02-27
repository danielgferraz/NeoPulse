
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
    const totalSets = exercise.restTimes.length;

    return (
        <div className="w-full space-y-2 px-1">
            {Array.from({ length: totalSets }).map((_, i) => {
                const isCurrent = i === currentSetIndex;
                const isCompleted = completedSets[i];
                const targetText = exercise.targetReps?.[i] || exercise.setReps?.[i] || "0";

                return (
                    <div
                        key={i}
                        className={`grid grid-cols-[32px_1fr_62px_62px_38px_28px] gap-1.5 items-center px-3 py-2.5 rounded-xl border transition-all ${isCurrent
                            ? 'bg-zinc-900/90 border-[#00FF41]/60 shadow-[0_0_12px_rgba(0,255,65,0.15)] ring-1 ring-[#00FF41]/20'
                            : isCompleted
                                ? 'bg-black/40 border-zinc-900/50 opacity-40'
                                : 'bg-zinc-900/40 border-zinc-800/60'
                            }`}
                    >
                        {/* Index */}
                        <div className={`text-[11px] font-black italic ${isCurrent ? 'text-[#00FF41]' : 'text-zinc-500'}`}>
                            #{i + 1}
                        </div>

                        {/* Goal HUD */}
                        <div className="flex flex-col">
                            <span className="text-[8px] font-black text-zinc-500 uppercase leading-none mb-0.5">META</span>
                            <span className={`text-[11px] font-bold ${isCurrent ? 'text-white' : 'text-zinc-400'}`}>
                                {targetText} reps
                            </span>
                        </div>

                        {/* Weight Input */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black text-zinc-500 uppercase text-center tracking-wider">KG</span>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={actualWeights[i] || ''}
                                onChange={(e) => onWeightChange(i, e.target.value)}
                                placeholder={exercise.lastWeights?.[i]?.toString() || "--"}
                                className={`rounded-lg h-8 text-white font-black text-xs w-full text-center focus:outline-none focus:border-[#00FF41] placeholder:text-zinc-600 transition-colors ${isCurrent ? 'bg-black border border-zinc-700' : 'bg-black/50 border border-zinc-800/80'
                                    }`}
                            />
                        </div>

                        {/* Reps Input */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black text-zinc-500 uppercase text-center tracking-wider">REPS</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={actualReps[i] || ''}
                                onChange={(e) => onRepChange(i, e.target.value)}
                                placeholder={targetText}
                                className={`rounded-lg h-8 text-white font-black text-xs w-full text-center focus:outline-none focus:border-[#00FF41] placeholder:text-zinc-600 transition-colors ${isCurrent ? 'bg-black border border-zinc-700' : 'bg-black/50 border border-zinc-800/80'
                                    }`}
                            />
                        </div>

                        <button
                            onClick={() => onSetToggle(i)}
                            title="Completar Série"
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isCompleted
                                ? 'bg-[#00FF41] text-black shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                                : isCurrent ? 'bg-zinc-800 border border-zinc-700 text-white' : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
                                }`}
                        >
                            <i className={`fa-solid ${isCompleted ? 'fa-check' : 'fa-check'} text-xs`}></i>
                        </button>

                        {/* Delete Set Button */}
                        <button
                            onClick={() => {
                                if (totalSets > 1 && confirm('Excluir esta série?')) {
                                    onDeleteSet(i);
                                }
                            }}
                            title="Excluir Série"
                            className={`w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors ${totalSets <= 1 ? 'opacity-0 pointer-events-none' : ''}`}
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
