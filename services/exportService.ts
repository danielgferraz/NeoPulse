import * as XLSX from 'xlsx';
import { db } from './db';

/**
 * Exports all training data to an .xlsx file with two sheets:
 *  - "Histórico"  → one row per completed set
 *  - "Treinos"    → training plan (exercises + settings)
 */
export async function exportToXlsx(): Promise<void> {
    const [history, trainings, exercises] = await Promise.all([
        db.history.orderBy('timestamp').toArray(),
        db.trainings.orderBy('order').toArray(),
        db.exercises.toArray(),
    ]);

    const wb = XLSX.utils.book_new();

    // ─── Sheet 1: Histórico ──────────────────────────────────────────────────
    type HistRow = {
        Data: string;
        Hora: string;
        Treino: string;
        Exercício: string;
        Série: number;
        Repetições: string;
        'Carga (kg)': string;
        RPE: string;
    };

    const histRows: HistRow[] = [];

    for (const item of history) {
        const date = new Date(item.timestamp);
        const dateStr = date.toLocaleDateString('pt-BR');
        const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        if (item.details && item.details.length > 0) {
            // Detailed history: iterate each exercise and each set
            for (const detail of item.details) {
                const numSets = detail.sets || 1;
                for (let s = 0; s < numSets; s++) {
                    histRows.push({
                        Data: dateStr,
                        Hora: timeStr,
                        Treino: item.trainingName ?? '',
                        Exercício: detail.name,
                        Série: s + 1,
                        Repetições: detail.reps?.[s] ?? '',
                        'Carga (kg)': detail.weights?.[s] != null ? String(detail.weights![s]) : '',
                        RPE: detail.rpes?.[s] != null ? String(detail.rpes![s]) : '',
                    });
                }
            }
        } else {
            // Legacy/minimal history entry
            histRows.push({
                Data: dateStr,
                Hora: timeStr,
                Treino: item.trainingName ?? '',
                Exercício: item.exerciseName,
                Série: item.sets,
                Repetições: '',
                'Carga (kg)': '',
                RPE: '',
            });
        }
    }

    const wsHist = XLSX.utils.json_to_sheet(histRows.length > 0 ? histRows : [
        { Data: '', Hora: '', Treino: '', Exercício: '', Série: '', Repetições: '', 'Carga (kg)': '', RPE: '' }
    ]);

    // Column widths for the history sheet
    wsHist['!cols'] = [
        { wch: 12 }, // Data
        { wch: 8 },  // Hora
        { wch: 24 }, // Treino
        { wch: 24 }, // Exercício
        { wch: 7 },  // Série
        { wch: 12 }, // Repetições
        { wch: 11 }, // Carga (kg)
        { wch: 7 },  // RPE
    ];

    XLSX.utils.book_append_sheet(wb, wsHist, 'Histórico');

    // ─── Sheet 2: Treinos ────────────────────────────────────────────────────
    type TreinoRow = {
        Treino: string;
        Exercício: string;
        Ordem: number;
        Séries: number;
        'Descanso por Série (s)': string;
        'Meta de Reps': string;
        'Último Peso (kg)': string;
        'Último RPE': string;
        Notas: string;
    };

    const treinoRows: TreinoRow[] = [];

    const trainingMap = new Map(trainings.map(t => [t.id!, t.name]));

    const sortedExercises = [...exercises].sort((a, b) => {
        if (a.trainingId !== b.trainingId) {
            const tA = trainings.findIndex(t => t.id === a.trainingId);
            const tB = trainings.findIndex(t => t.id === b.trainingId);
            return tA - tB;
        }
        return a.order - b.order;
    });

    for (const ex of sortedExercises) {
        const numSets = ex.restTimes.length;
        treinoRows.push({
            Treino: trainingMap.get(ex.trainingId) ?? '',
            Exercício: ex.name,
            Ordem: ex.order + 1,
            Séries: numSets,
            'Descanso por Série (s)': ex.restTimes.join(' / '),
            'Meta de Reps': ex.targetReps?.join(' / ') ?? '',
            'Último Peso (kg)': ex.lastWeights?.join(' / ') ?? '',
            'Último RPE': ex.lastRPEs?.join(' / ') ?? '',
            Notas: ex.notes ?? '',
        });
    }

    const wsTreinos = XLSX.utils.json_to_sheet(treinoRows.length > 0 ? treinoRows : [
        { Treino: '', Exercício: '', Ordem: '', Séries: '', 'Descanso por Série (s)': '', 'Meta de Reps': '', 'Último Peso (kg)': '', 'Último RPE': '', Notas: '' }
    ]);

    wsTreinos['!cols'] = [
        { wch: 28 }, // Treino
        { wch: 24 }, // Exercício
        { wch: 7 },  // Ordem
        { wch: 7 },  // Séries
        { wch: 22 }, // Descanso
        { wch: 16 }, // Meta de Reps
        { wch: 18 }, // Último Peso
        { wch: 12 }, // Último RPE
        { wch: 30 }, // Notas
    ];

    XLSX.utils.book_append_sheet(wb, wsTreinos, 'Treinos');

    // ─── Download ────────────────────────────────────────────────────────────
    const fileName = `neopulse_treinos_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
}
