import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeName = 'neo' | 'purple' | 'orange' | 'blue';
export type SoundMode = 'beep' | 'voice' | 'silent';

interface Theme {
    name: ThemeName;
    primary: string; // The neon color
    label: string;
}

export const themes: Record<ThemeName, Theme> = {
    neo: { name: 'neo', primary: '#00FF41', label: 'Neo Green' },
    purple: { name: 'purple', primary: '#D946EF', label: 'Cyber Purple' },
    orange: { name: 'orange', primary: '#F97316', label: 'Plasma Orange' },
    blue: { name: 'blue', primary: '#0EA5E9', label: 'Deep Blue' },
};

export type HapticPattern = 'heavy' | 'medium' | 'light' | 'dual' | 'triple';

interface ThemeContextType {
    theme: Theme;
    setTheme: (name: ThemeName) => void;
    soundMode: SoundMode;
    setSoundMode: (mode: SoundMode) => void;
    monthlyGoal: number;
    setMonthlyGoal: (goal: number) => void;
    hapticPattern: HapticPattern;
    setHapticPattern: (pattern: HapticPattern) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [themeName, setThemeName] = useState<ThemeName>(() => {
        return (localStorage.getItem('neopulse_theme') as ThemeName) || 'neo';
    });

    const [soundMode, setSoundModeState] = useState<SoundMode>(() => {
        return (localStorage.getItem('neopulse_sound_mode') as SoundMode) || 'beep';
    });

    const [monthlyGoal, setMonthlyGoalToggle] = useState<number>(() => {
        return parseInt(localStorage.getItem('neopulse_monthly_goal') || '12');
    });

    const [hapticPattern, setHapticPatternState] = useState<HapticPattern>(() => {
        return (localStorage.getItem('neopulse_haptic_pattern') as HapticPattern) || 'medium';
    });

    const setTheme = (name: ThemeName) => {
        setThemeName(name);
        localStorage.setItem('neopulse_theme', name);
        document.documentElement.style.setProperty('--primary', themes[name].primary);
    };

    const setSoundMode = (mode: SoundMode) => {
        setSoundModeState(mode);
        localStorage.setItem('neopulse_sound_mode', mode);
    };

    const setMonthlyGoal = (goal: number) => {
        setMonthlyGoalToggle(goal);
        localStorage.setItem('neopulse_monthly_goal', goal.toString());
    };

    const setHapticPattern = (pattern: HapticPattern) => {
        setHapticPatternState(pattern);
        localStorage.setItem('neopulse_haptic_pattern', pattern);
    };

    useEffect(() => {
        // Init CSS var on load
        document.documentElement.style.setProperty('--primary', themes[themeName].primary);
    }, []);

    return (
        <ThemeContext.Provider value={{
            theme: themes[themeName],
            setTheme,
            soundMode,
            setSoundMode,
            monthlyGoal,
            setMonthlyGoal,
            hapticPattern,
            setHapticPattern
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
};
