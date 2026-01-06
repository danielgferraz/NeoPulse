import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useNavigate } from 'react-router-dom';
import UpdateChecker from '../components/UpdateChecker';
import { useTheme } from '../contexts/ThemeContext';

const HomeView: React.FC = () => {
    const trainings = useLiveQuery(() => db.trainings.orderBy('order').toArray());
    const history = useLiveQuery(() => db.history.where('timestamp').above(Date.now() - 30 * 24 * 60 * 60 * 1000).toArray());
    const navigate = useNavigate();
    const { theme } = useTheme();

    const addTraining = async () => {
        const name = prompt("Nome do Treino (ex: Treino C - Pernas):");
        if (name) {
            await db.trainings.add({ name, order: (trainings?.length || 0) });
        }
    };

    const duplicateTraining = async (trainingId: number) => {
        const original = await db.trainings.get(trainingId);
        if (!original) return;

        const exercises = await db.exercises.where('trainingId').equals(trainingId).toArray();
        if (confirm(`Duplicar "${original.name}"?`)) {
            const newId = await db.trainings.add({
                name: `${original.name} (Cópia)`,
                order: (trainings?.length || 0)
            });

            const newExercises = exercises.map(ex => ({
                ...ex,
                id: undefined, // Let DB auto-increment
                trainingId: newId
            }));

            await db.exercises.bulkAdd(newExercises);
        }
    };

    const exportData = async () => {
        const data = {
            trainings: await db.trainings.toArray(),
            exercises: await db.exercises.toArray(),
            history: await db.history.toArray()
        };
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `neopulse_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
    };

    const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!confirm('ATENÇÃO: Isso substituirá todos os dados atuais por este backup. Continuar?')) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                await db.transaction('rw', db.trainings, db.exercises, db.history, async () => {
                    await db.trainings.clear();
                    await db.exercises.clear();
                    await db.history.clear();

                    if (data.trainings) await db.trainings.bulkAdd(data.trainings);
                    if (data.exercises) await db.exercises.bulkAdd(data.exercises);
                    if (data.history) await db.history.bulkAdd(data.history);
                });
                alert('Backup restaurado com sucesso!');
                window.location.reload();
            } catch (err) {
                alert('Erro ao restaurar arquivo: ' + err);
            }
        };
        reader.readAsText(file);
    };

    // Calendar Data (Last 14 days)
    const calendarDays = Array.from({ length: 14 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (13 - i));
        return d;
    });

    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    const hasTrainingOnDate = (date: Date) => {
        return history?.some(h => new Date(h.timestamp).toDateString() === date.toDateString());
    };

    const getTrainingsForDate = (date: Date) => {
        return history?.filter(h => new Date(h.timestamp).toDateString() === date.toDateString()) || [];
    };

    return (
        <div className="w-full max-w-md flex flex-col gap-4 pb-20 animate-in fade-in">
            {/* Calendar */}
            <div className="bg-zinc-900/50 p-4 rounded-3xl border border-zinc-800">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Frequência (14 dias)</span>
                    <span className="text-[10px] font-black text-white">{history?.length || 0} treinos mês</span>
                </div>
                <div className="flex justify-between">
                    {calendarDays.map((date, i) => {
                        const didTrain = hasTrainingOnDate(date);
                        const isToday = new Date().toDateString() === date.toDateString();
                        const isSelected = selectedDate === date.toDateString();
                        const trainingsOnDay = getTrainingsForDate(date);

                        return (
                            <div
                                key={i}
                                className="flex flex-col items-center gap-1 cursor-pointer active:scale-90 transition-transform"
                                onClick={() => setSelectedDate(isSelected ? null : date.toDateString())}
                            >
                                <div
                                    className={`w-3 h-3 rounded-full ${didTrain ? '' : 'bg-zinc-800'} ${isToday && !didTrain ? 'border border-white/20' : ''} ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''}`}
                                    style={{
                                        backgroundColor: didTrain ? theme.primary : undefined,
                                        boxShadow: didTrain ? `0 0 10px ${theme.primary}40` : 'none'
                                    }}
                                ></div>
                                <span className={`text-[8px] font-mono uppercase ${isSelected ? 'text-white font-bold' : 'text-zinc-600'}`}>{date.toLocaleDateString('pt-BR', { weekday: 'narrow' })}</span>
                            </div>
                        )
                    })}
                </div>

                {selectedDate && (
                    <div className="mt-4 pt-3 border-t border-zinc-800/50 animate-in slide-in-from-top-2 duration-300">
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                            {new Date(selectedDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                        </p>
                        {getTrainingsForDate(new Date(selectedDate)).length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {Array.from(new Set(getTrainingsForDate(new Date(selectedDate)).map(h => h.trainingName))).map((name, i) => (
                                    <span key={i} className="px-2 py-1 bg-zinc-800 rounded-lg text-xs font-bold text-white flex items-center gap-1">
                                        <i className="fa-solid fa-check-double text-[8px]" style={{ color: theme.primary }}></i>
                                        {name}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-zinc-600 italic">Nenhum treino registrado.</p>
                        )}
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center mb-4 px-2">
                <h2 className="text-xl font-black uppercase italic tracking-tighter" style={{ color: theme.primary }}>Meus Treinos</h2>
                <button
                    onClick={addTraining}
                    style={{ backgroundColor: theme.primary, boxShadow: `0 0 15px ${theme.primary}40` }}
                    className="text-black w-8 h-8 rounded-lg flex items-center justify-center font-bold"
                >
                    <i className="fa-solid fa-plus"></i>
                </button>
            </div>

            <UpdateChecker />

            <div className="grid grid-cols-1 gap-3">
                {trainings?.map((training) => (
                    <div key={training.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl flex justify-between items-center group active:scale-[0.98] transition-transform">
                        <div onClick={() => navigate(`/session/${training.id}`)} className="flex-1 cursor-pointer">
                            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-1 rounded-md font-bold tracking-widest uppercase">Folder</span>
                            <h3 className="text-xl font-black text-white mt-1 uppercase italic">{training.name}</h3>
                            <p className="text-xs text-zinc-500 mt-1 font-bold">Toque para iniciar</p>
                        </div>

                        <div className="flex flex-col gap-2 border-l border-zinc-800 pl-4 ml-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); navigate(`/training/${training.id}`); }}
                                className="w-10 h-10 rounded-xl bg-zinc-950 text-zinc-400 border border-zinc-800 flex items-center justify-center hover:text-white"
                                style={{ borderColor: `${theme.primary}20` }}
                            >
                                <i className="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); duplicateTraining(training.id!); }}
                                className="w-10 h-10 rounded-xl bg-zinc-950 text-zinc-600 border border-zinc-800 flex items-center justify-center hover:text-white hover:border-zinc-500"
                            >
                                <i className="fa-solid fa-copy"></i>
                            </button>
                        </div>
                    </div>
                ))}

                {trainings?.length === 0 && (
                    <div className="text-center p-10 opacity-50">
                        <i className="fa-solid fa-folder-open text-4xl mb-4"></i>
                        <p>Nenhum treino criado.</p>
                    </div>
                )}
            </div>

            {/* <SettingsButton moved to Header> */}
        </div>
    );
};

export default HomeView;
