import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/db';

const TrainingEditView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const trainingId = parseInt(id || '0');
    const navigate = useNavigate();

    const training = useLiveQuery(() => db.trainings.get(trainingId), [trainingId]);
    const exercises = useLiveQuery(() =>
        db.exercises.where('trainingId').equals(trainingId).sortBy('order')
        , [trainingId]);

    const addExercise = async () => {
        await db.exercises.add({
            trainingId,
            name: 'Novo Exercício',
            restTimes: [60, 60, 60],
            order: exercises?.length || 0
        });
    };

    const updateExercise = async (exId: number, changes: any) => {
        await db.exercises.update(exId, changes);
    };

    const deleteExercise = async (exId: number) => {
        if (confirm('Deletar exercício?')) {
            await db.exercises.delete(exId);
        }
    };

    const deleteTraining = async () => {
        if (confirm('Deletar PASTA de treino inteira?')) {
            await db.exercises.where('trainingId').equals(trainingId).delete();
            await db.trainings.delete(trainingId);
            navigate('/');
        }
    };

    if (!training) return <div className="p-10 text-center">Carregando pasta...</div>;

    return (
        <div className="w-full max-w-md flex flex-col gap-4 pb-20 animate-in fade-in slide-in-from-right">
            <div className="flex justify-between items-center mb-6 pt-2">
                <button onClick={() => navigate('/')} className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                    <i className="fa-solid fa-arrow-left"></i>
                </button>
                <div className="text-right">
                    <span className="text-[10px] text-[#00FF41] uppercase font-black tracking-widest">Editando</span>
                    <h1 className="text-xl font-black italic uppercase text-white">{training.name}</h1>
                </div>
            </div>

            <div className="space-y-4">
                {exercises?.map((ex, idx) => (
                    <div key={ex.id} className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-3xl">
                        <div className="flex gap-3 mb-3">
                            <span className="flex items-center justify-center w-8 h-8 bg-zinc-950 rounded-lg font-black text-zinc-600 text-xs">
                                #{idx + 1}
                            </span>
                            <input
                                className="flex-1 bg-transparent border-none text-white font-bold uppercase focus:outline-none"
                                value={ex.name}
                                onChange={(e) => updateExercise(ex.id!, { name: e.target.value })}
                                placeholder="Nome do Exercício"
                            />
                            <button onClick={() => deleteExercise(ex.id!)} className="text-red-900 hover:text-red-500">
                                <i className="fa-solid fa-trash"></i>
                            </button>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            {ex.restTimes.map((rest, rIdx) => (
                                <div key={rIdx} className="bg-black px-3 py-1 rounded-lg border border-zinc-900 flex items-center gap-2">
                                    <span className="text-[10px] text-zinc-500 font-bold">S{rIdx + 1}</span>
                                    <span className="text-xs font-mono text-[#00FF41]">{rest}s</span>
                                    <div className="flex flex-col gap-1 ml-1">
                                        <i onClick={() => {
                                            const newRests = [...ex.restTimes];
                                            newRests[rIdx] += 5;
                                            updateExercise(ex.id!, { restTimes: newRests });
                                        }} className="fa-solid fa-caret-up text-[10px] cursor-pointer active:text-white"></i>
                                        <i onClick={() => {
                                            const newRests = [...ex.restTimes];
                                            newRests[rIdx] = Math.max(5, newRests[rIdx] - 5);
                                            updateExercise(ex.id!, { restTimes: newRests });
                                        }} className="fa-solid fa-caret-down text-[10px] cursor-pointer active:text-white"></i>
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={() => updateExercise(ex.id!, { restTimes: [...ex.restTimes, 60] })}
                                className="px-3 py-1 rounded-lg border border-dashed border-zinc-700 text-zinc-600 text-xs hover:text-white hover:border-zinc-500"
                            >
                                + Série
                            </button>
                            {ex.restTimes.length > 1 && (
                                <button
                                    onClick={() => updateExercise(ex.id!, { restTimes: ex.restTimes.slice(0, -1) })}
                                    className="px-2 text-red-900 text-xs hover:text-red-500"
                                >
                                    -
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <button onClick={addExercise} className="w-full py-4 rounded-2xl border border-dashed border-zinc-700 text-zinc-500 font-black uppercase tracking-widest hover:bg-zinc-900 hover:text-white transition-all">
                + Adicionar Exercício
            </button>

            <div className="mt-10 border-t border-zinc-900 pt-6">
                <button onClick={deleteTraining} className="w-full py-3 rounded-xl bg-red-950/20 text-red-800 text-xs font-black uppercase tracking-widest hover:bg-red-900 hover:text-white transition-all">
                    Deletar Pasta "{training.name}"
                </button>
            </div>
        </div>
    );
};

export default TrainingEditView;
