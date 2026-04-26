import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Typography, Avatar, Divider, Tooltip, IconButton, AppBar, Toolbar, useMediaQuery, useTheme,
} from '@mui/material';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';

// MUI Icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AddchartIcon from '@mui/icons-material/Addchart';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import LogoutIcon from '@mui/icons-material/Logout';
import AccessTimeFilledIcon from '@mui/icons-material/AccessTimeFilled';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import MenuIcon from '@mui/icons-material/Menu';

// Auth
import { AuthProvider, useAuth } from './context/AuthContext';
import { useThemeMode } from './context/ThemeContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Periods from './pages/Periods';
import Payslips from './pages/Payslips';
import WrikeTimesheets from './pages/WrikeTimesheets';
import TimesheetGenerator from './pages/TimesheetGenerator';
import EmployeePortal from './pages/EmployeePortal';

const DRAWER_WIDTH = 268;

const NAV_ITEMS = [
  { label: 'Dashboard',          icon: <DashboardIcon />,               path: '/',         end: true },
  { label: 'Employees',          icon: <PeopleIcon />,                  path: '/employees' },
  { label: 'Pay Periods',        icon: <CalendarMonthIcon />,           path: '/periods'   },
  { label: 'Payslips',           icon: <ReceiptLongIcon />,             path: '/payslips'  },
  { label: 'Generate Payslips',  icon: <AddchartIcon />,                path: '/generate'  },
  { label: 'Wrike Timesheets',   icon: <IntegrationInstructionsIcon />, path: '/wrike'     },
];

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function SidebarNav({ onNavigate }) {
  return (
    <List sx={{ px: 1.5 }}>
      {NAV_ITEMS.map((item) => (
        <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            component={NavLink}
            to={item.path}
            end={item.end}
            onClick={onNavigate}
            sx={{
              borderRadius: '12px',
              px: 2,
              py: 1.1,
              color: 'rgba(255,255,255,0.6)',
              transition: 'all 0.2s',
              '&.active': {
                background: 'linear-gradient(135deg, rgba(99,102,241,0.9) 0%, rgba(129,140,248,0.8) 100%)',
                color: 'white',
                boxShadow: '0 4px 15px rgba(99,102,241,0.4)',
                '& .MuiListItemIcon-root': { color: 'white' },
              },
              '&:hover:not(.active)': {
                background: 'rgba(255,255,255,0.08)',
                color: 'white',
                '& .MuiListItemIcon-root': { color: 'rgba(255,255,255,0.9)' },
              },
            }}
          >
            <ListItemIcon sx={{ color: 'rgba(255,255,255,0.5)', minWidth: 38 }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
            />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
}

function DrawerContent({ onNavigate, user, mode, toggleTheme, handleLogout }) {
  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : 'TF';
  return (
    <>
      {/* Logo */}
      <Box sx={{ px: 2.5, pt: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
          }}>
            <AccessTimeFilledIcon sx={{ color: 'white', fontSize: 22 }} />
          </Box>
          <Box>
            <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '1.2rem', lineHeight: 1.1 }}>
              Timeflow
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Payroll System
            </Typography>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 2 }} />

      {/* Navigation */}
      <Box sx={{ flex: 1, py: 1.5, overflowY: 'auto' }}>
        <Typography sx={{ px: 3, py: 0.75, fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Main Menu
        </Typography>
        <SidebarNav onNavigate={onNavigate} />
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 2 }} />

      {/* User section */}
      <Box sx={{ p: 2 }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          p: 1.5, borderRadius: '12px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <Avatar sx={{
            width: 36, height: 36, fontSize: '0.875rem', fontWeight: 700,
            background: 'linear-gradient(135deg, #6366f1, #818cf8)',
          }}>
            {initials}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ color: 'white', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.username}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', textTransform: 'capitalize' }}>
              {user?.role}
            </Typography>
          </Box>
          <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'} arrow>
            <IconButton onClick={toggleTheme} size="small"
              sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#818cf8', bgcolor: 'rgba(99,102,241,0.15)' } }}>
              {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Logout" arrow>
            <IconButton onClick={handleLogout} size="small"
              sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#ef4444', bgcolor: 'rgba(239,68,68,0.1)' } }}>
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </>
  );
}

function AppLayout() {
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const drawerProps = {
    user, mode, toggleTheme, handleLogout,
    onNavigate: isMobile ? () => setMobileOpen(false) : undefined,
  };

  const drawerContent = (
    <Box sx={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)',
    }}>
      <DrawerContent {...drawerProps} />
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>

      {/* Mobile top bar */}
      {isMobile && (
        <AppBar position="fixed" sx={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
          zIndex: theme.zIndex.drawer + 1,
        }}>
          <Toolbar sx={{ gap: 1, minHeight: { xs: 56 } }}>
            <IconButton
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ color: 'white' }}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
              <Box sx={{
                width: 30, height: 30, borderRadius: '8px',
                background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AccessTimeFilledIcon sx={{ color: 'white', fontSize: 17 }} />
              </Box>
              <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '1rem' }}>
                Timeflow
              </Typography>
            </Box>
            <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'} arrow>
              <IconButton onClick={toggleTheme} size="small" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Logout" arrow>
              <IconButton onClick={handleLogout} size="small" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </AppBar>
      )}

      {/* Sidebar — temporary on mobile, permanent on desktop */}
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              border: 'none',
              boxShadow: '4px 0 24px rgba(0,0,0,0.25)',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              border: 'none',
              boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
              overflowX: 'hidden',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          p: { xs: 2, sm: 2.5, md: 3 },
          pt: { xs: 9, md: 3 }, // push down on mobile to clear fixed AppBar
        }}
      >
        <Routes>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/employees"  element={<Employees />} />
          <Route path="/periods"    element={<Periods />} />
          <Route path="/payslips"   element={<Payslips />} />
          <Route path="/generate"   element={<TimesheetGenerator />} />
          <Route path="/wrike"      element={<WrikeTimesheets />} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </Box>
  );
}

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();
  const isEmployee = !!user?.employee_id;

  return (
    <>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              {isEmployee ? <EmployeePortal /> : <AppLayout />}
            </ProtectedRoute>
          }
        />
      </Routes>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#0f172a',
            color: '#fff',
            borderRadius: '12px',
            fontSize: '0.875rem',
            fontWeight: 500,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          },
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
