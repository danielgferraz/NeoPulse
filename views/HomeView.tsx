import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { WidgetService } from '../services/widgetService';
import { Preferences } from '@capacitor/preferences';

const WorkoutPreview = ({ trainingId, onClose, navigate, theme }: { trainingId: number | null, onClose: () => void, navigate: any, theme: any }) => {
    const previewTraining = useLiveQuery(() => trainingId ? db.trainings.get(trainingId) : Promise.resolve(null), [trainingId]);
    const previewExercises = useLiveQuery(() => trainingId ? db.exercises.where('trainingId').equals(trainingId).sortBy('order') : Promise.resolve([]), [trainingId]);

    if (!trainingId || !previewTraining) return null;

    return (
        <div className="fixed inset-0 bg-black z-[90] flex flex-col p-10 animate-in fade-in duration-500 overflow-hidden">
            {/* Background Narrative */}
            <div className="absolute top-[-10vh] left-[-5vh] opacity-[0.02] pointer-events-none select-none">
                <span className="text-[30vh] font-black italic leading-none whitespace-nowrap uppercase">
                    {previewTraining.name}
                </span>
            </div>

            <div className="flex justify-between items-start mb-16 relative z-10">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.5em] mb-2 border-l border-[#00FF41] pl-3">Visualizar Protocolo</span>
                    <h3 className="text-5xl font-black italic text-white tracking-tighter uppercase leading-none break-words max-w-[80vw]">
                        {previewTraining.name}
                    </h3>
                </div>
                <button onClick={onClose} title="Fechar Visualização" className="w-12 h-12 rounded-full border border-zinc-800 text-zinc-400 flex items-center justify-center hover:text-white transition-all">
                    <i className="fa-solid fa-xmark"></i>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar relative z-10 space-y-6 pb-20">
                {previewExercises.length > 0 ? (
                    previewExercises.map((ex, i) => (
                        <div key={ex.id} className="flex items-center gap-6 group">
                            <span className="text-xl font-black text-zinc-800 italic group-hover:text-[#00FF41] transition-colors">
                                {String(i + 1).padStart(2, '0')}
                            </span>
                            <div className="flex flex-col border-b border-zinc-900 pb-4 flex-1">
                                <p className="text-lg font-black text-white uppercase italic tracking-tighter truncate group-hover:pl-2 transition-all">
                                    {ex.name}
                                </p>
                                <div className="flex gap-4 mt-1 opacity-40">
                                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{ex.restTimes.length + 1} Séries</span>
                                    {ex.reps && <span className="text-[9px] font-bold text-[#00FF41] uppercase tracking-widest">• {ex.reps} Reps</span>}
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="py-20 text-center opacity-20">
                        <p className="text-sm text-zinc-500 italic uppercase font-black tracking-widest">Nenhum fragmento encontrado.</p>
                    </div>
                )}
            </div>

            <div className="pt-8 relative z-10 border-t border-zinc-900">
                <button
                    onClick={() => {
                        onClose();
                        navigate(`/session/${trainingId}`);
                    }}
                    className="w-full py-6 bg-[#00FF41] text-black rounded-none flex items-center justify-center gap-4 active:scale-[0.98] transition-all group"
                >
                    <span className="text-2xl font-black uppercase italic tracking-tighter group-hover:tracking-widest transition-all">Executar Protocolo</span>
                    <i className="fa-solid fa-bolt-lightning animate-pulse"></i>
                </button>
            </div>
        </div>
    );
};

const HomeView: React.FC = () => {
    const trainings = useLiveQuery(() => db.trainings.orderBy('order').toArray());
    const allExercises = useLiveQuery(() => db.exercises.toArray());
    const workoutHistory = useLiveQuery(() => db.history.where('timestamp').above(Date.now() - 30 * 24 * 60 * 60 * 1000).toArray());
    const weightLogs = useLiveQuery(() => db.weightLogs.orderBy('timestamp').reverse().limit(1).toArray());
    const navigate = useNavigate();
    const { theme, monthlyGoal } = useTheme();

    const [weightInput, setWeightInput] = useState('');
    const [showWeightInput, setShowWeightInput] = useState(false);
    const [activeSession, setActiveSession] = useState<any>(null);
    const [previewTrainingId, setPreviewTrainingId] = useState<number | null>(null);

    // Widget Sync & Persistent Session Check
    React.useEffect(() => {
        if (workoutHistory && monthlyGoal !== undefined) {
            WidgetService.sync({
                count: workoutHistory.length,
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
                    // Proactive: Update widget on home load if session exists
                    WidgetService.syncSession({
                        exercise: session.exercise,
                        next: session.next || '---',
                        currentSet: session.setIndex + 1,
                        totalSets: session.totalSets || 1,
                        timerEnd: session.isActive && !session.isStopwatch ? (session.lastTimestamp + session.timeLeft * 1000) : null,
                        timerStart: session.isActive && session.isStopwatch ? (session.stopwatchTime ? (Date.now() - session.stopwatchTime * 1000) : null) : null
                    });
                }
            } else {
                setActiveSession(null);
            }
        };
        checkActive();
    }, [workoutHistory, monthlyGoal, weightLogs, trainings]);

    const logWeight = async () => {
        const val = parseFloat(weightInput.replace(',', '.'));
        if (!isNaN(val) && val > 0) {
            await db.weightLogs.add({ weight: val, timestamp: Date.now() });
            setWeightInput('');
            setShowWeightInput(false);
            // Trigger manual sync for widget
            WidgetService.sync({
                count: workoutHistory?.length || 0,
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

    const moveTraining = async (id: number, direction: 'up' | 'down') => {
        if (!trainings) return;
        const index = trainings.findIndex(t => t.id === id);
        if (index === -1) return;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= trainings.length) return;

        const currentTraining = trainings[index];
        const targetTraining = trainings[targetIndex];

        // Ensure orders are defined
        const currentOrder = currentTraining.order ?? index;
        const targetOrder = targetTraining.order ?? targetIndex;

        await db.transaction('rw', db.trainings, async () => {
            await db.trainings.update(currentTraining.id!, { order: targetOrder });
            await db.trainings.update(targetTraining.id!, { order: currentOrder });
        });
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
        return workoutHistory?.some(h => new Date(h.timestamp).toDateString() === date.toDateString());
    };

    const getTrainingsForDate = (date: Date) => {
        return workoutHistory?.filter(h => new Date(h.timestamp).toDateString() === date.toDateString()) || [];
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
        <div className="fixed inset-0 bg-black overflow-hidden flex flex-col font-sans select-none z-[60]">
            {/* Z-0: GHOST METRICS LAYER (Background) */}
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-10 opacity-[0.07] select-none">
                <div className="flex justify-between items-start">
                    <span className="text-[20vh] font-black leading-none tracking-tighter italic">
                        {workoutHistory?.length || 0}
                    </span>
                    <span className="text-4xl font-black uppercase vertical-text tracking-[1em] mt-20">
                        PULSO
                    </span>
                </div>
                <div className="flex items-end justify-between">
                    <div className="flex flex-col">
                        <span className="text-6xl font-black italic mb-2 tracking-tighter">SISTEMA</span>
                        <span className="text-2xl font-black uppercase tracking-[0.5em]">MÉTRICO</span>
                    </div>
                    <span className="text-[15vh] font-black leading-none italic">
                        {weightLogs?.[0]?.weight || '--'}
                    </span>
                </div>
            </div>

            {/* Z-10: ASYMMETRIC HUD (Foreground) */}
            <div className="relative flex-1 flex flex-col px-8 pt-16 pb-24 z-10 overflow-y-auto no-scrollbar">

                {/* HUD Header: Tensão Assimétrica */}
                <div className="flex justify-between items-start mb-12">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] mb-2 border-l-2 border-[#00FF41] pl-3">Portal de Performance</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-black italic text-white tracking-tighter">
                                {Math.round(((workoutHistory?.length || 0) / monthlyGoal) * 100)}%
                            </span>
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Meta</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-6">
                        <button
                            onClick={() => navigate('/settings')}
                            className="flex items-center gap-2 text-zinc-800 hover:text-[#00FF41] transition-all group"
                            title="Configurações do Sistema"
                        >
                            <span className="text-[7px] font-black uppercase tracking-[0.3em] opacity-0 group-hover:opacity-100 transition-all">Config_Sis</span>
                            <i className="fa-solid fa-gear text-[10px]"></i>
                        </button>
                        <div className="text-right">
                            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] mb-2 block">Log de Peso</span>
                            <p className="text-2xl font-black text-zinc-200 italic tracking-tighter">
                                {weightLogs?.[0] ? `${weightLogs[0].weight}KG` : '---'}
                            </p>
                            <button
                                onClick={() => setShowWeightInput(true)}
                                className="text-[8px] font-black text-[#00FF41] uppercase tracking-widest mt-1 opacity-50 hover:opacity-100 transition-opacity"
                            >
                                + Atualizar
                            </button>
                        </div>
                    </div>
                </div>

                {/* Telemetria de Pulso (Frequency HUD) */}
                <div className="mb-14">
                    <div className="flex justify-between items-end mb-4">
                        <span className="text-[8px] font-black text-zinc-700 uppercase tracking-[0.4em]">Frequência Temporal (14D)</span>
                        <span className="text-[8px] font-black text-[#00FF41] uppercase tracking-widest">Online</span>
                    </div>
                    <div className="flex justify-between items-end h-8 gap-[3px] mb-2">
                        {calendarDays.map((date, i) => {
                            const didTrain = hasTrainingOnDate(date);
                            const isToday = new Date().toDateString() === date.toDateString();
                            const isSelected = selectedDate === date.toDateString();

                            return (
                                <div
                                    key={i}
                                    onClick={() => setSelectedDate(isSelected ? null : date.toDateString())}
                                    className={`flex-1 h-full cursor-pointer transition-all duration-300 relative group`}
                                >
                                    <div
                                        className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-[2px] transition-all duration-500
                                            ${didTrain ? 'bg-[#00FF41] h-full shadow-[0_0_10px_#00FF41]' : 'bg-zinc-900 h-2'}
                                            ${isSelected ? 'h-full bg-white scale-x-150 shadow-[0_0_15px_white]' : ''}
                                            ${isToday ? 'after:content-[""] after:absolute after:-top-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-white after:rounded-full' : ''}
                                        `}
                                    />
                                </div>
                            );
                        })}
                    </div>
                    {/* Labelling Técnico: Iniciais dos Dias */}
                    <div className="flex justify-between gap-[3px]">
                        {calendarDays.map((date, i) => (
                            <span key={i} className={`flex-1 text-center text-[7px] font-black tracking-tighter
                                ${new Date().toDateString() === date.toDateString() ? 'text-white' : 'text-zinc-800'}
                            `}>
                                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][date.getDay()]}
                            </span>
                        ))}
                    </div>

                    {/* Expansão de Telemetria (Workout Details) */}
                    {selectedDate && (
                        <div className="mt-6 p-4 border border-zinc-900 bg-zinc-950/50 animate-in slide-in-from-top-4 duration-500">
                            <div className="flex justify-between items-center mb-4 border-b border-zinc-900 pb-2">
                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                                    {new Date(selectedDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase()}
                                </span>
                                <span className="text-[8px] font-black text-zinc-700 uppercase tracking-[0.2em] italic">Protocolos Executados</span>
                            </div>

                            <div className="space-y-3">
                                {getTrainingsForDate(new Date(selectedDate)).length > 0 ? (
                                    getTrainingsForDate(new Date(selectedDate)).map((h, i) => (
                                        <div
                                            key={i}
                                            onClick={() => navigate(`/summary?tid=0`, { state: { history: h.details || [] } })}
                                            className="flex justify-between items-center cursor-pointer group hover:pl-2 transition-all"
                                        >
                                            <h4 className="text-sm font-black text-white italic uppercase tracking-tighter group-hover:text-[#00FF41]">
                                                {h.trainingName}
                                            </h4>
                                            <div className="flex items-center gap-3">
                                                <span className="text-[9px] font-bold text-zinc-600 uppercase">{h.sets} SÉRIES</span>
                                                <i className="fa-solid fa-chevron-right text-[8px] text-zinc-800"></i>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-[9px] font-black text-zinc-800 uppercase italic tracking-widest text-center py-2">Sem atividade registrada.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Action: THE VOID START */}
                <div className="flex-1 flex flex-col justify-center items-center py-10">
                    {!activeSession ? (
                        <div className="relative group cursor-pointer" onClick={startWorkout}>
                            {/* Layered Effect for Action */}
                            <div className="absolute inset-0 bg-white/5 scale-[2] rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
                            <div className="relative flex flex-col items-center">
                                <span className="text-[15vw] font-black italic text-white tracking-tighter leading-none transition-transform duration-500 group-active:scale-95 group-hover:tracking-normal group-hover:skew-x-[-4deg]">
                                    INICIAR
                                </span>
                                <div className="flex flex-col items-center mt-2">
                                    <div className="flex items-center gap-4 mb-1">
                                        <div className="h-px w-6 bg-zinc-900"></div>
                                        <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.4em]">Pronto p/ Execução</span>
                                        <div className="h-px w-6 bg-zinc-900"></div>
                                    </div>
                                    <span className="text-[7px] font-mono text-[#00FF41]/30 tracking-widest uppercase">NP_CORE_V0.49 // SYSTEM_READY</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="relative flex flex-col items-center cursor-pointer" onClick={() => navigate(`/session/${activeSession.trainingId}`)}>
                            <span className="text-[8vw] font-black italic text-[#00FF41] tracking-tighter leading-none animate-pulse">
                                RETOMAR
                            </span>
                            <span className="text-2xl font-black text-white uppercase italic mt-1 tracking-tighter truncate max-w-[280px]">
                                {activeSession.trainingName}
                            </span>
                        </div>
                    )}
                </div>

                {/* Training Narrative: NO CARDS, JUST FRAGMENTS */}
                <div className="mt-auto space-y-8">
                    <div className="flex justify-between items-end border-b border-zinc-900 pb-2 mb-6">
                        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em]">Rotinas Atuais</span>
                        <button onClick={addTraining} className="text-[10px] font-black text-[#00FF41] uppercase tracking-widest">+ Novo Treino</button>
                    </div>

                    <div className="space-y-6">
                        {trainings?.map((training, i) => (
                            <div key={training.id} className="group relative flex items-center justify-between cursor-pointer border-l border-zinc-900 hover:border-[#00FF41] pl-6 transition-colors">
                                <div className="flex flex-col" onClick={() => setPreviewTrainingId(training.id!)}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[8px] font-black text-[#00FF41] uppercase tracking-widest">
                                            {training.name.split(' ').slice(0, 1).join('').toUpperCase()}
                                        </span>
                                        <span className="text-[8px] font-black text-zinc-700 uppercase tracking-widest">
                                            • {allExercises?.filter(ex => ex.trainingId === training.id).length || 0} EXERG
                                        </span>
                                    </div>
                                    <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter group-hover:text-[#00FF41] transition-colors leading-none">
                                        {training.name}
                                    </h3>
                                </div>

                                <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => { e.stopPropagation(); navigate(`/training/${training.id}`); }} title="Editar Protocolo" className="text-zinc-600 hover:text-white transition-colors">
                                        <i className="fa-solid fa-pen-nib text-[10px]"></i>
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); duplicateTraining(training.id!); }} title="Duplicar Protocolo" className="text-zinc-600 hover:text-white transition-colors">
                                        <i className="fa-solid fa-clone text-[10px]"></i>
                                    </button>
                                    <div className="flex flex-col gap-1">
                                        <button disabled={i === 0} onClick={(e) => { e.stopPropagation(); moveTraining(training.id!, 'up'); }} title="Mover para cima" className="text-zinc-800 hover:text-[#00FF41] disabled:opacity-0">
                                            <i className="fa-solid fa-chevron-up text-[8px]"></i>
                                        </button>
                                        <button disabled={i === (trainings?.length || 0) - 1} onClick={(e) => { e.stopPropagation(); moveTraining(training.id!, 'down'); }} title="Mover para baixo" className="text-zinc-800 hover:text-[#00FF41] disabled:opacity-0">
                                            <i className="fa-solid fa-chevron-down text-[8px]"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {trainings?.length === 0 && (
                        <p className="text-[10px] font-black text-zinc-700 uppercase italic tracking-widest text-center py-10 border border-dashed border-zinc-900 rounded-xl">
                            Nenhum padrão detectado.
                        </p>
                    )}
                </div>
            </div>

            {/* Selection Overlay (Luxury Redesign) */}
            {showSelection && (
                <div className="fixed inset-0 bg-black/95 z-[70] flex flex-col p-10 animate-in fade-in duration-500">
                    <div className="flex justify-between items-start mb-16">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-[#00FF41] uppercase tracking-[0.5em] mb-2">Seleção de Protocolo</span>
                            <h3 className="text-5xl font-black italic text-white tracking-tighter uppercase leading-none">Escolha o Caminho</h3>
                        </div>
                        <button onClick={() => setShowSelection(false)} title="Fechar Seleção" className="w-12 h-12 rounded-full border border-zinc-800 text-zinc-400 flex items-center justify-center hover:text-white hover:border-zinc-400 transition-all">
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <div className="flex-1 flex flex-col gap-10 overflow-y-auto no-scrollbar">
                        <button
                            onClick={async () => {
                                await db.exercises.where('trainingId').equals(0).delete();
                                setShowSelection(false);
                                navigate('/session/0');
                            }}
                            className="group text-left"
                        >
                            <span className="text-[8px] font-black text-zinc-700 uppercase tracking-widest block mb-2 group-hover:text-[#00FF41]">Modo: Irrestrito</span>
                            <h4 className="text-4xl font-black italic text-white uppercase tracking-tighter group-hover:pl-4 transition-all">TREINO LIVRE</h4>
                        </button>

                        <div className="h-px bg-zinc-900 w-20"></div>

                        {trainings?.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => {
                                    setShowSelection(false);
                                    setPreviewTrainingId(t.id!);
                                }}
                                className="group text-left"
                            >
                                <span className="text-[8px] font-black text-zinc-700 uppercase tracking-widest block mb-2 group-hover:text-[#00FF41]">Protocolo: Padrão</span>
                                <h4 className="text-4xl font-black italic text-white uppercase tracking-tighter group-hover:pl-4 transition-all">{t.name}</h4>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Weight Input Overlay (Minimalist) */}
            {showWeightInput && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[80] flex items-center justify-center p-8 animate-in zoom-in duration-300">
                    <div className="w-full max-w-xs text-center">
                        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.5em] mb-6 block">Métrica Alvo</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            className="bg-transparent border-none text-7xl font-black italic text-white text-center w-full focus:outline-none tracking-tighter"
                            placeholder="00.0"
                            value={weightInput}
                            onChange={(e) => setWeightInput(e.target.value)}
                            autoFocus
                        />
                        <div className="flex justify-center gap-6 mt-10">
                            <button onClick={logWeight} className="text-sm font-black text-[#00FF41] uppercase tracking-widest">Confirmar</button>
                            <button onClick={() => setShowWeightInput(false)} className="text-sm font-black text-red-500/50 uppercase tracking-widest">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            <WorkoutPreview
                trainingId={previewTrainingId}
                onClose={() => setPreviewTrainingId(null)}
                navigate={navigate}
                theme={theme}
            />
        </div>
    );
};

export default HomeView;
