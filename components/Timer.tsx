
import React, { useEffect, useRef } from 'react';
import { Icons } from '../constants';
import { useHaptic } from '../hooks/useHaptic';

interface TimerProps {
  timeLeft: number;
  isActive: boolean;
  duration: number; // Duração total para o arco de progresso
  onToggle: () => void;
  onReset: () => void;
  onAdjust: (delta: number) => void;
  soundMode?: 'beep' | 'voice' | 'silent';
  hapticPattern?: 'heavy' | 'medium' | 'light' | 'dual' | 'triple';
  isStopwatch?: boolean;
}

const Timer: React.FC<TimerProps> = ({ timeLeft, isActive, duration, onToggle, onReset, onAdjust, soundMode = 'beep', hapticPattern = 'medium', isStopwatch = false }) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastBeepedTime = useRef<number>(-1);

  const playBeep = (frequency: number = 880, dur: number = 0.1, volume: number = 0.1) => {
    if (soundMode !== 'beep') return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch (e) {
      console.warn("Feedback de áudio falhou", e);
    }
  };

  const speak = (text: string) => {
    if (soundMode !== 'voice') return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.2;
    u.lang = 'en-US'; // Or pt-BR, numbers are universal enough or specific
    window.speechSynthesis.speak(u);
  };

  const playAlarm = async () => {
    if (soundMode === 'voice') {
      speak("Ready to go!");
      return;
    }
    if (soundMode === 'silent') return;

    const notes = [880, 1100, 1320];
    for (const note of notes) {
      playBeep(note, 0.4, 0.2);
      await new Promise(r => setTimeout(r, 200));
    }
  };

  const { triggerCustomPattern } = useHaptic();

  // Feedback sonoro e vibração controlados pelo componente visual
  useEffect(() => {
    if (isActive) {
      if (timeLeft <= 3 && timeLeft > 0 && timeLeft !== lastBeepedTime.current) {
        if (soundMode === 'voice') speak(String(timeLeft));
        else playBeep(440, 0.05);
        lastBeepedTime.current = timeLeft;
      }
      if (timeLeft === 0 && lastBeepedTime.current !== 0) {
        playAlarm();
        triggerCustomPattern(hapticPattern);
        lastBeepedTime.current = 0;
      }
    }
  }, [timeLeft, isActive, soundMode, hapticPattern, triggerCustomPattern]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const percentage = isStopwatch ? 0 : (timeLeft / duration) * 100;
  const isUrgent = timeLeft <= 10 && timeLeft > 0;

  const size = 272;
  const center = size / 2;
  const radius = center - 8;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-sm mx-auto select-none">
      <div className="relative flex items-center justify-center mb-8" style={{ width: size, height: size }}>
        <div className={`absolute inset-0 rounded-full blur-3xl transition-all duration-1000 opacity-20 ${isActive ? (isUrgent ? 'bg-red-500 scale-110' : 'bg-[#00FF41] scale-105') : 'bg-transparent'
          }`} />

        <svg viewBox={`0 0 ${size} ${size}`} className="absolute w-full h-full -rotate-90">
          <circle cx={center} cy={center} r={radius} stroke="#111" strokeWidth="4" fill="transparent" />
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="currentColor"
            strokeWidth="10"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (circumference * Math.min(percentage, 100)) / 100}
            strokeLinecap="round"
            className={`transition-all duration-1000 ease-linear ${isUrgent ? 'text-red-500' : (timeLeft > duration ? 'text-purple-500' : 'text-[#00FF41]')
              }`}
          />
        </svg>

        <div className="flex flex-col items-center justify-center z-10 w-full">
          <span className={`text-8xl mono font-black tracking-tighter transition-colors ${isUrgent ? 'text-red-500' : 'text-white'}`}>
            {formatTime(timeLeft)}
          </span>
          <span className="text-[10px] font-black text-zinc-600 tracking-[0.4em] uppercase mt-1">
            {isActive ? 'DESCANSO' : 'PRONTO'}
          </span>
        </div>
      </div>

      <div className="flex gap-3 w-full max-w-[272px] mb-8">
        <button
          onClick={onReset}
          className="w-12 h-12 bg-zinc-900/80 rounded-2xl text-zinc-500 flex items-center justify-center border border-zinc-800 active:scale-90 transition-all"
          title="Reiniciar"
        >
          <Icons.Rotate />
        </button>

        <button
          title={isActive ? "Pausar" : "Iniciar"}
          onClick={onToggle}
          className={`flex-1 h-12 rounded-2xl flex items-center justify-center text-black font-black text-xs tracking-widest transition-all shadow-xl active:scale-95 ${isActive ? 'bg-zinc-200' : 'bg-[#00FF41]'
            }`}
        >
          {isActive ? (
            <><Icons.Pause /><span className="ml-2 uppercase">PAUSAR</span></>
          ) : (
            <><Icons.Play /><span className="ml-2 uppercase">INICIAR</span></>
          )}
        </button>
      </div>

      <div className="flex items-center gap-6">
        <button onClick={() => onAdjust(-30)} className="text-[10px] font-bold text-zinc-700 hover:text-zinc-400 transition-colors uppercase">-30s</button>
        <button onClick={() => onAdjust(-10)} className="text-[10px] font-bold text-zinc-700 hover:text-zinc-400 transition-colors uppercase">-10s</button>
        <div className="w-1 h-1 bg-zinc-800 rounded-full"></div>
        <button onClick={() => onAdjust(10)} className="text-[10px] font-bold text-zinc-700 hover:text-zinc-400 transition-colors uppercase">+10s</button>
        <button onClick={() => onAdjust(30)} className="text-[10px] font-bold text-zinc-700 hover:text-zinc-400 transition-colors uppercase">+30s</button>
      </div>
    </div>
  );
};

export default Timer;
