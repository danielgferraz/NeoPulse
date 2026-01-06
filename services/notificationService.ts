import { LocalNotifications, ActionType } from '@capacitor/local-notifications';

const ACTION_SET_COMPLETE = 'SET_COMPLETE';
const CHANNEL_ID = 'neopulse_timer';

export const NotificationService = {
    async init() {
        await LocalNotifications.requestPermissions();

        // Create Channel (Android only)
        await LocalNotifications.createChannel({
            id: CHANNEL_ID,
            name: 'Timers',
            importance: 5, // High
            description: 'Timer Notifications',
            vibration: true,
            sound: 'beep.wav'
        });

        await LocalNotifications.createChannel({
            id: 'neopulse_silent',
            name: 'Silent Updates',
            importance: 3, // Low/Default
            description: 'Silent Timer Updates',
            vibration: false,
            sound: undefined // No sound
        });

        // Register Actions
        await LocalNotifications.registerActionTypes({
            types: [
                {
                    id: 'TIMER_ACTIONS',
                    actions: [
                        {
                            id: ACTION_SET_COMPLETE,
                            title: '✅ Concluir Série',
                            foreground: true // Tries to bring app to front, false might keep in bg but limited support
                        }
                    ]
                }
            ]
        });
    },

    async showStickyNotification(title: string, body: string, id = 1001, channelId = 'neopulse_silent') {
        await LocalNotifications.schedule({
            notifications: [{
                id,
                title,
                body,
                ongoing: true, // Permanent
                autoCancel: false,
                channelId,
                smallIcon: 'ic_stat_icon_config_sample', // Android default
                actionTypeId: 'TIMER_ACTIONS'
            }]
        });
    },

    async cancel(id = 1001) {
        await LocalNotifications.cancel({ notifications: [{ id }] });
    },

    addListener(eventId: string, callback: (action: any) => void) {
        return LocalNotifications.addListener(eventId as any, callback);
    }
};
