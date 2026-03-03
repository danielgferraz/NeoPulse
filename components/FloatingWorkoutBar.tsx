import React from 'react';
import { useWorkoutPlayer } from '../contexts/WorkoutPlayerContext';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, Play, Pause, SkipForward } from 'lucide-react';

const FloatingWorkoutBar: React.FC = () => {
    const player = useWorkoutPlayer();
    const navigate = useNavigate();

    if (!player.isActuallyPlaying) return null;

    const currentExercise = player.queue[player.currentExerciseIndex];
    if (!currentExercise) return null;

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Calculo do progresso geral da sessao em %
    const totalSetsInQueue = player.queue.reduce((acc, ex) => acc + ex.restTimes.length, 0);
    let completedSetsCount = 0;
    Object.values(player.completedSets).forEach(sets => {
        completedSetsCount += sets.filter(Boolean).length;
    });
    const progressPercent = totalSetsInQueue > 0 ? (completedSetsCount / totalSetsInQueue) * 100 : 0;

    const isResting = player.isPlaying && !player.isStopwatch;

    const handleBarClick = (e: React.MouseEvent) => {
        // Se nao clicou em botões de controle, expande indo pra tela da sessao
        if (!(e.target as HTMLElement).closest('button')) {
            navigate(`/session/${player.trainingId}`);
        }
    };

    return (
        <div
            onClick={handleBarClick}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-[400px] bg-zinc-900 border border-zinc-700/50 rounded-[28px] p-2 pr-3 shadow-[0_20px_40px_rgba(0,0,0,0.8)] z-[100] flex items-center justify-between cursor-pointer animate-in slide-in-from-bottom-10 fade-in duration-300"
        >
            {/* Capa do Exercicio / Info Esquerda */}
            <div className="flex items-center gap-3 overflow-hidden">
                <div className={`w-12 h-12 rounded-[20px] flex items-center justify-center shrink-0 ${isResting ? 'bg-zinc-800' : 'bg-[#00FF41]/20'}`}>
                    <Dumbbell size={20} className={isResting ? 'text-zinc-500' : 'text-[#00FF41]'} />
                </div>
                <div className="flex flex-col whitespace-nowrap overflow-hidden pr-2">
                    <span className="text-white font-bold text-sm truncate mr-2">
                        {currentExercise.name}
                    </span>
                    <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                        Série {player.currentSetIndex + 1} de {currentExercise.restTimes.length}
                    </span>
                </div>
            </div>

            {/* Tempo Centralizado (opcionalmente pode ser integrado na esqueda em telas pequenas) */}
            <div className={`text-base font-black font-mono tracking-tight shrink-0 px-2 ${isResting ? 'text-[#00FF41]' : 'text-white'}`}>
                {player.isStopwatch ? formatTime(player.stopwatchTime) : formatTime(player.timeLeft)}
            </div>

            {/* Controles */}
            <div className="flex items-center gap-1 shrink-0">
                <button
                    onClick={(e) => { e.stopPropagation(); player.togglePlayPause(); }}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform bg-zinc-800"
                >
                    {player.isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); player.completeCurrentSet(); }}
                    title="Próxima Série"
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[#00FF41] active:scale-90 transition-transform"
                >
                    <SkipForward size={18} fill="currentColor" />
                </button>
            </div>

            {/* Barra de Progresso Fina na Base */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[85%] h-[2px] bg-zinc-800 rounded-full overflow-hidden">
                <div
                    className="h-full bg-[#00FF41] rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>
        </div>
    );
};

export default FloatingWorkoutBar;
