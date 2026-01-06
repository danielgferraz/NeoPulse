import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const useHaptic = () => {
    const triggerImpact = async (style: ImpactStyle = ImpactStyle.Medium) => {
        try {
            await Haptics.impact({ style });
        } catch {
            // Fallback for web
            if (navigator.vibrate) navigator.vibrate(20);
        }
    };

    const triggerNotification = async (type: NotificationType = NotificationType.Success) => {
        try {
            await Haptics.notification({ type });
        } catch {
            if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
        }
    };

    const triggerSelection = async () => {
        try {
            await Haptics.selectionStart(); // changed from selectionChanged which is deprecated/different in some versions, actually selectionStart matches docs often or just impact light
            // standard is selectionStart or simplify to impact light
            await Haptics.impact({ style: ImpactStyle.Light });
        } catch {
            if (navigator.vibrate) navigator.vibrate(10);
        }
    };

    return { triggerImpact, triggerNotification, triggerSelection };
};
