
export interface ExerciseConfig {
  id: string;
  name: string;
  restTimes: number[];
}

export interface WorkoutState {
  routine: ExerciseConfig[];
  currentExerciseIndex: number;
  currentSetIndex: number;
  timeLeft: number;
  isActive: boolean;
  lastTimestamp: number;
}

export interface HistoryItem {
  id: string;
  exercise: string;
  sets: number;
  timestamp: number;
}
