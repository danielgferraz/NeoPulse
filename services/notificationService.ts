import { LocalNotifications, ActionType } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

const ACTION_SET_COMPLETE = 'SET_COMPLETE';
const ACTION_PAUSE = 'PAUSE_TIMER';
const ACTION_RESET = 'RESET_TIMER';
const CHANNEL_ID = 'neopulse_timer';

export const NotificationService = {
    async init() {
        const isPushEnabled = await LocalNotifications.requestPermissions();
        if (isPushEnabled.display !== 'granted') return;

        if (Capacitor.getPlatform() === 'android') {
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
                id: 'neopulse_realtime',
                name: 'Silent Updates',
                importance: 2, // Low - Stop flashing/beeping on update
                description: 'Silent Timer Updates',
                vibration: false,
                sound: undefined
            });

            // Register Actions
            await LocalNotifications.registerActionTypes({
                types: [
                    {
                        id: 'TIMER_ACTIONS',
                        actions: [
                            {
                                id: ACTION_PAUSE,
                                title: '⏸ Pausar',
                                foreground: true
                            },
                            {
                                id: ACTION_RESET,
                                title: '🔄 Zerar',
                                foreground: true
                            },
                            {
                                id: ACTION_SET_COMPLETE,
                                title: '✅ Concluir',
                                foreground: true
                            }
                        ]
                    }
                ]
            });
        }
    },

    async showStickyNotification(title: string, body: string, isPaused = false, id = 1001, channelId = 'neopulse_realtime') {
        if (Capacitor.getPlatform() === 'web') return; // Desktop doesn't support ongoing sticky notifications easily

        await LocalNotifications.schedule({
            notifications: [{
                id,
                title,
                body,
                ongoing: true, // Permanent
                autoCancel: false,
                channelId,
                smallIcon: 'ic_stat_icon_config_sample',
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
