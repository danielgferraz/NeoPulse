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
    reps?: string;
    notes?: string;
    order: number;
}

export interface HistoryItem {
    id?: number;
    exerciseName: string;
    sets: number;
    timestamp: number;
    trainingName: string;
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
        this.version(5).stores({
            library: 'id, muscleGroup, name'
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
                { trainingId: tid, name: 'Supino Reto', restTimes: [90, 90, 90], order: 0, reps: '8-12', notes: 'Focar na negativa' },
                { trainingId: tid, name: 'Supino Inclinado', restTimes: [90, 90, 90], order: 1, reps: '8-12' },
                { trainingId: tid, name: 'Crucifixo', restTimes: [60, 60, 60], order: 2, reps: '10-15' },
                { trainingId: tid, name: 'Tríceps Polia', restTimes: [60, 60, 60], order: 3, reps: '12-15' },
            ]);

            const tid2 = await this.trainings.add({ name: 'Treino B - Costas/Bíceps', order: 1 });
            await this.exercises.bulkAdd([
                { trainingId: tid2, name: 'Puxada Frente', restTimes: [90, 90, 90], order: 0, reps: '8-12' },
                { trainingId: tid2, name: 'Remada Baixa', restTimes: [90, 90, 90], order: 1, reps: '8-12' },
                { trainingId: tid2, name: 'Rosca Direta', restTimes: [60, 60, 60], order: 2, reps: '10-12' },
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
