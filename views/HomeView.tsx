import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { WidgetService } from '../services/widgetService';
import { Preferences } from '@capacitor/preferences';

const HomeView: React.FC = () => {
    const trainings = useLiveQuery(() => db.trainings.orderBy('order').toArray());
    const history = useLiveQuery(() => db.history.where('timestamp').above(Date.now() - 30 * 24 * 60 * 60 * 1000).toArray());
    const weightLogs = useLiveQuery(() => db.weightLogs.orderBy('timestamp').reverse().limit(1).toArray());
    const navigate = useNavigate();
    const { theme, monthlyGoal } = useTheme();

    const [weightInput, setWeightInput] = useState('');
    const [showWeightInput, setShowWeightInput] = useState(false);
    const [activeSession, setActiveSession] = useState<any>(null);

    // Widget Sync & Persistent Session Check
    React.useEffect(() => {
        if (history && monthlyGoal !== undefined) {
            WidgetService.sync({
                count: history.length,
                goal: monthlyGoal,
                weight: weightLogs?.[0]?.weight?.toString() || '---'
            });
        }

        const checkActive = async () => {
            const { value } = await Preferences.get({ key: 'neopulse_persistent_session' });
            if (value) {
                const session = JSON.parse(value);
                const tr = await db.trainings.get(session.trainingId);
                if (tr) {
                    setActiveSession({ ...session, trainingName: tr.name });
                }
            } else {
                setActiveSession(null);
            }
        };
        checkActive();
    }, [history, monthlyGoal, weightLogs, trainings]);

    const logWeight = async () => {
        const val = parseFloat(weightInput.replace(',', '.'));
        if (!isNaN(val) && val > 0) {
            await db.weightLogs.add({ weight: val, timestamp: Date.now() });
            setWeightInput('');
            setShowWeightInput(false);
            // Trigger manual sync for widget
            WidgetService.sync({
                count: history?.length || 0,
                goal: monthlyGoal,
                weight: val.toString()
            });
        }
    };

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

    const [showSelection, setShowSelection] = useState(false);

    const startWorkout = () => {
        if (trainings && trainings.length > 0) {
            setShowSelection(true);
        } else {
            addTraining();
        }
    };

    return (
        <div className="w-full max-w-md flex flex-col gap-4 pb-20 animate-in fade-in">
            {/* Start Workout Primary Action */}
            <div className="px-2">
                <button
                    onClick={startWorkout}
                    style={{
                        backgroundColor: theme.primary,
                        boxShadow: `0 0 30px ${theme.primary}50`
                    }}
                    className="w-full py-6 rounded-[2rem] flex items-center justify-center gap-3 active:scale-[0.98] transition-all transform group"
                >
                    <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center">
                        <i className={`fa-solid fa-play text-xs`} style={{ color: theme.primary }}></i>
                    </div>
                    <span className="text-xl font-black uppercase italic tracking-tighter text-black">Iniciar Treino</span>
                </button>
            </div>

            {/* Resume Active Session */}
            {activeSession && (
                <div className="px-2">
                    <button
                        onClick={() => navigate(`/session/${activeSession.trainingId}`)}
                        className="w-full p-6 bg-zinc-900 border border-zinc-800 rounded-[2rem] flex items-center justify-between group active:scale-[0.98] transition-all shadow-xl"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                                <i className="fa-solid fa-rotate-left text-zinc-400"></i>
                            </div>
                            <div className="text-left">
                                <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest leading-none">Continuar Treino</span>
                                <p className="text-lg font-black uppercase italic text-white mt-1">{activeSession.trainingName}</p>
                            </div>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-white group-hover:bg-zinc-700 transition-colors">
                            <i className="fa-solid fa-chevron-right"></i>
                        </div>
                    </button>
                </div>
            )}

            {/* Selection Modal (Simplified Overlay) */}
            {showSelection && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end animate-in fade-in duration-300">
                    <div className="w-full bg-zinc-900 rounded-t-[3rem] p-8 border-t border-zinc-800 animate-in slide-in-from-bottom-10">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black uppercase italic text-white leading-none">Qual Treino?</h3>
                            <button onClick={() => setShowSelection(false)} className="w-10 h-10 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center">
                                <i className="fa-solid fa-times"></i>
                            </button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 max-h-[50vh] overflow-y-auto">
                            {trainings?.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => {
                                        setShowSelection(false);
                                        navigate(`/session/${t.id}`);
                                    }}
                                    className="p-5 bg-zinc-950 border border-zinc-800 rounded-2xl text-left hover:border-zinc-500 transition-colors"
                                >
                                    <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest leading-none">Selecione o Treino</span>
                                    <p className="text-lg font-black uppercase italic text-white mt-1">{t.name}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {/* Calendar */}
            <div className="bg-zinc-900/50 p-4 rounded-3xl border border-zinc-800">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Frequência (14 dias)</span>
                    <span className="text-[10px] font-black text-white">{history?.length || 0} treinos mês</span>
                </div>

                {/* Monthly Goal Progress */}
                <div className="flex items-center gap-4 mb-5 p-3 bg-black/40 rounded-2xl border border-zinc-800/50">
                    <div className="relative w-12 h-12 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90">
                            <circle cx="24" cy="24" r="20" fill="transparent" stroke="currentColor" strokeWidth="4" className="text-zinc-800" />
                            <circle cx="24" cy="24" r="20" fill="transparent" stroke="currentColor" strokeWidth="4"
                                strokeDasharray={126}
                                strokeDashoffset={126 - (126 * Math.min(100, ((history?.length || 0) / monthlyGoal) * 100)) / 100}
                                style={{ color: theme.primary }}
                                className="transition-all duration-1000" />
                        </svg>
                        <span className="absolute text-[10px] font-black text-white">{Math.round(((history?.length || 0) / monthlyGoal) * 100)}%</span>
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Meta Mensal</p>
                        <p className="text-xs text-zinc-300 font-bold">{history?.length || 0} de {monthlyGoal} treinos</p>
                    </div>
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
                    title="Adicionar Treino"
                    onClick={addTraining}
                    style={{ backgroundColor: theme.primary, boxShadow: `0 0 15px ${theme.primary}40` }}
                    className="text-black w-8 h-8 rounded-lg flex items-center justify-center font-bold"
                >
                    <i className="fa-solid fa-plus"></i>
                </button>
            </div>


            {/* Weight Logging Card */}
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl mb-1">
                <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                        <i className="fa-solid fa-scale-balanced text-zinc-600"></i>
                        <span className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Peso Corporal</span>
                    </div>
                    {weightLogs?.[0] && (
                        <span className="text-xl font-black italic text-white">{weightLogs[0].weight} <span className="text-[10px] not-italic text-zinc-500 uppercase">Kg</span></span>
                    )}
                </div>

                {showWeightInput ? (
                    <div className="flex gap-2 mt-3 animate-in slide-in-from-top-2">
                        <input
                            type="text"
                            inputMode="decimal"
                            className="flex-1 bg-black/40 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white focus:border-[#00FF41] outline-none"
                            placeholder="Ex: 85.5"
                            value={weightInput}
                            onChange={(e) => setWeightInput(e.target.value)}
                            autoFocus
                        />
                        <button onClick={logWeight} style={{ backgroundColor: theme.primary }} className="px-4 rounded-xl text-black font-black text-[10px] uppercase">Salvar</button>
                        <button onClick={() => setShowWeightInput(false)} className="px-3 rounded-xl bg-zinc-800 text-zinc-500 text-xs"><i className="fa-solid fa-times"></i></button>
                    </div>
                ) : (
                    <button onClick={() => setShowWeightInput(true)} className="mt-2 text-[10px] font-black uppercase text-zinc-500 hover:text-white transition-colors">
                        + Registrar Peso Hoje
                    </button>
                )}
            </div>

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
                                title="Editar Treino"
                                onClick={(e) => { e.stopPropagation(); navigate(`/training/${training.id}`); }}
                                className="w-10 h-10 rounded-xl bg-zinc-950 text-zinc-400 border border-zinc-800 flex items-center justify-center hover:text-white"
                                style={{ borderColor: `${theme.primary}20` }}
                            >
                                <i className="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button
                                title="Duplicar Treino"
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
