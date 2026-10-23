import { createTheme, alpha } from '@mui/material/styles';

/*
 * "Cheque ink" — payroll is printed money, so the chrome borrows from security
 * paper: deep petrol ink, a brass seal, guilloché line-work (components/Guilloche)
 * used in exactly one prominent place per screen. Work surfaces stay quiet —
 * cool paper, hairline borders, tabular figures — so tables of hours and pay
 * read cleanly.
 */
export const tokens = {
  ink: { 950: '#081a1f', 900: '#0b2127', 800: '#0f2a31', 700: '#143a43', 600: '#1c4c57' },
  brass: { main: '#c9a24a', light: '#e2c47e', dark: '#9c7a2e' },
  fonts: {
    display: '"Bricolage Grotesque", "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
    body: '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
};

const LIGHT = {
  primary:   { main: '#1f6e84', light: '#4da3ba', dark: '#165566', contrastText: '#ffffff' },
  secondary: { main: '#4f67c9', light: '#7186da', dark: '#3b52b0', contrastText: '#ffffff' },
  success:   { main: '#2e9466', light: '#4fb585', dark: '#237a53', contrastText: '#ffffff' },
  warning:   { main: '#c7811a', light: '#e3aa45', dark: '#94600f', contrastText: '#ffffff' },
  error:     { main: '#c9453b', light: '#e07a72', dark: '#9a2e27', contrastText: '#ffffff' },
  info:      { main: '#3a86a8', light: '#6bb3cf', dark: '#2a6782', contrastText: '#ffffff' },
  background: { default: '#edf1f2', paper: '#ffffff' },
  subtle: '#f5f8f8',
  text: { primary: '#11282e', secondary: '#566e75', disabled: 'rgba(17,40,46,0.4)' },
  divider: '#d8e0e2',
  shadowRGB: '15,42,49',
};

const DARK = {
  primary:   { main: '#5bb0c6', light: '#86c8d9', dark: '#2f8ba3', contrastText: '#081a1f' },
  secondary: { main: '#8396e3', light: '#a3b2ec', dark: '#5f74cf', contrastText: '#081a1f' },
  success:   { main: '#4fb585', light: '#75c9a1', dark: '#2e9466', contrastText: '#081a1f' },
  warning:   { main: '#e0a23f', light: '#ebbd6f', dark: '#c7811a', contrastText: '#081a1f' },
  error:     { main: '#e46a5f', light: '#ee938b', dark: '#c9453b', contrastText: '#081a1f' },
  info:      { main: '#6bb3cf', light: '#93c8dd', dark: '#3a86a8', contrastText: '#081a1f' },
  background: { default: '#0a1a1f', paper: '#10232a' },
  subtle: '#0d1f25',
  text: { primary: '#e1ebed', secondary: '#8fa7ad', disabled: 'rgba(225,235,237,0.38)' },
  divider: '#1f3a42',
  shadowRGB: '0,0,0',
};

export function createAppTheme(mode) {
  const isDark = mode === 'dark';
  const c = isDark ? DARK : LIGHT;
  const shadow = (y, blur, a) => `0 ${y}px ${blur}px rgba(${c.shadowRGB},${isDark ? a * 2.5 : a})`;

  return createTheme({
    palette: {
      mode,
      primary: c.primary,
      secondary: c.secondary,
      success: c.success,
      warning: c.warning,
      error: c.error,
      info: c.info,
      background: c.background,
      text: c.text,
      divider: c.divider,
      action: {
        hover: alpha(c.primary.main, isDark ? 0.08 : 0.05),
        selected: alpha(c.primary.main, isDark ? 0.16 : 0.1),
        focus: alpha(c.primary.main, 0.14),
      },
      ink: tokens.ink,
      brass: tokens.brass,
      subtle: c.subtle,
    },
    typography: {
      fontFamily: tokens.fonts.body,
      h1: { fontFamily: tokens.fonts.display, fontWeight: 700, letterSpacing: '-0.03em' },
      h2: { fontFamily: tokens.fonts.display, fontWeight: 700, letterSpacing: '-0.03em' },
      h3: { fontFamily: tokens.fonts.display, fontWeight: 700, letterSpacing: '-0.025em' },
      h4: { fontFamily: tokens.fonts.display, fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontFamily: tokens.fonts.display, fontWeight: 700, fontSize: '1.625rem', lineHeight: 1.15, letterSpacing: '-0.02em' },
      h6: { fontFamily: tokens.fonts.display, fontWeight: 600, fontSize: '1.125rem', letterSpacing: '-0.01em' },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
    },
    shape: { borderRadius: 8 },
    shadows: [
      'none',
      shadow(1, 2, 0.05), shadow(1, 4, 0.06), shadow(2, 8, 0.07), shadow(4, 12, 0.08),
      shadow(8, 24, 0.1), shadow(12, 32, 0.11), shadow(16, 40, 0.12),
      ...Array.from({ length: 17 }, (_, i) => shadow(20 + i * 4, 48 + i * 8, 0.14)),
    ],
    transitions: {
      easing: { easeOut: tokens.ease },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: c.background.default,
            fontVariantNumeric: 'tabular-nums',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
          },
          '::selection': { backgroundColor: alpha(c.primary.main, 0.22) },
          '.MuiButtonBase-root.Mui-focusVisible, a:focus-visible': {
            outline: `2px solid ${c.primary.main}`,
            outlineOffset: 2,
          },
          '*::-webkit-scrollbar-thumb': { backgroundColor: isDark ? '#24434b' : '#c5d2d4' },
          '*::-webkit-scrollbar-thumb:hover': { backgroundColor: isDark ? '#2f5560' : '#8da3a9' },
          '@keyframes tfRise': {
            from: { opacity: 0, transform: 'translateY(12px) scale(0.985)' },
            to: { opacity: 1, transform: 'none' },
          },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': {
              animationDuration: '0.01ms !important',
              animationIterationCount: '1 !important',
              transitionDuration: '0.01ms !important',
            },
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: '7px 16px',
            transition: `background-color 160ms, border-color 160ms, color 160ms, box-shadow 160ms, transform 140ms ${tokens.ease}`,
            '&:active': { transform: 'scale(0.97)' },
          },
          sizeSmall: { padding: '4px 12px' },
          sizeLarge: { padding: '10px 22px' },
          outlined: {
            borderColor: c.divider,
            '&:hover': { borderColor: c.primary.main, backgroundColor: alpha(c.primary.main, 0.05) },
          },
          containedPrimary: {
            '&:hover': { boxShadow: `0 6px 16px ${alpha(c.primary.main, 0.28)}` },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            transition: `background-color 160ms, color 160ms, transform 140ms ${tokens.ease}`,
            '&:active': { transform: 'scale(0.92)' },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          rounded: { borderRadius: 12 },
          outlined: { borderColor: c.divider },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: 'none',
            border: `1px solid ${c.divider}`,
          },
        },
      },
      MuiTextField: {
        defaultProps: { variant: 'outlined', size: 'small' },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: c.background.paper,
            transition: 'box-shadow 160ms',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: c.divider, transition: 'border-color 160ms' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(c.primary.main, 0.6) },
            '&.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(c.primary.main, 0.14)}` },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 6, fontWeight: 600 },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              backgroundColor: c.subtle,
              color: c.text.secondary,
              fontWeight: 600,
              fontSize: '0.8rem',
              whiteSpace: 'nowrap',
              borderBottom: `1px solid ${c.divider}`,
            },
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '& td': { transition: 'background-color 120ms' },
            '&:hover td': { backgroundColor: alpha(c.primary.main, isDark ? 0.06 : 0.035) },
            '&:last-child td': { borderBottom: 0 },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: c.divider },
          body: { color: c.text.primary, fontSize: '0.875rem' },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 14,
            border: isDark ? `1px solid ${c.divider}` : 'none',
            boxShadow: shadow(24, 64, 0.18),
            animation: `tfRise 260ms ${tokens.ease}`,
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: { fontFamily: tokens.fonts.display, fontWeight: 700, letterSpacing: '-0.01em' },
        },
      },
      MuiBackdrop: {
        styleOverrides: {
          root: ({ ownerState }) => (ownerState.invisible ? {} : {
            backgroundColor: alpha(tokens.ink[950], isDark ? 0.6 : 0.42),
            backdropFilter: 'blur(3px)',
          }),
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            borderRadius: 10,
            border: `1px solid ${c.divider}`,
            boxShadow: shadow(12, 32, 0.12),
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: { fontSize: '0.875rem', borderRadius: 6, margin: '0 4px' },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 6,
            fontSize: '0.75rem',
            fontWeight: 500,
            backgroundColor: tokens.ink[800],
            border: isDark ? `1px solid ${c.divider}` : 'none',
            padding: '5px 9px',
          },
          arrow: { color: tokens.ink[800] },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: { borderColor: c.divider },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 10, alignItems: 'center' },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 4, backgroundColor: alpha(c.primary.main, 0.12) },
          bar: { borderRadius: 4 },
        },
      },
      MuiSkeleton: {
        styleOverrides: {
          root: { backgroundColor: alpha(c.text.primary, isDark ? 0.08 : 0.06) },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { fontWeight: 600, fontSize: '0.875rem', minHeight: 44, textTransform: 'none' },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 44 },
          indicator: { height: 2, borderRadius: 2, backgroundColor: c.primary.main },
        },
      },
    },
  });
}

// Default export for backward compat (light theme)
export default createAppTheme('light');
