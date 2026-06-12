import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Typography, Avatar, Divider, Tooltip, IconButton, AppBar, Toolbar, useMediaQuery, useTheme,
  Dialog, DialogTitle, DialogContent, CircularProgress,
} from '@mui/material';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';

// MUI Icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AddchartIcon from '@mui/icons-material/Addchart';

import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import PublishIcon from '@mui/icons-material/Publish';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LogoutIcon from '@mui/icons-material/Logout';
import AccessTimeFilledIcon from '@mui/icons-material/AccessTimeFilled';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

// Auth
import { AuthProvider, useAuth } from './context/AuthContext';
import { useThemeMode } from './context/ThemeContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Periods from './pages/Periods';
import Payslips from './pages/Payslips';

import TimesheetGenerator from './pages/TimesheetGenerator';
import GenerateTimesheet from './pages/GenerateTimesheet';
import UserManagement from './pages/UserManagement';
import EmployeePortal from './pages/EmployeePortal';
import GenerateBankUpload from './pages/GenerateBankUpload';
import GenerateTimesheets from './pages/GenerateTimesheets';
import WrikeTimesheets from './pages/WrikeTimesheets';

const DRAWER_WIDTH = 268;
const DRAWER_WIDTH_COLLAPSED = 68;

const NAV_ITEMS = [
  { label: 'Dashboard',             icon: <DashboardIcon />,               path: '/',               end: true },
  { label: 'Upload Employees',      icon: <PeopleIcon />,                  path: '/employees',      roles: ['super_admin', 'hr'] },
  { label: 'Create Payroll Period', icon: <CalendarMonthIcon />,           path: '/periods',        roles: ['super_admin', 'payroll_officer', 'accounting_manager'] },
  { label: 'Verify Timesheet',      icon: <VerifiedUserIcon />,            path: '/wrike',          roles: ['super_admin', 'payroll_officer', 'accounting_manager'] },
  { label: 'Process Payroll',       icon: <AddchartIcon />,                path: '/generate',       roles: ['super_admin', 'payroll_officer', 'accounting_manager'] },
  { label: 'Generate Bank Upload',  icon: <AccountBalanceIcon />,          path: '/bank-upload',    roles: ['super_admin', 'accounting_manager'] },
  { label: 'Payslips',              icon: <PublishIcon />,                 path: '/payslips',       roles: ['super_admin', 'payroll_officer', 'accounting_manager'] },
  { label: 'Work Timesheets',       icon: <IntegrationInstructionsIcon />, path: '/wrike-raw',      roles: ['super_admin'] },
  { label: 'Users',                 icon: <ManageAccountsIcon />,          path: '/users',          roles: ['super_admin'] },
];

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function RequireRole({ roles, children }) {
  const { user } = useAuth();
  const effectiveRole = user?.role === 'admin' ? 'super_admin' : user?.role;
  if (!user || !roles.includes(effectiveRole)) return <Navigate to="/" replace />;
  return children;
}

function SidebarNav({ onNavigate, collapsed }) {
  const { user } = useAuth();
  // Legacy 'admin' role (pre-migration tokens) maps to super_admin for nav purposes
  const effectiveRole = user?.role === 'admin' ? 'super_admin' : user?.role;
  const visibleItems = NAV_ITEMS.filter(item => !item.roles || item.roles.includes(effectiveRole));
  return (
    <List sx={{ px: collapsed ? 0.75 : 1.5 }}>
      {visibleItems.map((item) => (
        <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
          <Tooltip title={collapsed ? item.label : ''} placement="right" arrow>
            <ListItemButton
              component={NavLink}
              to={item.path}
              end={item.end}
              onClick={onNavigate}
              sx={{
                borderRadius: '12px',
                px: collapsed ? 1.5 : 2,
                py: 1.1,
                justifyContent: collapsed ? 'center' : 'flex-start',
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
              <ListItemIcon sx={{ color: 'rgba(255,255,255,0.5)', minWidth: collapsed ? 0 : 38 }}>
                {item.icon}
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 500 }}
                />
              )}
            </ListItemButton>
          </Tooltip>
        </ListItem>
      ))}
    </List>
  );
}

const WRIKE_FORM_URL = 'https://www.wrike.com/forms/ABC6G5BOWQCGUMDM';

function RequestFormDialog({ open, onClose }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: '16px', height: '80vh', overflow: 'hidden' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, px: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>File a Request</Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0, position: 'relative' }}>
        {!loaded && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.paper', zIndex: 1 }}>
            <CircularProgress size={32} sx={{ color: '#10b981' }} />
          </Box>
        )}
        <iframe
          src={WRIKE_FORM_URL}
          title="File a Request"
          width="100%"
          height="100%"
          style={{ border: 'none', display: 'block' }}
          onLoad={() => setLoaded(true)}
        />
      </DialogContent>
    </Dialog>
  );
}

