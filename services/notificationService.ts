import { LocalNotifications, ActionType } from '@capacitor/local-notifications';
import { Capacitor, registerPlugin } from '@capacitor/core';

export interface TimerNotificationPlugin {
    startTimer(options: {
        title: string;
        body: string;
        timerStart: number;
        timerEnd: number;
        isStopwatch: boolean;
    }): Promise<void>;
    stopTimer(): Promise<void>;
}

const TimerNotification = registerPlugin<TimerNotificationPlugin>('TimerNotification');

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
                id: 'neopulse_ticker',
                name: 'Timer Realtime',
                importance: 1, // MIN - No visuals/sound during updates
                description: 'Real-time timer updates',
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

    async showStickyNotification(title: string, body: string, isPaused = false, id = 1001, channelId = 'neopulse_ticker', timerStart = 0, timerEnd = 0, isStopwatch = false) {
        if (Capacitor.getPlatform() !== 'android') return;

        if (isPaused) {
            // Fallback to static notification when paused to stop chronometer
            await LocalNotifications.schedule({
                notifications: [{
                    id,
                    title: `[PAUSADO] ${title}`,
                    body,
                    ongoing: true,
                    autoCancel: false,
                    channelId,
                    smallIcon: 'ic_stat_icon_config_sample',
                    actionTypeId: 'TIMER_ACTIONS'
                }]
            });
            return;
        }

        try {
            await TimerNotification.startTimer({
                title,
                body,
                timerStart,
                timerEnd,
                isStopwatch
            });
        } catch (e) {
            console.error('Failed to start native timer notification', e);
            // Fallback to local notifications if native plugin fails
            await LocalNotifications.schedule({
                notifications: [{
                    id,
                    title,
                    body,
                    ongoing: true,
                    autoCancel: false,
                    channelId,
                    smallIcon: 'ic_stat_icon_config_sample',
                    actionTypeId: 'TIMER_ACTIONS'
                }]
            });
        }
    },

    async cancel(id = 1001) {
        if (Capacitor.getPlatform() === 'android') {
            try {
                await TimerNotification.stopTimer();
            } catch (e) { }
        }
        await LocalNotifications.cancel({ notifications: [{ id }] });
    },

    addListener(eventId: string, callback: (action: any) => void) {
        return LocalNotifications.addListener(eventId as any, callback);
    }
};
