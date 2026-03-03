import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useWorkoutPlayer } from '../contexts/WorkoutPlayerContext';
import Timer from '../components/Timer';
import WorkoutTracker from '../components/WorkoutTracker';
import UpNextList from '../components/UpNextList';
import { useTheme } from '../contexts/ThemeContext';
import { SkipBack, SkipForward, Play, Pause, MoreVertical, ChevronDown, Square, Plus } from 'lucide-react';

const PlayerView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const trainingId = parseInt(id || '0');
    const isFreeTraining = trainingId === 0;
    const navigate = useNavigate();
    const player = useWorkoutPlayer();
    const { theme } = useTheme();
    const [showUpNext, setShowUpNext] = useState(false);

    // Fetches the training if we are not already playing it
    const dbExercises = useLiveQuery(() =>
        db.exercises.where('trainingId').equals(trainingId).sortBy('order')
        , [trainingId]);

    const training = useLiveQuery(async () =>
        isFreeTraining ? { id: 0, name: 'Treino Livre', order: -1 } : await db.trainings.get(trainingId)
        , [trainingId, isFreeTraining]);

    // Initialize player if entering a new session ou se hidratou com atraso
    useEffect(() => {
        // Ignora se os dados do DB ainda não responderam
        if (dbExercises === undefined || training === undefined) return;

        const needsInit = player.trainingId !== trainingId;
        const wasHydratedEmpty = player.trainingId === trainingId && player.queue.length === 0 && dbExercises.length > 0;

        if (needsInit || wasHydratedEmpty) {
            player.startWorkout(trainingId, training.name, dbExercises);
        }
    }, [player.trainingId, trainingId, dbExercises, training, player.queue.length]);

    // Still loading from DB
    if (dbExercises === undefined || training === undefined) {
        return (
            <div className="flex flex-col items-center justify-center w-full h-full text-zinc-500 gap-4">
                <i className="fa-solid fa-circle-notch fa-spin text-4xl text-[#00FF41]"></i>
                <p className="animate-pulse">Sincronizando Banco...</p>
            </div>
        );
    }

    // Treino vazio real
    if (dbExercises.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center w-full h-full text-zinc-500 gap-4">
                <p>Este treino ainda não possui exercícios.</p>
                <button onClick={() => navigate(-1)} className="px-4 py-2 bg-zinc-800 rounded-lg text-white font-bold text-sm mt-4">
                    Voltar
                </button>
            </div>
        );
    }

    // Aguardando queue processada no context
    if (player.queue.length === 0 || player.trainingId !== trainingId) {
        return (
            <div className="flex flex-col items-center justify-center w-full h-full text-zinc-500 gap-4">
                <i className="fa-solid fa-circle-notch fa-spin text-4xl text-[#00FF41]"></i>
                <p className="animate-pulse">Preparando Player...</p>
            </div>
        );
    }

    const currentExercise = player.queue[player.currentExerciseIndex];

    // Tela de Conclusão (Fim da Fila)
    if (player.currentExerciseIndex >= player.queue.length) {
        return (
            <div className="w-full max-w-md h-full flex flex-col items-center">
                <div className="w-full flex justify-between items-center mb-4">
                    <button onClick={() => navigate('/')} className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                        <ChevronDown size={20} />
                    </button>
                    <h2 className="text-lg font-black italic tracking-tighter text-white">Finalizar</h2>
                    <div className="w-10 h-10" />
                </div>
                <WorkoutCompletionView
                    player={player}
                    onFinish={async () => {
                        await player.finishWorkout();
                        navigate('/');
                    }}
                />
            </div>
        );
    }

    const handleSetUpdate = (setIndex: number, weight: string, reps: string, rpe?: string) => {
        // Safe check se ele ta editando do exercicio ativo ou historico (neste momento só ativo)
        if (currentExercise.id) {
            player.registerSet(currentExercise.id, setIndex, weight, reps, rpe);
        }
    };

    return (
        <div className="w-full max-w-md h-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
            {/* Top Navigation & Info */}
            <div className="w-full flex justify-between items-center mb-4">
                <button
                    title="Voltar"
                    onClick={() => navigate('/')}
                    className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 active:scale-90 transition-transform"
                >
                    <ChevronDown size={20} />
                </button>
                <h2 className="text-lg font-black italic tracking-tighter truncate px-2 text-white">
                    {player.trainingName}
                </h2>
                <div className="w-10 h-10" />
            </div>

            {/* Fila / Progresso */}
            <div className="w-full flex gap-1 mb-4">
                {player.queue.map((ex, idx) => (
                    <div
                        key={idx}
                        className={`h-1.5 rounded-full flex-1 transition-all ${idx === player.currentExerciseIndex ? 'bg-[#00FF41] shadow-[0_0_10px_rgba(0,255,65,0.5)]' : idx < player.currentExerciseIndex ? 'bg-[#00FF41]/30' : 'bg-zinc-800'}`}
                    />
                ))}
            </div>

            {/* O Spotlight do Exercicio (Híbrido Consolidado) */}
            <div className="w-full flex-1 flex flex-col relative pb-4 overflow-hidden -mx-4 px-4 pt-0">

                {/* CABEÇALHO E TIMER (ÁREA FIXA) */}
                <div className="shrink-0 w-full flex flex-col items-center">
                    {/* Title */}
                    <div className="w-full flex items-center justify-between mb-2">
                        <h3 className="text-2xl font-black italic tracking-tighter uppercase whitespace-normal break-words pt-1 leading-none text-white">
                            {currentExercise.name}
                        </h3>
                        <button
                            onClick={() => setShowUpNext(true)}
                            className="h-8 px-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 transition-colors active:bg-zinc-800"
                        >
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Lista do Treino</span>
                        </button>
                    </div>

                    {/* Destaque Central: Timer (Expanded) */}
                    <div className="w-full flex flex-col items-center mb-0 px-2">
                        <Timer
                            timeLeft={player.timeLeft}
                            duration={player.duration}
                            isActive={player.isPlaying}
                            isStopwatch={player.isStopwatch}
                            stopwatchTime={player.stopwatchTime}
                            onModeChange={player.setTimerMode}
                            compact={false}
                            onToggle={() => player.togglePlayPause()}
                            onReset={player.resetTimer}
                            onAdjust={player.adjustTimer}
                        />
                        {/* Controles Compactos de Série e Timer */}
                        <div className="flex items-center justify-between gap-2 mt-0 mb-3 w-full max-w-[320px]">
                            {/* Resetar Timer */}
                            <button
                                title="Reiniciar Tempo"
                                onClick={player.resetTimer}
                                className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white active:scale-90 transition-all shrink-0"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
                            </button>

                            {/* Voltar Série */}
                            <button
                                title="Voltar Série Anterior"
                                onClick={() => player.previousSet()}
                                className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#00FF41]/80 active:text-white active:scale-90 transition-all text-xl shrink-0"
                            >
                                <SkipBack size={18} fill="currentColor" />
                            </button>

                            {/* Play/Pause Principal */}
                            <button
                                title="Play/Pause"
                                onClick={() => player.togglePlayPause()}
                                className="w-14 h-14 rounded-full bg-[#00FF41] text-black flex items-center justify-center shadow-[0_5px_20px_rgba(0,255,65,0.3)] active:scale-95 transition-transform text-2xl shrink-0"
                            >
                                {player.isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                            </button>

                            {/* Avançar Série */}
                            <button
                                title="Avançar Série"
                                onClick={() => player.completeCurrentSet()}
                                className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[#00FF41] active:text-white active:scale-90 transition-all text-xl shrink-0"
                            >
                                <SkipForward size={18} fill="currentColor" />
                            </button>

                            {/* Alternar Modo (Timer/Crono) */}
                            <button
                                title={player.isStopwatch ? "Mudar para Timer" : "Mudar para Cronômetro"}
                                onClick={() => player.setTimerMode(!player.isStopwatch)}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 shrink-0 ${player.isStopwatch ? 'bg-zinc-200 text-black shadow-lg' : 'bg-transparent text-[#00FF41] border border-[#00FF41]/50'}`}
                            >
                                {player.isStopwatch ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2h4" /><path d="M12 14v-4" /><path d="M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" /></svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* SÉRIES (ÁREA ROLÁVEL SCROLLABLE) */}
                <div className="w-full flex-1 overflow-y-auto scrollbar-hide mt-1 pt-1 border-t border-zinc-900/50 pb-20">

                    {/* PAST SETS */}
                    {player.currentSetIndex > 0 && (
                        <div className="w-full mb-2">
                            <WorkoutTracker
                                exercise={currentExercise}
                                currentSetIndex={player.currentSetIndex}
                                completedSets={player.completedSets[currentExercise.id || 0] || []}
                                actualWeights={player.actualWeights[currentExercise.id || 0] || []}
                                actualReps={player.actualReps[currentExercise.id || 0] || []}
                                actualRpes={player.actualRpes[currentExercise.id || 0] || []}
                                onSetToggle={(idx) => {
                                    if (idx === player.currentSetIndex) {
                                        const cw = player.actualWeights[currentExercise.id || 0]?.[idx];
                                        const cr = player.actualReps[currentExercise.id || 0]?.[idx];
                                        const defaultWeight = currentExercise.lastWeights?.[idx]?.toString() || "";
                                        const defaultReps = currentExercise.targetReps?.[idx] || currentExercise.setReps?.[idx] || "0";

                                        if (!cw || !cr) {
                                            player.registerSet(currentExercise.id || 0, idx, cw || defaultWeight, cr || defaultReps, player.actualRpes[currentExercise.id || 0]?.[idx]);
                                        }
                                        player.completeCurrentSet();
                                    }
                                }}
                                onRepChange={(idx, val) => handleSetUpdate(idx, player.actualWeights[currentExercise.id || 0]?.[idx] || '', val)}
                                onWeightChange={(idx, val) => handleSetUpdate(idx, val, player.actualReps[currentExercise.id || 0]?.[idx] || '')}
                                onRpeChange={(idx, val) => {
                                    const currentWeight = player.actualWeights[currentExercise.id || 0]?.[idx] || '';
                                    const currentReps = player.actualReps[currentExercise.id || 0]?.[idx] || '';
                                    player.registerSet(currentExercise.id || 0, idx, currentWeight, currentReps, val);
                                }}
                                onDeleteSet={(idx) => { }}
                                displayMode="past"
                            />
                        </div>
                    )}

                    {/* CURRENT & FUTURE SETS */}
                    <div className="w-full relative mt-1">
                        <WorkoutTracker
                            exercise={currentExercise}
                            currentSetIndex={player.currentSetIndex}
                            completedSets={player.completedSets[currentExercise.id || 0] || []}
                            actualWeights={player.actualWeights[currentExercise.id || 0] || []}
                            actualReps={player.actualReps[currentExercise.id || 0] || []}
                            actualRpes={player.actualRpes[currentExercise.id || 0] || []}
                            onSetToggle={(idx) => {
                                if (idx === player.currentSetIndex) {
                                    const cw = player.actualWeights[currentExercise.id || 0]?.[idx];
                                    const cr = player.actualReps[currentExercise.id || 0]?.[idx];
                                    const defaultWeight = currentExercise.lastWeights?.[idx]?.toString() || "";
                                    const defaultReps = currentExercise.targetReps?.[idx] || currentExercise.setReps?.[idx] || "0";

                                    if (!cw || !cr) {
                                        player.registerSet(currentExercise.id || 0, idx, cw || defaultWeight, cr || defaultReps, player.actualRpes[currentExercise.id || 0]?.[idx]);
                                    }
                                    player.completeCurrentSet();
                                }
                            }}
                            onRepChange={(idx, val) => handleSetUpdate(idx, player.actualWeights[currentExercise.id || 0]?.[idx] || '', val)}
                            onWeightChange={(idx, val) => handleSetUpdate(idx, val, player.actualReps[currentExercise.id || 0]?.[idx] || '')}
                            onRpeChange={(idx, val) => {
                                const currentWeight = player.actualWeights[currentExercise.id || 0]?.[idx] || '';
                                const currentReps = player.actualReps[currentExercise.id || 0]?.[idx] || '';
                                player.registerSet(currentExercise.id || 0, idx, currentWeight, currentReps, val);
                            }}
                            onDeleteSet={(idx) => { }}
                            displayMode="current-and-future"
                        />

                        {/* Botão de Adicionar Série Extra */}
                        <div className="w-full flex justify-center mt-3 pt-2">
                            <button
                                onClick={() => player.addExtraSet()}
                                className="flex items-center gap-2 px-4 py-2 bg-zinc-900/40 border border-[#00FF41]/20 rounded-xl text-[#00FF41]/80 font-bold text-xs uppercase tracking-widest active:scale-95 transition-all w-full justify-center"
                            >
                                <Plus size={14} strokeWidth={3} />
                                Adicionar Série Extra
                            </button>
                        </div>
                    </div>
                </div>

                {showUpNext && (
                    <UpNextList
                        onClose={() => setShowUpNext(false)}
                        onFinishWorkout={async () => {
                            if (confirm('Deseja encerrar e salvar este treino agora?')) {
                                await player.finishWorkout();
                                navigate('/');
                            }
                        }}
                    />
                )}
            </div>
        </div>
    );
};

// Componente Interno para Tela de Conclusão
const WorkoutCompletionView: React.FC<{ player: any, onFinish: () => void }> = ({ player, onFinish }) => {
    return (
        <div className="w-full flex-1 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-[#00FF41]/10 rounded-full flex items-center justify-center mb-8 border border-[#00FF41]/20">
                <i className="fa-solid fa-trophy text-5xl text-[#00FF41] drop-shadow-[0_0_15px_rgba(0,255,65,0.4)]"></i>
            </div>

            <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter mb-2">Treino Concluído</h2>
            <p className="text-zinc-500 text-sm uppercase tracking-widest font-bold mb-12">Você executou todo o protocolo.</p>

            <div className="w-full space-y-4 max-w-[280px]">
                <button
                    onClick={onFinish}
                    className="w-full py-6 bg-[#00FF41] text-black rounded-2xl flex items-center justify-center gap-4 active:scale-95 transition-all shadow-[0_10px_30px_rgba(0,255,65,0.2)]"
                >
                    <span className="text-xl font-black uppercase italic tracking-tighter">Gravar Treino</span>
                    <i className="fa-solid fa-check-double"></i>
                </button>

                <button
                    onClick={() => player.abortWorkout()}
                    className="w-full py-2 text-zinc-600 font-bold text-[10px] uppercase tracking-[0.2em] hover:text-red-500 transition-colors"
                >
                    Descartar Sessão
                </button>
            </div>
        </div>
    );
};

export default PlayerView;