function DrawerContent({ onNavigate, user, mode, toggleTheme, handleLogout, onOpenRequest, collapsed, onToggleCollapse }) {
  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : 'TF';
  return (
    <>
      {/* Logo + collapse toggle */}
      <Box sx={{ px: collapsed ? 1 : 2.5, pt: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 1.5 }}>
            <Tooltip title={collapsed ? 'Timeflow' : ''} placement="right" arrow>
              <Box sx={{
                width: 40, height: 40, borderRadius: '12px', flexShrink: 0,
                background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
              }}>
                <AccessTimeFilledIcon sx={{ color: 'white', fontSize: 22 }} />
              </Box>
            </Tooltip>
            {!collapsed && (
              <Box>
                <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '1.2rem', lineHeight: 1.1 }}>
                  Timeflow
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Payroll System
                </Typography>
              </Box>
            )}
          </Box>
          {!collapsed && (
            <Tooltip title="Collapse menu" placement="right" arrow>
              <IconButton onClick={onToggleCollapse} size="small"
                sx={{ color: 'rgba(255,255,255,0.35)', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.08)' } }}>
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
        {collapsed && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1.5 }}>
            <Tooltip title="Expand menu" placement="right" arrow>
              <IconButton onClick={onToggleCollapse} size="small"
                sx={{ color: 'rgba(255,255,255,0.35)', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.08)' } }}>
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 2 }} />

      {/* Navigation */}
      <Box sx={{ flex: 1, py: 1.5, overflowY: 'auto' }}>
        {!collapsed && (
          <Typography sx={{ px: 3, py: 0.75, fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Main Menu
          </Typography>
        )}
        <SidebarNav onNavigate={onNavigate} collapsed={collapsed} />
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 2 }} />

      {/* Request / Suggestions */}
      <Box sx={{ px: collapsed ? 0.75 : 2, py: 1.5 }}>
        <Tooltip title={collapsed ? 'File a Request' : ''} placement="right" arrow>
          <Box
            onClick={onOpenRequest}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              px: collapsed ? 1.5 : 2, py: 1.1,
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: '12px', cursor: 'pointer',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(5,150,105,0.12) 100%)',
              border: '1px solid rgba(16,185,129,0.25)',
              transition: 'all 0.2s',
              '&:hover': { background: 'linear-gradient(135deg, rgba(16,185,129,0.28) 0%, rgba(5,150,105,0.22) 100%)', borderColor: 'rgba(16,185,129,0.5)' },
            }}
          >
            <OpenInNewIcon sx={{ fontSize: 16, color: '#10b981', flexShrink: 0 }} />
            {!collapsed && (
              <Typography sx={{ color: '#10b981', fontSize: '0.82rem', fontWeight: 700, flex: 1 }}>
                File a Request
              </Typography>
            )}
          </Box>
        </Tooltip>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 2 }} />

      {/* User section */}
      <Box sx={{ p: collapsed ? 1 : 2 }}>
        {collapsed ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <Tooltip title={user?.username || ''} placement="right" arrow>
              <Avatar sx={{
                width: 36, height: 36, fontSize: '0.875rem', fontWeight: 700,
                background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                cursor: 'default',
              }}>
                {initials}
              </Avatar>
            </Tooltip>
            <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'} placement="right" arrow>
              <IconButton onClick={toggleTheme} size="small"
                sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#818cf8', bgcolor: 'rgba(99,102,241,0.15)' } }}>
                {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Logout" placement="right" arrow>
              <IconButton onClick={handleLogout} size="small"
                sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#ef4444', bgcolor: 'rgba(239,68,68,0.1)' } }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
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
        )}
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
  const [mobileOpen,       setMobileOpen]       = useState(false);
  const [requestOpen,      setRequestOpen]      = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const currentDrawerWidth = sidebarCollapsed ? DRAWER_WIDTH_COLLAPSED : DRAWER_WIDTH;

  const drawerProps = {
    user, mode, toggleTheme, handleLogout,
    onNavigate: isMobile ? () => setMobileOpen(false) : undefined,
    onOpenRequest: () => setRequestOpen(true),
    collapsed: !isMobile && sidebarCollapsed,
    onToggleCollapse: () => setSidebarCollapsed(v => !v),
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
            <Tooltip title="File a Request" arrow>
              <IconButton onClick={() => setRequestOpen(true)} size="small" sx={{ color: '#10b981' }}>
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
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
            width: currentDrawerWidth,
            flexShrink: 0,
            transition: theme.transitions.create('width', { easing: theme.transitions.easing.sharp, duration: theme.transitions.duration.enteringScreen }),
            '& .MuiDrawer-paper': {
              width: currentDrawerWidth,
              border: 'none',
              boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
              overflowX: 'hidden',
              transition: theme.transitions.create('width', { easing: theme.transitions.easing.sharp, duration: theme.transitions.duration.enteringScreen }),
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
          <Route path="/"                   element={<Dashboard />} />
          <Route path="/employees"          element={<RequireRole roles={['super_admin', 'hr']}><Employees /></RequireRole>} />
          <Route path="/periods"            element={<RequireRole roles={['super_admin', 'payroll_officer', 'accounting_manager']}><Periods /></RequireRole>} />
          <Route path="/wrike-raw"          element={<RequireRole roles={['super_admin']}><WrikeTimesheets /></RequireRole>} />
          <Route path="/wrike"              element={<RequireRole roles={['super_admin', 'payroll_officer', 'accounting_manager']}><GenerateTimesheets /></RequireRole>} />
          <Route path="/timesheet-verify"   element={<RequireRole roles={['super_admin', 'payroll_officer', 'accounting_manager']}><GenerateTimesheet /></RequireRole>} />
          <Route path="/generate"           element={<RequireRole roles={['super_admin', 'payroll_officer', 'accounting_manager']}><TimesheetGenerator /></RequireRole>} />
          <Route path="/bank-upload"        element={<RequireRole roles={['super_admin', 'accounting_manager']}><GenerateBankUpload /></RequireRole>} />
          <Route path="/payslips"           element={<RequireRole roles={['super_admin', 'payroll_officer', 'accounting_manager']}><Payslips /></RequireRole>} />
          <Route path="/users"              element={<RequireRole roles={['super_admin']}><UserManagement /></RequireRole>} />
          <Route path="*"                   element={<Navigate to="/" replace />} />
        </Routes>
      </Box>

      <RequestFormDialog open={requestOpen} onClose={() => setRequestOpen(false)} />
    </Box>
  );
}

function AppRoutes() {
  const { isAuthenticated, user } = useAuth();
  const isEmployee = user?.role === 'employee' || !!user?.employee_id;

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
