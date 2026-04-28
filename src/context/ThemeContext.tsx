import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SETTINGS_KEY = 'app_settings_v1';

export interface AppSettings {
  darkMode: boolean;
  remindersEnabled: boolean;
}

const defaultSettings: AppSettings = {
  darkMode: false,
  remindersEnabled: true,
};

export interface Theme {
  background: string;
  card: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  accent: string;
  danger: string;
  green: string;
  input: string;
  segment: string;
  segmentActive: string;
  header: string;
  placeholder: string;
  badge: string;
  badgeText: string;
  isDark: boolean;
}

const light: Theme = {
  background: '#F2F2F7',
  card: '#FFFFFF',
  textPrimary: '#1C1C1E',
  textSecondary: '#8E8E93',
  border: '#E5E5EA',
  accent: '#007AFF',
  danger: '#FF3B30',
  green: '#34C759',
  input: '#FFFFFF',
  segment: '#E5E5EA',
  segmentActive: '#FFFFFF',
  header: '#FFFFFF',
  placeholder: '#C7C7CC',
  badge: '#F2F2F7',
  badgeText: '#8E8E93',
  isDark: false,
};

const dark: Theme = {
  background: '#1C1C1E',
  card: '#2C2C2E',
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  border: '#3A3A3C',
  accent: '#0A84FF',
  danger: '#FF453A',
  green: '#30D158',
  input: '#2C2C2E',
  segment: '#3A3A3C',
  segmentActive: '#48484A',
  header: '#1C1C1E',
  placeholder: '#636366',
  badge: '#3A3A3C',
  badgeText: '#8E8E93',
  isDark: true,
};

interface ContextValue {
  theme: Theme;
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
}

const ThemeContext = createContext<ContextValue>({
  theme: light,
  settings: defaultSettings,
  updateSettings: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then(json => {
      if (json) setSettings({ ...defaultSettings, ...JSON.parse(json) });
    });
  }, []);

  const updateSettings = (patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme: settings.darkMode ? dark : light, settings, updateSettings }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
