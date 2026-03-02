
import React from 'react';
import { Play, Pause, RotateCcw, Plus, Minus, Dumbbell, Sparkles, Check } from 'lucide-react';

export const COLORS = {
  primary: '#00FF41', // Matrix Green
  background: '#000000',
  card: '#111111',
  accent: '#333333'
};

export const Icons = {
  Play: () => <Play size={20} fill="currentColor" />,
  Pause: () => <Pause size={20} fill="currentColor" />,
  Rotate: () => <RotateCcw size={20} />,
  Plus: () => <Plus size={20} />,
  Minus: () => <Minus size={20} />,
  Dumbbell: () => <Dumbbell size={20} />,
  Sparkles: () => <Sparkles size={20} />,
  Check: () => <Check size={20} strokeWidth={3} />,
};
