import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme, ThemeName, themes } from '../contexts/ThemeContext';
import { db } from '../services/db';
import UpdateChecker from '../components/UpdateChecker';

const SettingsView: React.FC = () => {
    const navigate = useNavigate();
    const { theme, setTheme, soundMode, setSoundMode, monthlyGoal, setMonthlyGoal, hapticPattern, setHapticPattern } = useTheme();

    // Reusing logic from HomeView, ideally move to a service/hook if shared, but for now simple copy
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

    return (
        <div className="w-full max-w-md flex flex-col gap-6 pb-20 animate-in fade-in slide-in-from-right h-screen overflow-y-auto">
            <div className="flex justify-between items-center px-4 pt-6">
                <button title="Voltar" onClick={() => navigate('/')} className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                    <i className="fa-solid fa-arrow-left"></i>
                </button>
                <h1 className="text-xl font-black italic uppercase text-white">Configurações</h1>
                <div className="w-10 h-10"></div> {/* Spacer */}
            </div>

            <div className="px-4 space-y-6">
                {/* Visuals */}
                <section>
                    <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Visual & Tema</h2>
                    <div className="grid grid-cols-2 gap-3">
                        {Object.values(themes).map((t) => (
                            <button
                                key={t.name}
                                onClick={() => setTheme(t.name)}
                                className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${theme.name === t.name ? 'bg-zinc-900 border-[#00FF41]' : 'border-zinc-800 bg-black/50 hover:bg-zinc-900'}`}
                                style={{ borderColor: theme.name === t.name ? t.primary : undefined }}
                            >
                                <div className="w-8 h-8 rounded-full shadow-lg" style={{ backgroundColor: t.primary }}></div>
                                <span className="text-xs font-bold text-zinc-400 uppercase">{t.label}</span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* Monthly Goal Setting */}
                <section>
                    <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Meta Mensal</h2>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-white">Treinos por Mês</span>
                            <span className="text-[10px] text-zinc-500 italic">Quantos dias você pretende treinar</span>
                        </div>
                        <div className="flex items-center gap-3 bg-black rounded-xl p-1 border border-zinc-800">
                            <button onClick={() => setMonthlyGoal(Math.max(1, monthlyGoal - 1))} className="w-8 h-8 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white pb-1">-</button>
                            <span className="w-8 text-center font-black text-white">{monthlyGoal}</span>
                            <button onClick={() => setMonthlyGoal(monthlyGoal + 1)} className="w-8 h-8 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white pb-1">+</button>
                        </div>
                    </div>
                </section>

                {/* Haptic Patterns */}
                <section>
                    <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Vibração (Haptics)</h2>
                    <div className="flex flex-wrap gap-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-2">
                        {(['light', 'medium', 'heavy', 'dual', 'triple'] as const).map((pattern) => (
                            <button
                                key={pattern}
                                onClick={() => setHapticPattern(pattern)}
                                className={`flex-1 min-w-[30%] py-2 rounded-xl text-[9px] font-black uppercase tracking-tight transition-all border ${hapticPattern === pattern ? 'bg-zinc-800 border-[#00FF41] text-white' : 'border-transparent text-zinc-600 hover:text-zinc-400'}`}
                                style={{ color: hapticPattern === pattern ? theme.primary : undefined }}
                            >
                                {pattern}
                            </button>
                        ))}
                    </div>
                    <p className="text-[9px] text-zinc-600 mt-2 ml-1 italic">* O padrão de vibração será usado no fim do descanso.</p>
                </section>

                {/* Audio Settings */}
                <section>
                    <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Feedback Sonoro</h2>
                    <div className="flex bg-zinc-900/50 border border-zinc-800 rounded-2xl p-1">
                        {(['beep', 'voice', 'silent'] as const).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setSoundMode(mode)}
                                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${soundMode === mode ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}
                                style={{ color: soundMode === mode ? theme.primary : undefined }}
                            >
                                {mode === 'beep' && <><i className="fa-solid fa-bell mr-2"></i> Beep</>}
                                {mode === 'voice' && <><i className="fa-solid fa-microphone mr-2"></i> Voz</>}
                                {mode === 'silent' && <><i className="fa-solid fa-bell-slash mr-2"></i> Mudo</>}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Data Management */}
                <section>
                    <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Dados</h2>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-2 flex flex-col gap-1">
                        <button onClick={exportData} className="w-full text-left p-4 rounded-xl hover:bg-zinc-800 flex items-center gap-3 text-zinc-300 transition-colors">
                            <i className="fa-solid fa-download text-zinc-500"></i>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold">Fazer Backup</span>
                                <span className="text-[10px] text-zinc-500">Salvar dados em arquivo .json</span>
                            </div>
                        </button>
                        <div className="h-px bg-zinc-800 mx-4"></div>
                        <label className="w-full text-left p-4 rounded-xl hover:bg-zinc-800 flex items-center gap-3 text-zinc-300 cursor-pointer transition-colors">
                            <i className="fa-solid fa-upload text-zinc-500"></i>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold">Restaurar Backup</span>
                                <span className="text-[10px] text-zinc-500">Substituir dados atuais por arquivo</span>
                            </div>
                            <input type="file" accept=".json" onChange={importData} className="hidden" />
                        </label>
                    </div>
                </section>

                {/* System Info */}
                <section>
                    <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Sistema</h2>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-2 flex flex-col gap-1">
                        <button onClick={() => navigate('/preview')} className="w-full text-left p-4 rounded-xl hover:bg-zinc-800 flex items-center gap-3 text-zinc-300 transition-colors">
                            <i className="fa-solid fa-eye text-[#00FF41]"></i>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold">Widget Preview</span>
                                <span className="text-[10px] text-zinc-500">Testar visual dos widgets no browser</span>
                            </div>
                        </button>
                        <div className="h-px bg-zinc-800 mx-4"></div>
                        <button onClick={() => navigate('/library')} className="w-full text-left p-4 rounded-xl hover:bg-zinc-800 flex items-center gap-3 text-zinc-300 transition-colors">
                            <i className="fa-solid fa-book text-[#00FF41]"></i>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold">Gerenciar Biblioteca</span>
                                <span className="text-[10px] text-zinc-500">Ver e gerenciar exercícios padrão</span>
                            </div>
                        </button>
                        <div className="h-px bg-zinc-800 mx-4"></div>
                        <div className="p-4">
                            <UpdateChecker />
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default SettingsView;
