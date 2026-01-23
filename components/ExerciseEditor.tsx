import React, { useState } from 'react';
import { Exercise } from '../services/db';

interface ExerciseEditorProps {
    exercise: Exercise;
    index?: number;
    totalExercises?: number;
    isEditing?: boolean;
    onUpdate: (updates: Partial<Exercise>) => void;
    onDelete?: () => void;
    onDuplicate?: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    showOrderControls?: boolean;
}

const ExerciseEditor: React.FC<ExerciseEditorProps> = ({
    exercise,
    index = 0,
    totalExercises = 0,
    isEditing = true,
    onUpdate,
    onDelete,
    onDuplicate,
    onMoveUp,
    onMoveDown,
    showOrderControls = true
}) => {
    const [calcState, setCalcState] = useState<{ type: '1rm' | 'plate' } | null>(null);
    const [weightVal, setWeightVal] = useState<number>(0);
    const [repsVal, setRepsVal] = useState<number>(0);

    const calculate1RM = (weight: number, reps: number) => {
        if (!weight || !reps) return 0;
        return Math.round(weight * (1 + reps / 30)); // Brzycki
    };

    const getPlates = (totalWeight: number) => {
        const barWeight = 20;
        let sideWeight = (totalWeight - barWeight) / 2;
        const plates = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
        const result: number[] = [];

        plates.forEach(p => {
            while (sideWeight >= p) {
                result.push(p);
                sideWeight -= p;
            }
        });
        return result;
    };

    return (
        <div className="bg-zinc-950/80 border border-zinc-900 p-5 rounded-[2rem] shadow-xl backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-500 hover:border-zinc-800/80 transition-all group/card">
            {/* Header Row: Order | Name | Actions */}
            <div className="flex gap-4 mb-4 items-start">
                <div className="flex flex-col gap-1 pt-1.5">
                    {showOrderControls && (
                        <>
                            <button
                                onClick={onMoveUp}
                                disabled={index === 0}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-zinc-600 hover:text-[#00FF41] hover:bg-zinc-900 transition-all ${index === 0 ? 'opacity-20 cursor-not-allowed' : ''}`}
                            >
                                <i className="fa-solid fa-chevron-up text-[10px]"></i>
                            </button>
                            <span className="flex items-center justify-center w-6 h-6 text-[10px] font-black text-zinc-700 select-none">
                                #{index + 1}
                            </span>
                            <button
                                onClick={onMoveDown}
                                disabled={index === totalExercises - 1}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-zinc-600 hover:text-[#00FF41] hover:bg-zinc-900 transition-all ${index === totalExercises - 1 ? 'opacity-20 cursor-not-allowed' : ''}`}
                            >
                                <i className="fa-solid fa-chevron-down text-[10px]"></i>
                            </button>
                        </>
                    )}
                    {!showOrderControls && (
                        <span className="flex items-center justify-center w-8 h-8 bg-zinc-900 rounded-xl font-black text-zinc-600 text-xs select-none">
                            #{index + 1}
                        </span>
                    )}
                </div>

                <div className="flex-1 flex flex-col gap-2">
                    {/* Name Input */}
                    <input
                        className="w-full bg-transparent border-none text-white text-lg font-black uppercase tracking-tight focus:outline-none placeholder:text-zinc-800 transition-colors"
                        value={exercise.name}
                        onChange={(e) => onUpdate({ name: e.target.value })}
                        placeholder="NOME DO EXERCÍCIO"
                    />

                    {/* Tools Toolbar */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCalcState(calcState?.type === '1rm' ? null : { type: '1rm' })}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5 ${calcState?.type === '1rm' ? 'bg-[#00FF41] text-black border-[#00FF41] shadow-[0_0_10px_rgba(0,255,65,0.2)]' : 'border-zinc-900 bg-zinc-900/50 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400'}`}>
                            <i className="fa-solid fa-calculator text-[8px]"></i> 1RM
                        </button>
                        <button
                            onClick={() => setCalcState(calcState?.type === 'plate' ? null : { type: 'plate' })}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5 ${calcState?.type === 'plate' ? 'bg-[#00FF41] text-black border-[#00FF41] shadow-[0_0_10px_rgba(0,255,65,0.2)]' : 'border-zinc-900 bg-zinc-900/50 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400'}`}>
                            <i className="fa-solid fa-weight-hanging text-[8px]"></i> Anilhas
                        </button>
                    </div>
                </div>

                {/* Top Actions */}
                <div className="flex gap-1">
                    {onDuplicate && (
                        <button
                            title="Duplicar"
                            onClick={onDuplicate}
                            className="w-8 h-8 rounded-xl hover:bg-zinc-900 text-zinc-600 hover:text-white transition-colors flex items-center justify-center"
                        >
                            <i className="fa-regular fa-copy text-sm"></i>
                        </button>
                    )}
                    {onDelete && (
                        <button
                            title="Excluir"
                            onClick={onDelete}
                            className="w-8 h-8 rounded-xl hover:bg-red-950/20 text-zinc-600 hover:text-red-500 transition-colors flex items-center justify-center"
                        >
                            <i className="fa-regular fa-trash-can text-sm"></i>
                        </button>
                    )}
                </div>
            </div>

            {/* Tool Content Pannel */}
            {calcState && (
                <div className="mb-6 mx-1 p-4 bg-zinc-900/80 rounded-2xl border border-zinc-800 animate-in slide-in-from-top-2 shadow-inner">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">
                            {calcState.type === '1rm' ? 'Calculadora 1RM' : 'Calculadora de Anilhas'}
                        </span>
                        <button onClick={() => setCalcState(null)} className="text-zinc-600 hover:text-white"><i className="fa-solid fa-times"></i></button>
                    </div>

                    {calcState.type === '1rm' ? (
                        <div className="flex flex-col gap-3">
                            <div className="flex gap-3">
                                <div className="flex-1 bg-black rounded-xl border border-zinc-800 px-3 py-2 focus-within:border-[#00FF41] transition-colors">
                                    <label className="text-[9px] text-zinc-600 font-bold uppercase block mb-0.5">Carga (kg)</label>
                                    <input type="number" className="w-full bg-transparent text-sm font-bold text-white outline-none" placeholder="0" onChange={e => setWeightVal(Number(e.target.value))} />
                                </div>
                                <div className="flex-1 bg-black rounded-xl border border-zinc-800 px-3 py-2 focus-within:border-[#00FF41] transition-colors">
                                    <label className="text-[9px] text-zinc-600 font-bold uppercase block mb-0.5">Reps</label>
                                    <input type="number" className="w-full bg-transparent text-sm font-bold text-white outline-none" placeholder="0" onChange={e => setRepsVal(Number(e.target.value))} />
                                </div>
                            </div>
                            <div className="flex items-center justify-between bg-zinc-950/50 rounded-lg p-3 border border-zinc-800/50">
                                <span className="text-[10px] text-zinc-500 font-medium">1RM Estimado</span>
                                <span className="text-[#00FF41] font-black text-lg">{calculate1RM(weightVal, repsVal)} <span className="text-xs text-zinc-500 ml-0.5">kg</span></span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <div className="bg-black rounded-xl border border-zinc-800 px-3 py-2 focus-within:border-[#00FF41] transition-colors">
                                <label className="text-[9px] text-zinc-600 font-bold uppercase block mb-0.5">Peso Total (com barra)</label>
                                <input type="number" className="w-full bg-transparent text-sm font-bold text-white outline-none" placeholder="0" onChange={e => setWeightVal(Number(e.target.value))} />
                            </div>
                            <div className="bg-zinc-950/50 rounded-xl p-3 border border-zinc-800/50 min-h-[3rem]">
                                <div className="flex flex-wrap gap-1.5">
                                    <span className="text-[10px] font-bold uppercase text-zinc-600 mr-2 self-center">Cada Lado:</span>
                                    {getPlates(weightVal).map((p, i) => (
                                        <span key={i} className="px-2 py-1 bg-zinc-800 rounded-md text-[10px] font-mono font-bold text-white border border-zinc-700 shadow-sm">{p}</span>
                                    ))}
                                    {getPlates(weightVal).length === 0 && weightVal > 20 && <span className="text-[10px] text-red-500 italic self-center">Peso inválido</span>}
                                    {weightVal <= 20 && weightVal > 0 && <span className="text-[10px] text-zinc-500 italic self-center">Apenas a barra</span>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Notes Input */}
            <div className="mb-5 relative group/notes">
                <div className="absolute left-3 top-2.5 text-zinc-700 transition-colors group-focus-within/notes:text-[#00FF41]">
                    <i className="fa-regular fa-comment-dots text-xs"></i>
                </div>
                <input
                    className="w-full bg-zinc-900/50 hover:bg-zinc-900 focus:bg-zinc-900 border border-transparent focus:border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-700 focus:outline-none transition-all"
                    placeholder="Adicionar notas ou observações..."
                    value={exercise.notes || ''}
                    onChange={(e) => onUpdate({ notes: e.target.value })}
                />
            </div>

            {/* Sets Section */}
            <div>
                <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Séries</span>
                    <div className="h-px bg-zinc-900 flex-1"></div>
                </div>

                <div className="flex flex-col gap-3">
                    {/* Sets List - Horizontal Scroll */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent -mx-1 px-1">
                        {exercise.restTimes.map((rest, rIdx) => (
                            <div key={rIdx} className="flex-shrink-0 w-28 bg-black rounded-2xl border border-zinc-900 overflow-hidden group/set focus-within:border-[#00FF41] focus-within:ring-1 focus-within:ring-[#00FF41]/20 transition-all relative">
                                {/* Set Number Label */}
                                <div className="absolute top-0 left-0 px-2 py-0.5 bg-zinc-900 rounded-br-lg text-[9px] font-black text-zinc-500">
                                    {rIdx + 1}
                                </div>

                                <div className="flex flex-col h-full pt-1">
                                    {/* Reps Input */}
                                    <div className="flex-1 flex flex-col justify-end items-center pb-1">
                                        <input
                                            title={`Reps Série ${rIdx + 1}`}
                                            className="w-full bg-transparent border-none text-white font-black text-lg text-center focus:outline-none placeholder:text-zinc-800 p-0"
                                            placeholder="-"
                                            value={exercise.setReps?.[rIdx] || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const newSetReps = [...(exercise.setReps || Array(exercise.restTimes.length).fill(''))];
                                                while (newSetReps.length < exercise.restTimes.length) newSetReps.push('');
                                                newSetReps[rIdx] = val;
                                                onUpdate({ setReps: newSetReps });
                                            }}
                                        />
                                        <span className="text-[8px] text-zinc-700 font-bold uppercase tracking-wider">Reps</span>
                                    </div>

                                    {/* Divider */}
                                    <div className="w-full h-px bg-zinc-900"></div>

                                    {/* Rest Input - Fixed Spacing */}
                                    <div className="h-7 bg-zinc-900/50 flex items-center justify-center gap-1">
                                        <i className="fa-solid fa-clock text-[8px] text-zinc-700"></i>
                                        <input
                                            type="number"
                                            className="bg-transparent border-none text-[#00FF41] font-mono font-bold text-[10px] w-8 text-center focus:outline-none p-0"
                                            value={rest}
                                            onClick={(e) => (e.target as HTMLInputElement).select()}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value) || 0;
                                                const newRests = [...exercise.restTimes];
                                                newRests[rIdx] = val;
                                                onUpdate({ restTimes: newRests });
                                            }}
                                        />
                                        <span className="text-[8px] text-zinc-600">s</span>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Remove Set Button (only if > 1) */}
                        {exercise.restTimes.length > 1 && (
                            <button
                                title="Remover última série"
                                onClick={() => onUpdate({
                                    restTimes: exercise.restTimes.slice(0, -1),
                                    setReps: exercise.setReps?.slice(0, -1)
                                })}
                                className="flex-shrink-0 w-8 h-[inherit] rounded-xl hover:bg-red-950/20 text-zinc-800 hover:text-red-500 transition-colors flex items-center justify-center border border-transparent border-dashed hover:border-red-900/50"
                            >
                                <i className="fa-solid fa-minus text-xs"></i>
                            </button>
                        )}
                    </div>

                    {/* Quick Set Actions - Compact Again */}
                    <div className="flex gap-2 items-center flex-wrap">
                        <button
                            title="Clonar última série"
                            onClick={() => {
                                const lastTime = exercise.restTimes[exercise.restTimes.length - 1] || 60;
                                const lastRep = exercise.setReps?.[exercise.restTimes.length - 1] || '';
                                const newSetReps = [...(exercise.setReps || Array(exercise.restTimes.length).fill('')), lastRep];
                                onUpdate({
                                    restTimes: [...exercise.restTimes, lastTime],
                                    setReps: newSetReps
                                });
                            }}
                            className="px-3 py-2 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/30 text-zinc-500 text-[10px] uppercase font-bold hover:bg-zinc-800 hover:text-[#00FF41] hover:border-[#00FF41]/50 transition-all flex items-center gap-2 group/clone"
                        >
                            <i className="fa-solid fa-plus text-[10px]"></i>
                            <span>Clonar <span className="text-zinc-600 ml-1 group-hover/clone:text-zinc-500">({exercise.restTimes[exercise.restTimes.length - 1] || 60}s)</span></span>
                        </button>

                        <div className="h-4 w-px bg-zinc-800 mx-1"></div>

                        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                            {[30, 45, 60, 90, 120].map(time => (
                                <button
                                    key={time}
                                    onClick={() => onUpdate({
                                        restTimes: [...exercise.restTimes, time],
                                        setReps: [...(exercise.setReps || Array(exercise.restTimes.length).fill('')), (exercise.setReps?.[exercise.restTimes.length - 1] || '')]
                                    })}
                                    className="px-2.5 py-1.5 rounded-lg bg-zinc-900 text-zinc-500 text-[10px] font-mono hover:bg-[#00FF41] hover:text-black transition-colors border border-transparent hover:border-[#00FF41]"
                                >
                                    {time}s
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExerciseEditor;
