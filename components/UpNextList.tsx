import React, { useState } from 'react';
import { useWorkoutPlayer } from '../contexts/WorkoutPlayerContext';
import { X, Check, ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react';
import { db, LibraryExercise } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';

interface UpNextListProps {
    onClose: () => void;
    onFinishWorkout?: () => void;
}

const UpNextList: React.FC<UpNextListProps> = ({ onClose, onFinishWorkout }) => {
    const player = useWorkoutPlayer();
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const libraryExercises = useLiveQuery(() =>
        searchQuery.length >= 2
            ? db.library.filter(ex => ex.name.toLowerCase().includes(searchQuery.toLowerCase())).limit(10).toArray()
            : Promise.resolve([])
        , [searchQuery]);

    const handleAddFromLibrary = (libEx: LibraryExercise) => {
        player.addExerciseToQueue({
            trainingId: player.trainingId || 0,
            name: libEx.name,
            restTimes: [60, 60, 60],
            targetReps: ["10", "10", "10"],
            order: player.queue.length
        });
        setIsSearching(false);
        setSearchQuery('');
    };

    return (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

            <div className="relative bg-[#111] border-t border-zinc-800 rounded-t-[32px] p-6 pb-12 shadow-[0_-20px_40px_rgba(0,0,0,0.8)] h-[85vh] flex flex-col animate-in slide-in-from-bottom-full duration-300">
                {/* Header */}
                <div className="w-full flex justify-between items-center mb-6 shrink-0">
                    <h2 className="text-2xl font-black italic tracking-tighter">
                        {isSearching ? 'ADICIONAR' : 'UP NEXT'}
                    </h2>
                    <button
                        title={isSearching ? "Fechar Busca" : "Fechar"}
                        onClick={() => isSearching ? setIsSearching(false) : onClose()}
                        className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 active:scale-90 transition-transform"
                    >
                        {isSearching ? <ChevronDown size={20} /> : <X size={20} />}
                    </button>
                </div>

                {isSearching ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <input
                            type="text"
                            autoFocus
                            placeholder="Buscar exercício..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-4 text-white placeholder-zinc-600 focus:border-[#00FF41] outline-none transition-all mb-4"
                        />
                        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                            {libraryExercises?.map(ex => (
                                <button
                                    key={ex.id}
                                    onClick={() => handleAddFromLibrary(ex)}
                                    className="w-full p-4 bg-zinc-900/40 border border-zinc-800/50 rounded-xl text-left hover:border-[#00FF41]/30 transition-all flex justify-between items-center group"
                                >
                                    <div>
                                        <p className="font-bold text-white group-hover:text-[#00FF41]">{ex.name}</p>
                                        <p className="text-[10px] text-zinc-600 uppercase font-black tracking-widest">{ex.muscleGroup}</p>
                                    </div>
                                    <Plus size={16} className="text-[#00FF41] opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                            {searchQuery.length >= 2 && libraryExercises?.length === 0 && (
                                <p className="text-center py-10 text-zinc-700 text-xs font-bold uppercase tracking-widest italic">Nenhum resultado encontrado.</p>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Lista de Exercicios */}
                        <div className="w-full flex-1 overflow-y-auto pr-2 scrollbar-hide space-y-3 font-medium">
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
                                        <div className="w-8 flex justify-center items-center shrink-0">
                                            {isCurrent ? (
                                                <div className="w-4 h-4 rounded-full bg-[#00FF41] animate-pulse" />
                                            ) : isPast ? (
                                                <Check size={16} className="text-green-500" strokeWidth={3} />
                                            ) : (
                                                <span className="text-zinc-600 font-bold">{idx + 1}</span>
                                            )}
                                        </div>

                                        <div className="flex-1 overflow-hidden">
                                            <h4 className={`font-bold truncate ${isCurrent ? 'text-[#00FF41]' : 'text-white'}`}>
                                                {ex.name}
                                            </h4>
                                            <span className="text-xs text-zinc-500 font-semibold uppercase">
                                                {ex.restTimes.length + 1} Séries
                                            </span>
                                        </div>

                                        {!isPast && (
                                            <div className="flex items-center gap-1 shrink-0">
                                                {idx > 0 && idx !== player.currentExerciseIndex && (
                                                    <button title="Subir" onClick={() => player.reorderQueue(idx, idx - 1)} className="w-8 h-8 flex items-center justify-center text-zinc-400">
                                                        <ChevronUp size={20} />
                                                    </button>
                                                )}
                                                {idx < player.queue.length - 1 && (
                                                    <button title="Descer" onClick={() => player.reorderQueue(idx, idx + 1)} className="w-8 h-8 flex items-center justify-center text-zinc-400">
                                                        <ChevronDown size={20} />
                                                    </button>
                                                )}
                                                {!isCurrent && (
                                                    <button title="Remover" onClick={() => player.removeFromQueue(idx)} className="w-8 h-8 flex items-center justify-center text-red-500/80">
                                                        <Trash2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="pt-4 shrink-0 flex flex-col gap-3">
                            <button
                                onClick={() => setIsSearching(true)}
                                className="w-full py-4 rounded-2xl border border-dashed border-zinc-700 text-zinc-400 font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                            >
                                <Plus size={20} />
                                Adicionar à Fila
                            </button>

                            {onFinishWorkout && (
                                <button
                                    onClick={onFinishWorkout}
                                    className="w-full py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 font-black uppercase tracking-[0.2em] italic flex items-center justify-center gap-2"
                                >
                                    Finalizar Sessão
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default UpNextList;
