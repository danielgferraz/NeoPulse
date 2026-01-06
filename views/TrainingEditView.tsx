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

    const [calcState, setCalcState] = React.useState<{ id: number, type: '1rm' | 'plate' } | null>(null);
    const [weightVal, setWeightVal] = React.useState<number>(0);
    const [repsVal, setRepsVal] = React.useState<number>(0);

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
                    <div key={ex.id} className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-3xl animate-in fade-in transition-all hover:border-zinc-700">
                        <div className="flex gap-3 mb-3 items-center">
                            <div className="flex flex-col gap-1 mr-1">
                                <button
                                    title="Mover para cima"
                                    onClick={() => {
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
                                    className={`text-zinc-600 hover:text-[#00FF41] ${idx === 0 ? 'opacity-20 cursor-not-allowed' : ''}`}
                                >
                                    <i className="fa-solid fa-chevron-up text-xs"></i>
                                </button>
                                <button
                                    title="Mover para baixo"
                                    onClick={() => {
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
                                    className={`text-zinc-600 hover:text-[#00FF41] ${idx === exercises.length - 1 ? 'opacity-20 cursor-not-allowed' : ''}`}
                                >
                                    <i className="fa-solid fa-chevron-down text-xs"></i>
                                </button>
                            </div>

                            <span className="flex items-center justify-center w-8 h-8 bg-zinc-950 rounded-lg font-black text-zinc-600 text-xs">
                                #{idx + 1}
                            </span>
                            <input
                                className="flex-1 bg-transparent border-none text-white font-bold uppercase focus:outline-none placeholder:text-zinc-700"
                                value={ex.name}
                                onChange={(e) => updateExercise(ex.id!, { name: e.target.value })}
                                placeholder="NOME DO EXERCÍCIO"
                            />
                            <button title="Excluir" onClick={() => deleteExercise(ex.id!)} className="w-8 h-8 rounded-lg hover:bg-red-950/30 text-zinc-700 hover:text-red-500 transition-colors">
                                <i className="fa-solid fa-trash"></i>
                            </button>
                            <button title="Duplicar Exercício" onClick={() => duplicateExercise(ex)} className="w-8 h-8 rounded-lg hover:bg-zinc-800 text-zinc-700 hover:text-white transition-colors">
                                <i className="fa-solid fa-copy"></i>
                            </button>
                        </div>

                        {/* Tools Section */}
                        <div className="flex gap-2 pl-8 mb-3 overflow-x-auto pb-1 scrollbar-hide">
                            <button
                                onClick={() => setCalcState(calcState?.id === ex.id && calcState.type === '1rm' ? null : { id: ex.id!, type: '1rm' })}
                                className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${calcState?.id === ex.id && calcState.type === '1rm' ? 'bg-[#00FF41] text-black border-[#00FF41]' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>
                                <i className="fa-solid fa-calculator mr-1"></i> Calc 1RM
                            </button>
                            <button
                                onClick={() => setCalcState(calcState?.id === ex.id && calcState.type === 'plate' ? null : { id: ex.id!, type: 'plate' })}
                                className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${calcState?.id === ex.id && calcState.type === 'plate' ? 'bg-[#00FF41] text-black border-[#00FF41]' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>
                                <i className="fa-solid fa-weight-hanging mr-1"></i> Anilhas
                            </button>
                        </div>

                        {/* Tool Display */}
                        {calcState?.id === ex.id && (
                            <div className="mx-8 mb-4 p-3 bg-black/40 rounded-2xl border border-zinc-800 animate-in slide-in-from-top-1">
                                {calcState.type === '1rm' ? (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex gap-2">
                                            <input type="number" placeholder="Peso" className="w-full bg-zinc-900 rounded-lg px-2 py-1 text-xs outline-none" onChange={e => setWeightVal(Number(e.target.value))} />
                                            <input type="number" placeholder="Reps" className="w-full bg-zinc-900 rounded-lg px-2 py-1 text-xs outline-none" onChange={e => setRepsVal(Number(e.target.value))} />
                                        </div>
                                        <p className="text-[10px] font-black uppercase text-zinc-500">Estimativa 1RM: <span className="text-[#00FF41] text-sm">{calculate1RM(weightVal, repsVal)} kg</span></p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        <input type="number" placeholder="Peso Total (incl. barra)" className="w-full bg-zinc-900 rounded-lg px-2 py-1 text-xs outline-none" onChange={e => setWeightVal(Number(e.target.value))} />
                                        <div className="flex flex-wrap gap-1">
                                            <span className="text-[9px] font-black uppercase text-zinc-600 mr-1 mt-1">Lado:</span>
                                            {getPlates(weightVal).map((p, i) => (
                                                <span key={i} className="px-1.5 py-0.5 bg-zinc-800 rounded text-[9px] font-mono text-white">{p}</span>
                                            ))}
                                            {weightVal > 20 && getPlates(weightVal).length === 0 && <span className="text-[9px] text-zinc-700">Peso inválido</span>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Reps & Notes */}
                        <div className="flex gap-3 mb-3 pl-8">
                            <div className="w-24">
                                <label className="text-[9px] text-zinc-600 font-bold uppercase ml-1 block mb-1">Repetições</label>
                                <input
                                    className="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-700 focus:border-[#00FF41] focus:outline-none transition-colors"
                                    placeholder="Ex: 8-12"
                                    value={ex.reps || ''}
                                    onChange={(e) => updateExercise(ex.id!, { reps: e.target.value })}
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-[9px] text-zinc-600 font-bold uppercase ml-1 block mb-1">Notas</label>
                                <input
                                    className="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 placeholder:text-zinc-700 focus:border-[#00FF41] focus:outline-none transition-colors"
                                    placeholder="Ex: Banco inclinado 30°..."
                                    value={ex.notes || ''}
                                    onChange={(e) => updateExercise(ex.id!, { notes: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 pl-8">
                            {/* Sets List */}
                            <div className="flex gap-2 flex-wrap">
                                {ex.restTimes.map((rest, rIdx) => (
                                    <div key={rIdx} className="bg-black pr-2 pl-3 py-1 rounded-lg border border-zinc-900 flex items-center gap-2 group-focus-within:border-[#00FF41] transition-colors">
                                        <span className="text-[10px] text-zinc-500 font-bold select-none">S{rIdx + 1}</span>
                                        <input
                                            title="Tempo de Descanso"
                                            type="number"
                                            className="bg-transparent border-none text-[#00FF41] font-mono text-sm w-10 text-center focus:outline-none"
                                            value={rest}
                                            onClick={(e) => (e.target as HTMLInputElement).select()}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value) || 0;
                                                const newRests = [...ex.restTimes];
                                                newRests[rIdx] = val;
                                                updateExercise(ex.id!, { restTimes: newRests });
                                            }}
                                        />
                                        <span className="text-[10px] text-zinc-600 font-bold select-none">s</span>
                                    </div>
                                ))}
                                {ex.restTimes.length > 1 && (
                                    <button
                                        title="Remover série"
                                        onClick={() => updateExercise(ex.id!, { restTimes: ex.restTimes.slice(0, -1) })}
                                        className="w-8 h-8 rounded-lg border border-transparent hover:bg-red-950/20 text-red-900/50 hover:text-red-500 text-xs flex items-center justify-center transition-colors"
                                    >
                                        <i className="fa-solid fa-minus"></i>
                                    </button>
                                )}
                            </div>

                            {/* Quick Add Buttons */}
                            <div className="flex gap-2 mt-1 flex-wrap">
                                <button
                                    title="Clonar última série"
                                    onClick={() => {
                                        const lastTime = ex.restTimes[ex.restTimes.length - 1] || 60;
                                        updateExercise(ex.id!, { restTimes: [...ex.restTimes, lastTime] });
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-dashed border-zinc-800 text-zinc-500 text-[10px] uppercase font-bold hover:bg-zinc-800 hover:text-white hover:border-zinc-600 transition-all flex items-center gap-2"
                                >
                                    <i className="fa-solid fa-plus"></i> <span className="hidden sm:inline">Clonar</span> ({ex.restTimes[ex.restTimes.length - 1] || 60}s)
                                </button>
                                <div className="w-px h-6 bg-zinc-900 mx-1"></div>
                                {[30, 45, 60, 90, 120].map(time => (
                                    <button
                                        key={time}
                                        onClick={() => updateExercise(ex.id!, { restTimes: [...ex.restTimes, time] })}
                                        className="px-2 py-1 rounded-md bg-zinc-900/50 text-zinc-600 text-[10px] font-mono hover:bg-[#00FF41] hover:text-black transition-colors"
                                    >
                                        {time}s
                                    </button>
                                ))}
                            </div>
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
