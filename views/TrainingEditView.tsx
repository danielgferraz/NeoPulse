import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import ExerciseEditor from '../components/ExerciseEditor';

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
            restTimes: [60],
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

    const duplicateExercise = async (ex: any) => {
        await db.exercises.add({
            ...ex,
            id: undefined,
            order: (exercises?.length || 0),
            name: `${ex.name} (Cópia)`
        });
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
                <button title="Voltar" onClick={() => navigate('/')} className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                    <i className="fa-solid fa-arrow-left"></i>
                </button>
                <div className="text-right flex-1 ml-4">
                    <span className="text-[10px] text-[#00FF41] uppercase font-black tracking-widest">Editando Pasta</span>
                    <input
                        className="w-full bg-transparent border-none text-xl font-black italic uppercase text-white text-right focus:outline-none placeholder:text-zinc-700"
                        value={training.name}
                        onChange={(e) => db.trainings.update(trainingId, { name: e.target.value })}
                        placeholder="NOME DA PASTA"
                    />
                </div>
            </div>

            <div className="space-y-4">
                {exercises?.map((ex, idx) => (
                    <ExerciseEditor
                        key={ex.id}
                        exercise={ex}
                        index={idx}
                        totalExercises={exercises.length}
                        onUpdate={(changes) => updateExercise(ex.id!, changes)}
                        onDelete={() => deleteExercise(ex.id!)}
                        onDuplicate={() => duplicateExercise(ex)}
                        onMoveUp={() => {
                            if (idx > 0) {
                                const newOrder = [...exercises];
                                const temp = newOrder[idx].order;
                                newOrder[idx].order = newOrder[idx - 1].order;
                                newOrder[idx - 1].order = temp;
                                Promise.all([
                                    db.exercises.update(newOrder[idx].id!, { order: newOrder[idx].order }),
                                    db.exercises.update(newOrder[idx - 1].id!, { order: newOrder[idx - 1].order })
                                ]);
                            }
                        }}
                        onMoveDown={() => {
                            if (idx < exercises.length - 1) {
                                const newOrder = [...exercises];
                                const temp = newOrder[idx].order;
                                newOrder[idx].order = newOrder[idx + 1].order;
                                newOrder[idx + 1].order = temp;
                                Promise.all([
                                    db.exercises.update(newOrder[idx].id!, { order: newOrder[idx].order }),
                                    db.exercises.update(newOrder[idx + 1].id!, { order: newOrder[idx + 1].order })
                                ]);
                            }
                        }}
                    />
                ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={() => navigate(`/library?mode=select&trainingId=${trainingId}`)}
                    className="w-full py-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold uppercase tracking-wide hover:bg-zinc-800 hover:text-white hover:border-[#00FF41] transition-all flex flex-col items-center gap-2"
                >
                    <i className="fa-solid fa-book-open text-[#00FF41] text-xl"></i>
                    <span className="text-[10px]">Da Biblioteca</span>
                </button>
                <button
                    onClick={addExercise}
                    className="w-full py-4 rounded-2xl border border-dashed border-zinc-700 text-zinc-500 font-bold uppercase tracking-wide hover:bg-zinc-900 hover:text-white transition-all flex flex-col items-center gap-2"
                >
                    <i className="fa-solid fa-plus text-zinc-500 text-xl"></i>
                    <span className="text-[10px]">Manual</span>
                </button>
            </div>

            <div className="mt-10 border-t border-zinc-900 pt-6">
                <button onClick={deleteTraining} className="w-full py-3 rounded-xl bg-red-950/20 text-red-800 text-xs font-black uppercase tracking-widest hover:bg-red-900 hover:text-white transition-all">
                    Deletar Pasta "{training.name}"
                </button>
            </div>
        </div>
    );
};

export default TrainingEditView;
