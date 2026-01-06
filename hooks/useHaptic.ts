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

    const triggerCustomPattern = async (pattern: 'heavy' | 'medium' | 'light' | 'dual' | 'triple') => {
        try {
            switch (pattern) {
                case 'heavy': await Haptics.impact({ style: ImpactStyle.Heavy }); break;
                case 'medium': await Haptics.impact({ style: ImpactStyle.Medium }); break;
                case 'light': await Haptics.impact({ style: ImpactStyle.Light }); break;
                case 'dual':
                    await Haptics.notification({ type: NotificationType.Warning });
                    break;
                case 'triple':
                    await Haptics.notification({ type: NotificationType.Error });
                    break;
            }
        } catch {
            const fb = { heavy: 100, medium: 40, light: 20, dual: [50, 50, 50], triple: [50, 30, 50, 30, 50] };
            if (navigator.vibrate) navigator.vibrate(fb[pattern] as any);
        }
    };

    return { triggerImpact, triggerNotification, triggerSelection, triggerCustomPattern };
};
