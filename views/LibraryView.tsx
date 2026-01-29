import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { DynamicIcon } from '../components/DynamicIcon';
import { useNavigate } from 'react-router-dom';

const LibraryView: React.FC = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');

    // Get query params for selection mode
    const searchParams = new URLSearchParams(window.location.search);
    const selectMode = searchParams.get('mode') === 'select';
    const targetTrainingId = parseInt(searchParams.get('trainingId') || '0');

    const exercises = useLiveQuery(
        () => db.library.orderBy('name').toArray()
    );

    // Need to get current max order to append correctly if in select mode
    const currentTrainingExercises = useLiveQuery(
        () => selectMode ? db.exercises.where('trainingId').equals(targetTrainingId).toArray() : Promise.resolve([])
        , [selectMode, targetTrainingId]);

    const handleSelect = async (ex: any) => {
        if (!selectMode || !targetTrainingId) return;

        // Add to training
        await db.exercises.add({
            trainingId: targetTrainingId,
            name: ex.name,
            restTimes: ex.defaultRestTime ? [ex.defaultRestTime, ex.defaultRestTime, ex.defaultRestTime] : [60, 60, 60],
            order: currentTrainingExercises?.length || 0,
            setReps: ['12', '12', '12'] // Default 3 sets
        });

        navigate(-1);
    };

    const filteredExercises = exercises?.filter(ex =>
        ex.name.toLowerCase().includes(search.toLowerCase()) ||
        ex.muscleGroup.toLowerCase().includes(search.toLowerCase())
    );

    // Group by muscle
    const groups = filteredExercises?.reduce((acc, ex) => {
        if (!acc[ex.muscleGroup]) acc[ex.muscleGroup] = [];
        acc[ex.muscleGroup].push(ex);
        return acc;
    }, {} as Record<string, typeof filteredExercises>);

    return (
        <div className="w-full max-w-md flex flex-col gap-6 animate-fade-in pb-20">
            {/* Header / Search */}
            <div className="flex gap-4 items-center">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center active:scale-95 transition-transform"
                >
                    <i className="fa-solid fa-arrow-left text-zinc-400"></i>
                </button>
                <div className="flex-1 relative">
                    <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-sm"></i>
                    <input
                        type="text"
                        placeholder="Buscar exercício..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-[#00FF41] placeholder-zinc-600 transition-colors"
                    />
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <h2 className="text-xl font-bold text-white px-1">
                    {selectMode ? 'Adicionar Exercício' : 'Biblioteca'}
                </h2>
                <p className="text-xs text-zinc-500 px-1">
                    {selectMode ? 'Toque para adicionar ao treino' : 'Exercícios padrão para seus treinos'}
                </p>
            </div>

            {!groups || Object.keys(groups).length === 0 ? (
                <div className="text-center py-10 text-zinc-600 italic">
                    Nenhum exercício encontrado.
                </div>
            ) : (
                Object.entries(groups).map(([muscle, list]) => (
                    <div key={muscle} className="flex flex-col gap-3">
                        <h3 className="text-[#00FF41] text-xs font-bold uppercase tracking-wider px-2 border-l-2 border-[#00FF41] ml-1">
                            {muscle}
                        </h3>
                        <div className="flex flex-col gap-2">
                            {list?.map(ex => (
                                <button
                                    key={ex.id}
                                    onClick={() => selectMode ? handleSelect(ex) : null}
                                    className={`bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 flex items-center justify-between group hover:border-zinc-700 transition-colors w-full text-left ${selectMode ? 'active:scale-[0.98] active:bg-zinc-800 cursor-pointer' : ''}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300">
                                            {ex.icon ? (
                                                <DynamicIcon name={ex.icon} size={20} />
                                            ) : (
                                                <i className="fa-solid fa-dumbbell"></i>
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-sm text-zinc-200">{ex.name}</h4>
                                            <div className="flex gap-2 text-[10px] text-zinc-500 mt-0.5">
                                                <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">{ex.defaultRestTime}s descanso</span>
                                            </div>
                                        </div>
                                    </div>

                                    {!selectMode && ex.videoUrl && (
                                        <a
                                            href={ex.videoUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-[#FF0000] hover:bg-white active:scale-95 transition-all"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <i className="fa-brands fa-youtube"></i>
                                        </a>
                                    )}

                                    {selectMode && (
                                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[#00FF41]">
                                            <i className="fa-solid fa-plus"></i>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default LibraryView;
