import { createTheme } from '@mui/material/styles';

export function createAppTheme(mode) {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: { main: '#6366f1', light: '#818cf8', dark: '#4f46e5', contrastText: '#ffffff' },
      secondary: { main: '#0ea5e9', light: '#38bdf8', dark: '#0284c7' },
      success: { main: '#10b981', light: '#34d399', dark: '#059669' },
      warning: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
      error: { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
      background: {
        default: isDark ? '#0d1117' : '#f1f5f9',
        paper:   isDark ? '#161b22' : '#ffffff',
      },
      text: {
        primary:   isDark ? '#e2e8f0' : '#0f172a',
        secondary: isDark ? '#8b949e' : '#64748b',
      },
      divider: isDark ? '#30363d' : '#e2e8f0',
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontWeight: 700 }, h2: { fontWeight: 700 },
      h3: { fontWeight: 600 }, h4: { fontWeight: 600 },
      h5: { fontWeight: 700 }, h6: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: { borderRadius: 4 },
    shadows: [
      'none',
      '0 1px 2px rgba(0,0,0,0.05)',
      '0 1px 4px rgba(0,0,0,0.07)',
      '0 2px 8px rgba(0,0,0,0.08)',
      '0 4px 12px rgba(0,0,0,0.1)',
      '0 8px 24px rgba(0,0,0,0.12)',
      '0 12px 32px rgba(0,0,0,0.12)',
      '0 16px 40px rgba(0,0,0,0.14)',
      '0 20px 48px rgba(0,0,0,0.14)',
      '0 24px 56px rgba(0,0,0,0.16)',
      '0 28px 64px rgba(0,0,0,0.16)',
      '0 32px 72px rgba(0,0,0,0.18)',
      '0 36px 80px rgba(0,0,0,0.18)',
      '0 40px 88px rgba(0,0,0,0.20)',
      '0 44px 96px rgba(0,0,0,0.20)',
      '0 48px 104px rgba(0,0,0,0.22)',
      '0 52px 112px rgba(0,0,0,0.22)',
      '0 56px 120px rgba(0,0,0,0.24)',
      '0 60px 128px rgba(0,0,0,0.24)',
      '0 64px 136px rgba(0,0,0,0.26)',
      '0 68px 144px rgba(0,0,0,0.26)',
      '0 72px 152px rgba(0,0,0,0.28)',
      '0 76px 160px rgba(0,0,0,0.28)',
      '0 80px 168px rgba(0,0,0,0.30)',
      '0 84px 176px rgba(0,0,0,0.30)',
    ],
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            padding: '7px 18px',
            fontWeight: 600,
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          },
          containedPrimary: {
            background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
            '&:hover': { background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' },
          },
          sizeSmall: { padding: '4px 12px' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 4,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
            border: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiTextField: {
        defaultProps: { variant: 'outlined', size: 'small' },
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 4,
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#6366f1' },
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 4 },
        },
      },
      MuiSelect: {
        styleOverrides: {
          outlined: { borderRadius: 4 },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 4, fontWeight: 600 },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: ({ theme }) => ({
            '& .MuiTableCell-head': {
              backgroundColor: theme.palette.mode === 'dark' ? '#0d1117' : '#f8fafc',
              color: theme.palette.text.secondary,
              fontWeight: 700,
              fontSize: '0.72rem',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              borderBottom: `2px solid ${theme.palette.divider}`,
            },
          }),
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: ({ theme }) => ({
            '&:hover td': {
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(99,102,241,0.06)' : '#f8faff',
            },
            '&:last-child td': { border: 0 },
          }),
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: ({ theme }) => ({ borderColor: theme.palette.divider }),
          body: ({ theme }) => ({ color: theme.palette.text.primary, fontSize: '0.875rem' }),
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 6,
            boxShadow: '0 8px 40px rgba(0,0,0,0.16)',
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 4,
            fontSize: '0.72rem',
            backgroundColor: '#0f172a',
            padding: '4px 8px',
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: ({ theme }) => ({ borderColor: theme.palette.divider }),
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 4 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { fontWeight: 600, fontSize: '0.875rem', minHeight: 44 },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 44 },
          indicator: { height: 2, backgroundColor: '#6366f1' },
        },
      },
    },
  });
}

// Default export for backward compat (light theme)
export default createAppTheme('light');
