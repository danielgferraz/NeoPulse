import React, { useState } from 'react';
import { useWorkoutPlayer } from '../contexts/WorkoutPlayerContext';
import { X, Check, ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';

interface UpNextListProps {
    onClose: () => void;
}

const UpNextList: React.FC<UpNextListProps> = ({ onClose }) => {
    const player = useWorkoutPlayer();

    // Mostramos apenas os exercícios a partir de agora ou todos?
    // Vamos mostrar todos, destacando o atual.

    return (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative bg-[#111] border-t border-zinc-800 rounded-t-[32px] p-6 pb-12 shadow-[0_-20px_40px_rgba(0,0,0,0.8)] h-[85vh] flex flex-col animate-in slide-in-from-bottom-full duration-300">
                {/* Header */}
                <div className="w-full flex justify-between items-center mb-6 shrink-0">
                    <h2 className="text-2xl font-black italic tracking-tighter">
                        UP NEXT
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 active:scale-90 transition-transform"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Lista de Exercicios */}
                <div className="w-full flex-1 overflow-y-auto pr-2 scrollbar-hide space-y-3">
                    {player.queue.map((ex, idx) => {
                        const isCurrent = idx === player.currentExerciseIndex;
                        const isPast = idx < player.currentExerciseIndex;

                        return (
                            <div
                                key={`${ex.id}-${idx}`}
                                className={`w-full p-4 rounded-2xl border flex items-center gap-4 transition-all ${isCurrent
                                    ? 'bg-[#00FF41]/10 border-[#00FF41]/30'
                                    : isPast
                                        ? 'bg-zinc-900/50 border-zinc-800/50 opacity-50'
                                        : 'bg-zinc-900 border-zinc-800'
                                    }`}
                            >
                                {/* Destaque Status */}
                                <div className="w-8 flex justify-center items-center shrink-0">
                                    {isCurrent ? (
                                        <div className="w-4 h-4 rounded-full bg-[#00FF41] animate-pulse" />
                                    ) : isPast ? (
                                        <Check size={16} className="text-green-500" strokeWidth={3} />
                                    ) : (
                                        <span className="text-zinc-600 font-bold">{idx + 1}</span>
                                    )}
                                </div>

                                {/* Nomes */}
                                <div className="flex-1 overflow-hidden">
                                    <h4 className={`font-bold truncate ${isCurrent ? 'text-[#00FF41]' : 'text-white'}`}>
                                        {ex.name}
                                    </h4>
                                    <span className="text-xs text-zinc-500 font-semibold uppercase">
                                        {ex.restTimes.length} Séries
                                    </span>
                                </div>

                                {/* Controles (Só mostra se não for passado e se não for o ultimo / unico) */}
                                {!isPast && (
                                    <div className="flex items-center gap-1 shrink-0">
                                        {idx > 0 && idx !== player.currentExerciseIndex && (
                                            <button
                                                onClick={() => player.reorderQueue(idx, idx - 1)}
                                                className="w-8 h-8 flex items-center justify-center text-zinc-400 active:text-white"
                                            >
                                                <ChevronUp size={20} />
                                            </button>
                                        )}
                                        {idx < player.queue.length - 1 && (
                                            <button
                                                onClick={() => player.reorderQueue(idx, idx + 1)}
                                                className="w-8 h-8 flex items-center justify-center text-zinc-400 active:text-white"
                                            >
                                                <ChevronDown size={20} />
                                            </button>
                                        )}
                                        {/* So exclui se nao for o atual, pra simplificar a regra por enquanto */}
                                        {!isCurrent && (
                                            <button
                                                onClick={() => player.removeFromQueue(idx)}
                                                className="w-8 h-8 flex items-center justify-center text-red-500/80 active:text-red-500 ml-1"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Acao Futura Add to Queue */}
                <div className="pt-4 shrink-0">
                    <button className="w-full py-4 rounded-2xl border border-dashed border-zinc-700 text-zinc-400 font-bold uppercase tracking-wider flex items-center justify-center gap-2 active:bg-zinc-800 transition-colors">
                        <Plus size={20} />
                        Adicionar à Fila
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpNextList;
