import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Preferences } from '@capacitor/preferences';
import { useTheme } from '../../contexts/ThemeContext';

interface WidgetData {
    count: number;
    goal: number;
    weight: string;
}

interface SessionData {
    exerciseName: string;
    nextExerciseName: string;
    currentSet: number;
    totalSets: number;
    timerEndTime: number | null;
}

const WidgetPreview: React.FC = () => {
    const navigate = useNavigate();
    const { theme } = useTheme();
    const [widgetData, setWidgetData] = useState<WidgetData | null>(null);
    const [sessionData, setSessionData] = useState<SessionData | null>(null);

    useEffect(() => {
        const loadData = async () => {
            const w = await Preferences.get({ key: 'neopulse_widget_data' });
            if (w.value) setWidgetData(JSON.parse(w.value));

            const s = await Preferences.get({ key: 'neopulse_session_data' });
            if (s.value) setSessionData(JSON.parse(s.value));
        };
        loadData();

        const interval = setInterval(loadData, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full max-w-md flex flex-col gap-8 pb-20 animate-in fade-in">
            <div className="flex justify-between items-center px-4 pt-6">
                <button title="Voltar" onClick={() => navigate('/settings')} className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                    <i className="fa-solid fa-arrow-left"></i>
                </button>
                <h1 className="text-xl font-black italic uppercase text-white">Widget Preview</h1>
                <div className="w-10 h-10"></div>
            </div>

            <p className="px-6 text-[10px] text-zinc-500 uppercase font-bold tracking-widest text-center">
                Clone visual dos widgets nativos Android
            </p>

            <div className="px-4 space-y-12">
                {/* Stats Widget Clone */}
                <section className="flex flex-col items-center gap-4">
                    <span className="text-xs font-bold text-zinc-600 uppercase tracking-tighter">Stats Widget (2x2)</span>
                    <div className="w-[180px] h-[180px] bg-black border border-zinc-800 rounded-3xl p-5 flex flex-col shadow-2xl relative overflow-hidden group">
                        <div className="flex justify-between items-start">
                            <h3 className="text-[10px] font-black italic tracking-[0.2em] text-[#00FF41]">NEOPULSE</h3>
                        </div>

                        <div className="mt-auto space-y-3">
                            <div>
                                <p className="text-[10px] font-black uppercase text-white mb-1">
                                    {widgetData?.count || 0} / {widgetData?.goal || 12} TREINOS
                                </p>
                                <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[#00FF41] transition-all duration-1000"
                                        style={{ width: `${Math.min(100, ((widgetData?.count || 0) / (widgetData?.goal || 12)) * 100)}%` }}
                                    ></div>
                                </div>
                            </div>

                            <p className="text-[10px] font-black uppercase text-zinc-500">
                                PESO: <span className="text-white">{widgetData?.weight || '---'}</span> KG
                            </p>
                        </div>
                    </div>
                </section>

                {/* Session Widget Clone */}
                <section className="flex flex-col items-center gap-4">
                    <span className="text-xs font-bold text-zinc-600 uppercase tracking-tighter">Session Widget (4x2)</span>
                    <div className="w-[340px] h-[160px] bg-black border border-zinc-800 rounded-3xl p-5 flex flex-col shadow-2xl relative overflow-hidden">
                        {!sessionData ? (
                            <div className="h-full flex flex-col items-center justify-center gap-2">
                                <i className="fa-solid fa-dumbbell text-zinc-800 text-2xl"></i>
                                <span className="text-[10px] font-black uppercase text-zinc-700">Nenhuma Sessão Ativa</span>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black uppercase text-[#00FF41] tracking-widest leading-none">TREINO ATIVO</span>
                                        <h3 className="text-base font-black italic uppercase text-white tracking-tight mt-1 truncate max-w-[150px]">
                                            {sessionData.exerciseName}
                                        </h3>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[24px] font-mono font-black text-white leading-none">00:00</span>
                                        <p className="text-[8px] font-black text-zinc-500 uppercase mt-1">REST TIMER</p>
                                    </div>
                                </div>

                                <div className="mt-auto flex justify-between items-end">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black uppercase text-white">SET {sessionData.currentSet} / {sessionData.totalSets}</span>
                                        <div className="flex gap-1 mt-1">
                                            {[...Array(sessionData.totalSets)].map((_, i) => (
                                                <div
                                                    key={i}
                                                    className={`w-4 h-1 rounded-full ${i < sessionData.currentSet ? 'bg-[#00FF41]' : 'bg-zinc-900'}`}
                                                ></div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <span className="text-[8px] font-black uppercase text-zinc-600 leading-none">PRÓXIMO</span>
                                        <p className="text-[10px] font-black uppercase text-zinc-400 mt-0.5 truncate max-w-[120px]">
                                            {sessionData.nextExerciseName || 'FIM DO TREINO'}
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </section>
            </div>

            <div className="px-8 text-center text-[10px] text-zinc-600 italic">
                * Os widgets nativos podem variar levemente de acordo com a versão do Android e launcher utilizado.
            </div>
        </div>
    );
};

export default WidgetPreview;
