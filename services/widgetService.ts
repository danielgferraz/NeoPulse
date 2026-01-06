import { Preferences } from '@capacitor/preferences';

export const WidgetService = {
    async sync(data: { count: number; goal: number; weight: string }) {
        try {
            await Preferences.set({
                key: 'neopulse_widget_data',
                value: JSON.stringify(data)
            });
        } catch (e) {
            console.error('Widget sync failed', e);
        }
    },

    async syncSession(data: { exercise: string; next: string; currentSet: number; totalSets: number; timerEnd: number | null } | null) {
        try {
            if (data === null) {
                await Preferences.remove({ key: 'neopulse_session_data' });
            } else {
                await Preferences.set({
                    key: 'neopulse_session_data',
                    value: JSON.stringify(data)
                });
            }
        } catch (e) {
            console.error('Session sync failed', e);
        }
    }
};
