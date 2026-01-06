import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../services/db';

const SummaryView: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { theme } = useTheme();
    const trainingId = parseInt(searchParams.get('tid') || '0');

    // Stats
    const [trainingName, setTrainingName] = useState('');
    const [totalExercises, setTotalExercises] = useState(0);
    const [totalSets, setTotalSets] = useState(0);
    const [duration] = useState(searchParams.get('dur') || '00:00'); // Passed via URL for simplicity or calculate from history timestamps

    useEffect(() => {
        const loadStats = async () => {
            const training = await db.trainings.get(trainingId);
            if (training) setTrainingName(training.name);

            // Get history items added "just now" (last 2 hours maybe? or just pass count)
            // For now, let's just count total exercises in that training
            const exercises = await db.exercises.where('trainingId').equals(trainingId).toArray();
            setTotalExercises(exercises.length);

            // Estimate sets
            const sets = exercises.reduce((acc, ex) => acc + ex.restTimes.length, 0);
            setTotalSets(sets);
        };
        loadStats();
    }, [trainingId]);

    return (
        <div className="w-full max-w-md flex flex-col items-center justify-center min-h-[80vh] animate-in zoom-in duration-500 p-6 text-center">

            <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 animate-bounce"
                style={{ backgroundColor: theme.primary, boxShadow: `0 0 50px ${theme.primary}60` }}>
                <i className="fa-solid fa-trophy text-black text-4xl"></i>
            </div>

            <h1 className="text-4xl font-black uppercase italic text-white mb-2 tracking-tighter">Treino Concluído!</h1>
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs mb-10">Você destruiu o {trainingName}</p>

            <div className="grid grid-cols-2 gap-4 w-full mb-10">
                <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-3xl flex flex-col items-center">
                    <span className="text-2xl font-black text-white">{totalExercises}</span>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Exercícios</span>
                </div>
                <div className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-3xl flex flex-col items-center">
                    <span className="text-2xl font-black text-white">{totalSets}</span>
                    <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Séries Totais</span>
                </div>
            </div>

            <button
                onClick={() => navigate('/')}
                style={{ backgroundColor: theme.primary, boxShadow: `0 0 20px ${theme.primary}40` }}
                className="w-full py-4 rounded-2xl text-black font-black uppercase tracking-widest text-lg hover:scale-105 transition-transform"
            >
                Voltar para Home
            </button>
        </div>
    );
};

export default SummaryView;
