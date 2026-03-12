import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Typography, Avatar, Divider, Chip, Tooltip, IconButton, Badge
} from '@mui/material';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';

// MUI Icons
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AddchartIcon from '@mui/icons-material/Addchart';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import LogoutIcon from '@mui/icons-material/Logout';
import AccessTimeFilledIcon from '@mui/icons-material/AccessTimeFilled';
import NotificationsIcon from '@mui/icons-material/Notifications';

// Auth
import { AuthProvider, useAuth } from './context/AuthContext';
import { timesheetAPI } from './api';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Periods from './pages/Periods';
import PendingApprovals from './pages/PendingApprovals';
import Payslips from './pages/Payslips';
import WrikeTimesheets from './pages/WrikeTimesheets';
import TimesheetGenerator from './pages/TimesheetGenerator';
import EmployeePortal from './pages/EmployeePortal';

const DRAWER_WIDTH = 268;

const NAV_ITEMS = [
  { label: 'Dashboard',          icon: <DashboardIcon />,               path: '/',         end: true },
  { label: 'Employees',          icon: <PeopleIcon />,                  path: '/employees' },
  { label: 'Pay Periods',        icon: <CalendarMonthIcon />,           path: '/periods'   },
  { label: 'Approvals',          icon: <HourglassEmptyIcon />,          path: '/pending',  countKey: 'both' },
  { label: 'Payslips',           icon: <ReceiptLongIcon />,             path: '/payslips'  },
  { label: 'Generate Timesheet', icon: <AddchartIcon />,                path: '/generate'  },
  { label: 'Wrike Timesheets',   icon: <IntegrationInstructionsIcon />, path: '/wrike'     },
];

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function SidebarNav({ counts }) {
  return (
    <List sx={{ px: 1.5 }}>
      {NAV_ITEMS.map((item) => {
        const badgeCount = item.countKey === 'both'
          ? (counts.pending || 0) + (counts.rejected || 0)
          : 0;
        const hasRejected = (counts.rejected || 0) > 0;

        return (
          <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              component={NavLink}
              to={item.path}
              end={item.end}
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
              {badgeCount > 0 && (
                <Chip
                  label={badgeCount}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    bgcolor: hasRejected ? '#ef4444' : '#f59e0b',
                    color: 'white',
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              )}
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}

function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({ pending: 0, rejected: 0 });

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await timesheetAPI.getCounts();
        if (res.success) setCounts(res.data);
      } catch {}
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'TF';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f1f5f9' }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)',
            border: 'none',
            boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
            overflowX: 'hidden',
          },
        }}
      >
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
        <Box sx={{ flex: 1, py: 1.5 }}>
          <Typography sx={{ px: 3, py: 0.75, fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Main Menu
          </Typography>
          <SidebarNav counts={counts} />
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
            <Tooltip title="Logout" arrow>
              <IconButton onClick={handleLogout} size="small"
                sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#ef4444', bgcolor: 'rgba(239,68,68,0.1)' } }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Drawer>

      {/* Main content */}
      <Box component="main" sx={{ flex: 1, p: 3, minWidth: 0 }}>
        <Routes>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/employees"  element={<Employees />} />
          <Route path="/periods"    element={<Periods />} />
          <Route path="/pending"    element={<PendingApprovals />} />
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
