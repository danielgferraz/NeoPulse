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
    order: number;
}

export interface HistoryItem {
    id?: number;
    exerciseName: string;
    sets: number;
    timestamp: number;
    trainingName: string;
}

class NeoPulseDB extends Dexie {
    trainings!: Table<Training>;
    exercises!: Table<Exercise>;
    history!: Table<HistoryItem>;

    constructor() {
        super('NeoPulseDB');
        this.version(1).stores({
            trainings: '++id, order',
            exercises: '++id, trainingId, order',
            history: '++id, timestamp'
        });
    }

    async seed() {
        const count = await this.trainings.count();
        if (count === 0) {
            const tid = await this.trainings.add({ name: 'Treino A - Peito/Tríceps', order: 0 });
            await this.exercises.bulkAdd([
                { trainingId: tid, name: 'Supino Reto', restTimes: [90, 90, 90], order: 0 },
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
    }
}

export const db = new NeoPulseDB();
