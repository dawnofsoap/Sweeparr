import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { settings } from '../api';

interface UISettings {
  theme: 'dark' | 'light' | 'auto';
  enableAnimations: boolean;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  timezone: string;
  pageSize: number;
  showPosters: boolean;
  expandedByDefault: boolean;
}

const defaultSettings: UISettings = {
  theme: 'auto',
  enableAnimations: true,
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12h',
  timezone: 'auto',
  pageSize: 25,
  showPosters: true,
  expandedByDefault: false,
};

interface UIContextType {
  settings: UISettings;
  updateSettings: (newSettings: Partial<UISettings>) => void;
  refreshSettings: () => Promise<void>;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
  const [uiSettings, setUISettings] = useState<UISettings>(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  const loadSettings = async () => {
    try {
      const response = await settings.getGroup('ui');
      const data = response?.data || {};

      const loaded: UISettings = {
        theme: (data['ui.theme'] as UISettings['theme']) || 'auto',
        enableAnimations: data['ui.enableAnimations'] !== 'false',
        dateFormat: data['ui.dateFormat'] || 'MM/DD/YYYY',
        timeFormat: (data['ui.timeFormat'] as '12h' | '24h') || '12h',
        timezone: data['ui.timezone'] || 'auto',
        pageSize: parseInt(data['ui.pageSize']) || 25,
        showPosters: data['ui.showPosters'] !== 'false',
        expandedByDefault: data['ui.expandedByDefault'] === 'true',
      };

      setUISettings(loaded);
    } catch (error) {
      console.error('Failed to load UI settings:', error);
      // Keep default settings on error
    } finally {
      setLoaded(true);
    }
  };

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    
    // Determine actual theme
    let actualTheme = uiSettings.theme;
    if (actualTheme === 'auto') {
      actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // Apply theme class
    if (actualTheme === 'light') {
      root.classList.add('light-theme');
      root.classList.remove('dark-theme');
    } else {
      root.classList.add('dark-theme');
      root.classList.remove('light-theme');
    }

    // Listen for system theme changes when in auto mode
    if (uiSettings.theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        if (e.matches) {
          root.classList.add('dark-theme');
          root.classList.remove('light-theme');
        } else {
          root.classList.add('light-theme');
          root.classList.remove('dark-theme');
        }
      };
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [uiSettings.theme]);

  // Apply animations
  useEffect(() => {
    const root = document.documentElement;
    if (uiSettings.enableAnimations) {
      root.classList.remove('no-animations');
    } else {
      root.classList.add('no-animations');
    }
  }, [uiSettings.enableAnimations]);

  const updateSettings = (newSettings: Partial<UISettings>) => {
    setUISettings(prev => ({ ...prev, ...newSettings }));
  };

  const refreshSettings = async () => {
    await loadSettings();
  };

  // Don't render children until settings are loaded to prevent flash
  if (!loaded) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <UIContext.Provider value={{ settings: uiSettings, updateSettings, refreshSettings }}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}

// Helper to format dates according to user preferences
export function formatDate(date: Date | string, format: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  switch (format) {
    case 'DD/MM/YYYY':
      return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    case 'DD MMM YYYY':
      return `${day} ${monthNames[d.getMonth()]} ${year}`;
    case 'MMM DD, YYYY':
      return `${monthNames[d.getMonth()]} ${day}, ${year}`;
    case 'MM/DD/YYYY':
    default:
      return `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`;
  }
}

// Helper to format times according to user preferences
export function formatTime(date: Date | string, format: '12h' | '24h'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  const hours = d.getHours();
  const minutes = d.getMinutes();
  
  if (format === '24h') {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  } else {
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  }
}
