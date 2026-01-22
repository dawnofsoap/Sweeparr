import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { settings } from '../api';

interface ThemeSettings {
  theme: 'dark' | 'light' | 'auto';
  accentColor: string;
  enableAnimations: boolean;
}

interface ThemeContextType {
  settings: ThemeSettings;
  effectiveTheme: 'dark' | 'light';
  updateSettings: (newSettings: Partial<ThemeSettings>) => void;
}

const defaultSettings: ThemeSettings = {
  theme: 'dark',
  accentColor: 'indigo',
  enableAnimations: true,
};

const ThemeContext = createContext<ThemeContextType>({
  settings: defaultSettings,
  effectiveTheme: 'dark',
  updateSettings: () => {},
});

// Accent color definitions
const accentColors: Record<string, { primary: string; hover: string; ring: string }> = {
  indigo: {
    primary: 'rgb(99, 102, 241)',    // indigo-500
    hover: 'rgb(79, 70, 229)',       // indigo-600
    ring: 'rgba(99, 102, 241, 0.5)',
  },
  blue: {
    primary: 'rgb(59, 130, 246)',    // blue-500
    hover: 'rgb(37, 99, 235)',       // blue-600
    ring: 'rgba(59, 130, 246, 0.5)',
  },
  purple: {
    primary: 'rgb(168, 85, 247)',    // purple-500
    hover: 'rgb(147, 51, 234)',      // purple-600
    ring: 'rgba(168, 85, 247, 0.5)',
  },
  green: {
    primary: 'rgb(34, 197, 94)',     // green-500
    hover: 'rgb(22, 163, 74)',       // green-600
    ring: 'rgba(34, 197, 94, 0.5)',
  },
  orange: {
    primary: 'rgb(249, 115, 22)',    // orange-500
    hover: 'rgb(234, 88, 12)',       // orange-600
    ring: 'rgba(249, 115, 22, 0.5)',
  },
  red: {
    primary: 'rgb(239, 68, 68)',     // red-500
    hover: 'rgb(220, 38, 38)',       // red-600
    ring: 'rgba(239, 68, 68, 0.5)',
  },
  pink: {
    primary: 'rgb(236, 72, 153)',    // pink-500
    hover: 'rgb(219, 39, 119)',      // pink-600
    ring: 'rgba(236, 72, 153, 0.5)',
  },
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(defaultSettings);
  const [effectiveTheme, setEffectiveTheme] = useState<'dark' | 'light'>('dark');

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settings.getGroup('ui');
        const data = response?.data || {};
        
        const loaded: ThemeSettings = {
          theme: (data['ui.theme'] as 'dark' | 'light' | 'auto') || 'dark',
          accentColor: data['ui.accentColor'] || 'indigo',
          enableAnimations: data['ui.enableAnimations'] !== 'false',
        };
        
        setThemeSettings(loaded);
      } catch (error) {
        console.error('Failed to load theme settings:', error);
        // Keep default settings on error
      }
    };
    
    loadSettings();
  }, []);

  // Apply theme when settings change
  useEffect(() => {
    const root = document.documentElement;
    
    // Determine effective theme
    let resolvedTheme: 'dark' | 'light' = 'dark';
    if (themeSettings.theme === 'auto') {
      resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      resolvedTheme = themeSettings.theme;
    }
    setEffectiveTheme(resolvedTheme);
    
    // Apply theme class to document
    root.classList.remove('theme-dark', 'theme-light');
    root.classList.add(`theme-${resolvedTheme}`);
    
    // Apply accent color CSS variables
    const accent = accentColors[themeSettings.accentColor] || accentColors.indigo;
    root.style.setProperty('--accent-primary', accent.primary);
    root.style.setProperty('--accent-hover', accent.hover);
    root.style.setProperty('--accent-ring', accent.ring);
    
    // Apply animation setting
    if (themeSettings.enableAnimations) {
      root.classList.remove('no-animations');
    } else {
      root.classList.add('no-animations');
    }
  }, [themeSettings]);

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    if (themeSettings.theme !== 'auto') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setEffectiveTheme(e.matches ? 'dark' : 'light');
      document.documentElement.classList.remove('theme-dark', 'theme-light');
      document.documentElement.classList.add(`theme-${e.matches ? 'dark' : 'light'}`);
    };
    
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [themeSettings.theme]);

  const updateSettings = (newSettings: Partial<ThemeSettings>) => {
    setThemeSettings(prev => ({ ...prev, ...newSettings }));
  };

  return (
    <ThemeContext.Provider value={{ settings: themeSettings, effectiveTheme, updateSettings }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeContext;
