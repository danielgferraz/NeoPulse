import React, { useState } from 'react';
import { Exercise } from '../services/db';
import { useTheme } from '../contexts/ThemeContext';
import { Check, Trash2 } from 'lucide-react';

interface WorkoutTrackerProps {
    exercise: Exercise;
    currentSetIndex: number;
    completedSets: boolean[];
    actualReps: string[];
    actualWeights: string[];
    actualRpes?: string[];
    onSetToggle: (index: number) => void;
    onRepChange: (index: number, value: string) => void;
    onWeightChange: (index: number, value: string) => void;
    onRpeChange?: (index: number, value: string) => void;
    onDeleteSet: (index: number) => void;
    displayMode?: 'all' | 'past' | 'current-and-future';
}

const WorkoutTracker: React.FC<WorkoutTrackerProps> = ({
    exercise,
    currentSetIndex,
    completedSets,
    actualReps,
    actualWeights,
    actualRpes,
    onSetToggle,
    onRepChange,
    onWeightChange,
    onRpeChange,
    onDeleteSet,
    displayMode = 'all'
}) => {
    const { theme } = useTheme();
    const totalSets = exercise.restTimes.length;
    const [activeRpePromptIdx, setActiveRpePromptIdx] = useState<number | null>(null);
    const [expandedSet, setExpandedSet] = useState<number | null>(null);

    const rpeOptions = ["7", "7.5", "8", "8.5", "9", "9.5", "10"];

    return (
        <div className="w-full space-y-2 px-1">
            {Array.from({ length: totalSets }).map((_, i) => {
                const isCurrent = i === currentSetIndex;
                const isPast = i < currentSetIndex;
                const isCompleted = completedSets[i];
                const isFuture = i > currentSetIndex;
                const targetText = exercise.targetReps?.[i] || exercise.setReps?.[i] || "0";

                if (displayMode === 'past' && !isPast) return null;
                if (displayMode === 'current-and-future' && isPast) return null;

                const isExpanded = isCurrent || expandedSet === i;

                if (!isExpanded) {
                    if (isPast) {
                        return (
                            <div key={i} className="flex flex-col w-full mb-1">
                                <div onClick={() => setExpandedSet(i)} className="flex justify-between items-center p-3 bg-[#111] rounded-xl border border-[#222] cursor-pointer active:scale-95 transition-all w-full text-left">
                                    <div className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full bg-[#00FF41]/20 flex items-center justify-center">
                                            <Check size={12} className="text-[#00FF41]" strokeWidth={3} />
                                        </div>
                                        <span className="text-zinc-300 font-bold text-sm">Série {i + 1}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-zinc-500 font-mono text-xs">{actualWeights[i] || '--'}kg x {actualReps[i] || '--'}</span>
                                        {actualRpes?.[i] && <span className="bg-zinc-800 text-xs text-zinc-400 px-2 py-0.5 rounded px-1">RPE {actualRpes[i]}</span>}
                                    </div>
                                </div>
                                {i === currentSetIndex - 1 && (
                                    <div className="w-full bg-[#1A1A1A] rounded-b-xl border border-[#00FF41]/20 -mt-2 pt-3 pb-2 px-2 flex flex-col gap-1.5 animate-in slide-in-from-top-1">
                                        <span className="text-[9px] uppercase font-bold text-[#00FF41]/70 tracking-widest text-center">
                                            Como foi a Série {i + 1}?
                                        </span>
                                        <div className="flex w-full justify-between items-center">
                                            {rpeOptions.map((val) => {
                                                const numVal = parseFloat(val);
                                                const isHard = numVal >= 9;
                                                const isMedium = numVal >= 8 && numVal < 9;
                                                const isSelected = actualRpes?.[i] === val;
                                                return (
                                                    <button
                                                        key={val}
                                                        onClick={() => {
                                                            if (onRpeChange) onRpeChange(i, val);
                                                        }}
                                                        className={`flex-1 mx-0.5 h-8 rounded-md flex items-center justify-center text-[10px] font-black tracking-tighter active:scale-95 transition-all ${isSelected ? 'bg-[#00FF41] text-black shadow-[0_0_8px_rgba(0,255,65,0.3)] ring-1 ring-[#00FF41]' : isHard
                                                            ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20'
                                                            : isMedium
                                                                ? 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-black border border-yellow-500/20'
                                                                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white border border-zinc-700'
                                                            }`}
                                                    >
                                                        {val}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    } else if (isFuture) {
                        return (
                            <div key={i} onClick={() => setExpandedSet(i)} className="flex justify-between items-center p-3 bg-zinc-900/20 rounded-xl border border-zinc-900/50 mb-1 opacity-50 cursor-pointer active:scale-95 transition-all w-full text-left">
                                <span className="text-zinc-600 font-bold text-sm">Série {i + 1}</span>
                                <span className="text-zinc-600 font-mono text-xs">Meta: {targetText} reps</span>
                            </div>
                        );
                    }
                }

                return (
                    <div key={i} className="flex flex-col w-full relative mb-1">
                        {/* Se expandido mas não é o atual, adiciona uma indicação pra fechar */}
                        {!isCurrent && isExpanded && (
                            <div className="w-full flex justify-end mb-1">
                                <button onClick={() => setExpandedSet(null)} className="text-[10px] text-zinc-500 uppercase font-black tracking-widest bg-zinc-900 px-2 py-1 rounded">Fechar Edição</button>
                            </div>
                        )}
                        <div
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
                                onClick={() => {
                                    // Se for para completar, abre o slider ao invés de prosseguir seco
                                    if (!isCompleted && activeRpePromptIdx !== i) {
                                        setActiveRpePromptIdx(i);
                                    } else if (isCompleted) {
                                        // Se ja ta completa, deixa desselecionar (desmarca)
                                        onSetToggle(i);
                                    }
                                }}
                                title="Completar Série"
                                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isCompleted
                                    ? 'bg-[#00FF41] text-black shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                                    : isCurrent ? 'bg-zinc-800 border border-zinc-700 text-white' : 'bg-zinc-900 border border-zinc-800 text-zinc-500'
                                    }`}
                            >
                                <Check size={16} strokeWidth={3} />
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
                                <Trash2 size={14} />
                            </button>
                        </div>

                        {/* Extensão Inline: RPE (Dificuldade) */}
                        {activeRpePromptIdx === i && !isCompleted && (
                            <div className="w-full bg-[#1A1A1A] rounded-xl border border-[#00FF41]/20 mt-1.5 p-3 flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200">
                                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider text-center">
                                    Nível de Esforço (RPE)
                                </span>
                                <div className="flex w-full justify-between items-center px-1">
                                    {rpeOptions.map((val) => {
                                        const numVal = parseFloat(val);
                                        const isHard = numVal >= 9;
                                        const isMedium = numVal >= 8 && numVal < 9;
                                        return (
                                            <button
                                                key={val}
                                                onClick={() => {
                                                    if (onRpeChange) onRpeChange(i, val);
                                                    setActiveRpePromptIdx(null);
                                                    onSetToggle(i);
                                                    setExpandedSet(null); // Esconde a sanfona ao completar (se estava editando)
                                                }}
                                                className={`flex-1 mx-0.5 h-10 rounded-lg flex items-center justify-center text-[10px] font-black tracking-tighter active:scale-95 transition-all ${isHard
                                                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20'
                                                    : isMedium
                                                        ? 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-black border border-yellow-500/20'
                                                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white border border-zinc-700'
                                                    }`}
                                            >
                                                {val}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div >
    );
};

export default WorkoutTracker;
