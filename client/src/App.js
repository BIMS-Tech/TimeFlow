import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import {
  Box, Typography, IconButton, Dialog, DialogTitle, DialogContent, CircularProgress,
} from '@mui/material';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';

// MUI Icons
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboardOutlined';
import GroupAddIcon from '@mui/icons-material/GroupAddOutlined';
import EditCalendarIcon from '@mui/icons-material/EditCalendarOutlined';
import CalculateIcon from '@mui/icons-material/CalculateOutlined';

import PunchClockIcon from '@mui/icons-material/PunchClockOutlined';
import FactCheckIcon from '@mui/icons-material/FactCheckOutlined';
import ManageAccountsIcon from '@mui/icons-material/ManageAccountsOutlined';
import AccountBalanceIcon from '@mui/icons-material/AccountBalanceOutlined';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLongOutlined';
import AssignmentIcon from '@mui/icons-material/AssignmentOutlined';
import CloseIcon from '@mui/icons-material/CloseOutlined';

// Auth
import { AuthProvider, useAuth } from './context/AuthContext';
import AppShell from './components/AppShell';
import { tokens } from './theme';

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

// `page` keys match server/src/utils/permissions.js — a super admin can switch
// any of these on or off per user, so nav is driven by permissions, not roles.
const NAV_ITEMS = [
  { label: 'Dashboard',             icon: <SpaceDashboardIcon />,               path: '/',            end: true, page: 'dashboard' },
  { label: 'Upload employees',      icon: <GroupAddIcon />,                  path: '/employees',   page: 'employees',       group: 'run' },
  { label: 'Create payroll period', icon: <EditCalendarIcon />,           path: '/periods',     page: 'periods',         group: 'run' },
  { label: 'Verify timesheets',     icon: <FactCheckIcon />,            path: '/wrike',       page: 'verify',          group: 'run' },
  { label: 'Process payroll',       icon: <CalculateIcon />,                path: '/generate',    page: 'process',         group: 'run' },
  { label: 'Generate bank upload',  icon: <AccountBalanceIcon />,          path: '/bank-upload', page: 'bank_upload',     group: 'run' },
  { label: 'Payslips',              icon: <ReceiptLongIcon />,                 path: '/payslips',    page: 'payslips',        group: 'run' },
  { label: 'Work timesheets',       icon: <PunchClockIcon />, path: '/wrike-raw',   page: 'work_timesheets', group: 'records' },
  { label: 'Users',                 icon: <ManageAccountsIcon />,          path: '/users',       page: 'users',           group: 'records' },
];

// The payroll run is a real sequence, so the sidebar numbers it as steps.
const NAV_GROUPS = [
  { key: undefined, label: null },
  { key: 'run',     label: 'Payroll run', steps: true },
  { key: 'records', label: 'Records' },
];

const roleLabel = (role) => (role ? role.replace(/_/g, ' ').replace(/^./, ch => ch.toUpperCase()) : '');

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

/**
 * Where to send someone who lands on a page they cannot open. Falls back to
 * their first permitted page, so unticking Dashboard actually takes effect
 * instead of bouncing everything back to it.
 */
function useHomePath() {
  const { pages } = useAuth();
  if (pages.includes('dashboard')) return '/';
  const first = NAV_ITEMS.find(item => item.page !== 'dashboard' && pages.includes(item.page));
  return first ? first.path : null;
}

function NoAccess() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 12, gap: 1 }}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>No pages enabled</Typography>
      <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
        Your account has no pages assigned. Ask a super admin to grant access.
      </Typography>
    </Box>
  );
}

function RequirePage({ page, children }) {
  const { user, can } = useAuth();
  const home = useHomePath();
  if (!user || !can(page)) return home ? <Navigate to={home} replace /> : <NoAccess />;
  return children;
}

/** The "/" route: the dashboard when permitted, otherwise their first page. */
function HomeRoute() {
  const { can } = useAuth();
  const home = useHomePath();
  if (can('dashboard')) return <Dashboard />;
  return home && home !== '/' ? <Navigate to={home} replace /> : <NoAccess />;
}

const WRIKE_FORM_URL = 'https://www.wrike.com/forms/ABC6G5BOWQCGUMDM';

function RequestFormDialog({ open, onClose }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { height: '80vh', overflow: 'hidden' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, px: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography component="span" sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '1.05rem' }}>File a request</Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close" sx={{ color: 'text.secondary' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0, position: 'relative' }}>
        {!loaded && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.paper', zIndex: 1 }}>
            <CircularProgress size={32} />
          </Box>
        )}
        <iframe
          src={WRIKE_FORM_URL}
          title="File a request"
          width="100%"
          height="100%"
          style={{ border: 'none', display: 'block' }}
          onLoad={() => setLoaded(true)}
        />
      </DialogContent>
    </Dialog>
  );
}

function AppLayout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [requestOpen, setRequestOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const visible = NAV_ITEMS.filter(item => can(item.page));
  const groups = NAV_GROUPS.map(g => ({
    label: g.label,
    steps: g.steps,
    items: visible
      .filter(item => item.group === g.key)
      .map(item => ({ key: item.path, label: item.label, icon: item.icon, to: item.path, end: item.end })),
  }));

  return (
    <AppShell
      groups={groups}
      subtitle="BIMS payroll"
      user={{ name: user?.username, role: roleLabel(user?.role) }}
      onLogout={handleLogout}
      requestAction={{ label: 'File a request', icon: <AssignmentIcon />, onClick: () => setRequestOpen(true) }}
      collapsible
    >
      <Routes>
        <Route path="/"                   element={<HomeRoute />} />
        <Route path="/employees"          element={<RequirePage page="employees"><Employees /></RequirePage>} />
        <Route path="/periods"            element={<RequirePage page="periods"><Periods /></RequirePage>} />
        <Route path="/wrike-raw"          element={<RequirePage page="work_timesheets"><WrikeTimesheets /></RequirePage>} />
        <Route path="/wrike"              element={<RequirePage page="verify"><GenerateTimesheets /></RequirePage>} />
        <Route path="/timesheet-verify"   element={<RequirePage page="verify"><GenerateTimesheet /></RequirePage>} />
        <Route path="/generate"           element={<RequirePage page="process"><TimesheetGenerator /></RequirePage>} />
        <Route path="/bank-upload"        element={<RequirePage page="bank_upload"><GenerateBankUpload /></RequirePage>} />
        <Route path="/payslips"           element={<RequirePage page="payslips"><Payslips /></RequirePage>} />
        <Route path="/users"              element={<RequirePage page="users"><UserManagement /></RequirePage>} />
        <Route path="*"                   element={<Navigate to="/" replace />} />
      </Routes>
      <RequestFormDialog open={requestOpen} onClose={() => setRequestOpen(false)} />
    </AppShell>
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
            background: tokens.ink[800],
            color: '#f3f8f9',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            fontFamily: tokens.fonts.body,
            fontSize: '0.875rem',
            fontWeight: 500,
            boxShadow: '0 12px 32px rgba(8,26,31,0.28)',
          },
          success: { iconTheme: { primary: '#4fb585', secondary: tokens.ink[800] } },
          error:   { iconTheme: { primary: '#e46a5f', secondary: tokens.ink[800] } },
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
