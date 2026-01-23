import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Exercise, LibraryExercise } from '../services/db';
import ExerciseEditor from './ExerciseEditor';

interface ExerciseSelectorProps {
    onSelect: (exercise: Exercise) => void;
    onCancel: () => void;
    initialOrder: number;
    trainingId: number;
}

type Tab = 'library' | 'manual';

const ExerciseSelector: React.FC<ExerciseSelectorProps> = ({ onSelect, onCancel, initialOrder, trainingId }) => {
    const [activeTab, setActiveTab] = useState<Tab>('library');
    const [searchTerm, setSearchTerm] = useState('');

    // State for the exercise being built/edited
    const [draftExercise, setDraftExercise] = useState<Partial<Exercise>>({
        name: '',
        restTimes: [60, 60, 60],
        setReps: ['', '', ''],
        notes: '',
        trainingId,
        order: initialOrder
    });

    const libraryExercises = useLiveQuery(() => db.library.toArray());

    const filteredLibrary = useMemo(() => {
        if (!libraryExercises) return [];
        if (!searchTerm) return libraryExercises;
        const lower = searchTerm.toLowerCase();
        return libraryExercises.filter(ex => ex.name.toLowerCase().includes(lower) || ex.muscleGroup.toLowerCase().includes(lower));
    }, [libraryExercises, searchTerm]);

    const handleLibrarySelect = (libEx: LibraryExercise) => {
        setDraftExercise({
            ...draftExercise,
            name: libEx.name.toUpperCase(),
            restTimes: [libEx.defaultRestTime, libEx.defaultRestTime, libEx.defaultRestTime],
            setReps: ['', '', ''],
            notes: libEx.muscleGroup
        });
        setActiveTab('manual');
    };

    const handleConfirm = () => {
        if (!draftExercise.name) return;

        onSelect({
            name: draftExercise.name,
            restTimes: draftExercise.restTimes || [60, 60, 60],
            setReps: draftExercise.setReps,
            notes: draftExercise.notes,
            order: initialOrder,
            trainingId: trainingId
        } as Exercise);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Tabs */}
            <div className="flex mb-4 bg-zinc-900 rounded-xl p-1 border border-zinc-800">
                <button
                    onClick={() => setActiveTab('library')}
                    className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'library' ? 'bg-[#00FF41] text-black shadow-lg shadow-[#00FF41]/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <i className="fa-solid fa-book mr-2"></i> Biblioteca
                </button>
                <button
                    onClick={() => setActiveTab('manual')}
                    className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'manual' ? 'bg-[#00FF41] text-black shadow-lg shadow-[#00FF41]/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <i className="fa-solid fa-pen-to-square mr-2"></i> Manual
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'library' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                        {/* Search */}
                        <div className="relative">
                            <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"></i>
                            <input
                                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:border-[#00FF41] outline-none transition-colors placeholder:text-zinc-700"
                                placeholder="Buscar exercício (Ex: Supino)"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>

                        {/* List */}
                        <div className="space-y-2">
                            {filteredLibrary?.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => handleLibrarySelect(item)}
                                    className="w-full flex items-center justify-between p-4 bg-zinc-900/30 border border-zinc-800/50 rounded-xl hover:bg-zinc-800 hover:border-zinc-700 transition-all group text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-600 group-hover:text-[#00FF41] transition-colors">
                                            {/* Using a font-awesome fallback since we don't have dynamic Lucide rendering setup yet */}
                                            <i className="fa-solid fa-dumbbell"></i>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-white group-hover:text-[#00FF41] transition-colors">{item.name}</h4>
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mt-0.5">{item.muscleGroup}</span>
                                        </div>
                                    </div>
                                    <i className="fa-solid fa-chevron-right text-zinc-700 group-hover:text-zinc-500"></i>
                                </button>
                            ))}

                            {filteredLibrary?.length === 0 && (
                                <div className="text-center py-10">
                                    <p className="text-zinc-600 text-sm mb-2">Nenhum exercício encontrado.</p>
                                    <button
                                        onClick={() => setActiveTab('manual')}
                                        className="text-[#00FF41] text-xs font-bold uppercase tracking-widest hover:underline"
                                    >
                                        Criar Manualmente
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'manual' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <ExerciseEditor
                            exercise={draftExercise as Exercise}
                            onUpdate={(updates) => setDraftExercise(prev => ({ ...prev, ...updates }))}
                            showOrderControls={false}
                        />

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={onCancel}
                                className="flex-1 py-4 rounded-xl font-bold uppercase tracking-widest text-xs text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={!draftExercise.name}
                                className="flex-[2] py-4 rounded-xl font-black uppercase tracking-widest text-xs bg-[#00FF41] text-black disabled:opacity-50 disabled:grayscale transition-all active:scale-95"
                            >
                                Adicionar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExerciseSelector;
