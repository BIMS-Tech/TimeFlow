import { createContext, useContext, useState, useMemo } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createAppTheme } from '../theme';

const ThemeContext = createContext({ mode: 'light', toggleTheme: () => {} });

export function useThemeMode() {
  return useContext(ThemeContext);
}

export function AppThemeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem('themeMode') || 'light');

  const toggleTheme = () => {
    setMode(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('themeMode', next);
      return next;
    });
  };

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}
