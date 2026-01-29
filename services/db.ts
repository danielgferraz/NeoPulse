import Dexie, { Table } from 'dexie';

export interface Training {
    id?: number;
    name: string;
    order: number;
}

export interface Exercise {
    id?: number;
    trainingId: number;
    name: string;
    restTimes: number[];
    setReps?: string[]; // Array of actual reps performed
    targetReps?: string[]; // Planned reps (Goal)
    lastWeights?: number[];
    lastRPEs?: number[];
    notes?: string;
    order: number;
}

export interface ActiveSession {
    id: string; // 'current'
    trainingId: number;
    startTime: number;
    exerciseIndex: number;
    setIndex: number;
    completedExercises: {
        name: string;
        sets: number;
        reps?: string[];
        weights?: number[];
        rpes?: number[];
        totalDuration?: number;
    }[];
    extraExercises: Exercise[];
    completedIndices: number[];
}

export interface HistoryItem {
    id?: number;
    exerciseName: string;
    sets: number;
    timestamp: number;
    trainingName: string;
    details?: {
        name: string;
        sets: number;
        reps?: string[];
        weights?: number[];
        rpes?: number[];
    }[];
}

export interface WeightLog {
    id?: number;
    weight: number;
    timestamp: number;
}

export interface LibraryExercise {
    id: string; // 'bench_press'
    name: string;
    muscleGroup: string;
    defaultRestTime: number;
    videoUrl?: string; // YouTube link
    icon?: string; // Lucide icon name
}

class NeoPulseDB extends Dexie {
    trainings!: Table<Training>;
    exercises!: Table<Exercise>;
    history!: Table<HistoryItem>;
    weightLogs!: Table<WeightLog>;
    library!: Table<LibraryExercise>;
    activeSession!: Table<ActiveSession>;

    constructor() {
        super('NeoPulseDB');
        this.version(1).stores({
            trainings: '++id, order',
            exercises: '++id, trainingId, order',
            history: '++id, timestamp'
        });
        this.version(2).stores({
            weightLogs: '++id, timestamp'
        });
        this.version(7).stores({
            history: '++id, timestamp',
            library: 'id, name, muscleGroup'
        });
        this.version(8).stores({});
        this.version(9).stores({
            activeSession: 'id'
        });
    }

    async seed() {
        // Migration safety check - ensure library exists before accessing
        if (!this.library) {
            console.error("Critical: Library table not found even after version bump.");
            return;
        }

        const count = await this.trainings.count();
        if (count === 0) {
            const tid = await this.trainings.add({ name: 'Treino A - Peito/Tríceps', order: 0 });
            await this.exercises.bulkAdd([
                { trainingId: tid, name: 'Supino Reto', restTimes: [90, 90, 90], order: 0, notes: 'Focar na negativa' },
                { trainingId: tid, name: 'Supino Inclinado', restTimes: [90, 90, 90], order: 1 },
                { trainingId: tid, name: 'Crucifixo', restTimes: [60, 60, 60], order: 2 },
                { trainingId: tid, name: 'Tríceps Polia', restTimes: [60, 60, 60], order: 3 },
            ]);

            const tid2 = await this.trainings.add({ name: 'Treino B - Costas/Bíceps', order: 1 });
            await this.exercises.bulkAdd([
                { trainingId: tid2, name: 'Puxada Frente', restTimes: [90, 90, 90], order: 0 },
                { trainingId: tid2, name: 'Remada Baixa', restTimes: [90, 90, 90], order: 1 },
                { trainingId: tid2, name: 'Rosca Direta', restTimes: [60, 60, 60], order: 2 },
            ]);
        }

        // Library Seed
        try {
            const libraryCount = await this.library.count();
            if (libraryCount === 0) {
                // Dynamic import to avoid bundling issues if possible, though standard import is fine too
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const exerciseData = (await import('../assets/exercises.json')).default;
                await this.library.bulkAdd(exerciseData);
                console.log('Exercise Library Seeded:', exerciseData.length + ' items');
            }
        } catch (error) {
            console.error('Failed to seed exercise library:', error);
        }
    }
}

export const db = new NeoPulseDB();
