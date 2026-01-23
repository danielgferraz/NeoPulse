import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/db';

interface HistoryItem {
    name: string;
    sets: number;
    reps?: string[];
    weights?: number[];
    rpes?: number[];
    totalDuration?: number;
}

const SummaryView: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { theme } = useTheme();
    const trainingId = parseInt(searchParams.get('tid') || '0');
    const [history, setHistory] = useState<HistoryItem[]>([]);

    // Stats
    const [trainingName, setTrainingName] = useState('');
    const [totalExercises, setTotalExercises] = useState(0);
    const [totalSets, setTotalSets] = useState(0);

    useEffect(() => {
        const loadStats = async () => {
            const training = await db.trainings.get(trainingId);
            if (training) setTrainingName(training.name);

            // Check if history was passed via state
            if (location.state && location.state.history) {
                const passedHistory = location.state.history as HistoryItem[];
                setHistory(passedHistory);
                setTotalExercises(passedHistory.length);
                setTotalSets(passedHistory.reduce((acc, h) => acc + h.sets, 0));
            } else {
                // Fallback: Estimate from DB (Classic Logic)
                const exercises = await db.exercises.where('trainingId').equals(trainingId).toArray();
                setTotalExercises(exercises.length);
                const sets = exercises.reduce((acc, ex) => acc + ex.restTimes.length, 0);
                setTotalSets(sets);

                // Retrieve names for fallback list (though sets might be inaccurate if not tracked)
                setHistory(exercises.map(ex => ({
                    name: ex.name,
                    sets: ex.restTimes.length
                })));
            }
        };
        loadStats();
    }, [trainingId, location.state]);

    return (
        <div className="w-full h-screen overflow-y-auto flex flex-col items-center p-6 text-center animate-in zoom-in duration-500 pb-20">

            <div className="mt-8 mb-6 relative">
                <div className="absolute inset-0 rounded-full blur-xl opacity-50 animate-pulse"
                    style={{ backgroundColor: theme.primary }}></div>
                <div className="w-24 h-24 rounded-full flex items-center justify-center relative z-10 bg-zinc-900 border-2"
                    style={{ borderColor: theme.primary }}>
                    <i className="fa-solid fa-trophy text-3xl" style={{ color: theme.primary }}></i>
                </div>
            </div>

            <h1 className="text-4xl font-black uppercase italic text-white mb-2 tracking-tighter">Treino Concluído!</h1>
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs mb-8">
                {trainingName ? `Você destruiu o ${trainingName}` : 'Treino Finalizado'}
            </p>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-8">
                <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-3xl flex flex-col items-center backdrop-blur-sm">
                    <span className="text-3xl font-black text-white">{totalExercises}</span>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-1">Exercícios</span>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-3xl flex flex-col items-center backdrop-blur-sm">
                    <span className="text-3xl font-black text-white">{totalSets}</span>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest mt-1">Séries</span>
                </div>
            </div>

            {/* History List */}
            <div className="w-full max-w-sm flex-1 flex flex-col gap-3 mb-8">
                <h2 className="text-left text-xs font-black text-zinc-600 uppercase tracking-widest ml-2 mb-2">Resumo da Sessão</h2>

                {history.length === 0 ? (
                    <div className="text-zinc-500 text-sm italic">Nenhum exercício registrado detalhadamente.</div>
                ) : (
                    history.map((item, idx) => (
                        <div key={idx} className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-3xl flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-white font-black text-sm uppercase tracking-tight italic">{item.name}</h3>
                                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{item.sets} {item.sets === 1 ? 'Série' : 'Séries'}</p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/20">
                                    <i className="fa-solid fa-check text-green-500 text-xs"></i>
                                </div>
                            </div>

                            {item.weights && item.weights.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-800/50">
                                    {item.weights.map((w, sIdx) => (
                                        <div key={sIdx} className="flex-1 min-w-[60px] bg-black/40 rounded-xl p-2 border border-zinc-800">
                                            <div className="flex justify-between items-center mb-0.5">
                                                <span className="text-[8px] font-black text-zinc-600 uppercase">S{sIdx + 1}</span>
                                                {item.rpes && item.rpes[sIdx] && (
                                                    <span className="text-[8px] font-black text-[#00FF41]">RPE {item.rpes[sIdx]}</span>
                                                )}
                                            </div>
                                            <div className="text-xs font-black text-white italic">{w}kg</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="fixed bottom-6 left-0 right-0 px-6 max-w-sm mx-auto w-full">
                <button
                    onClick={() => navigate('/')}
                    style={{ backgroundColor: theme.primary, boxShadow: `0 0 20px ${theme.primary}40` }}
                    className="w-full py-4 rounded-2xl text-black font-black uppercase tracking-widest text-lg hover:scale-105 transition-transform active:scale-95"
                >
                    Voltar para Home
                </button>
            </div>
        </div>
    );
};

export default SummaryView;
