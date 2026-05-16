import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Select, MenuItem, FormControl, InputLabel, CircularProgress, Alert,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import LockResetIcon from '@mui/icons-material/LockReset';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import PersonIcon from '@mui/icons-material/Person';
import DeleteIcon from '@mui/icons-material/Delete';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import { usersAPI } from '../api';
import { useAuth } from '../context/AuthContext';

const ROLE_META = {
  super_admin:      { label: 'Super Admin',      bg: '#6366f115', color: '#6366f1' },
  hr:               { label: 'HR',               bg: '#10b98115', color: '#10b981' },
  payroll_officer:  { label: 'Payroll Officer',  bg: '#f59e0b15', color: '#f59e0b' },
};

const ALL_ROLES = ['super_admin', 'hr', 'payroll_officer'];

const TH = { fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', py: 1.5, px: 2 };
const TD = { fontSize: '0.875rem', py: 1.5, px: 2 };

function RoleChip({ role }) {
  const meta = ROLE_META[role] || { label: role, bg: '#64748b15', color: '#64748b' };
  return <Chip label={meta.label} size="small" sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 700, fontSize: '0.72rem' }} />;
}

function fmtDate(val) {
  if (!val) return 'Never';
  return new Date(val).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function PasswordField({ label, value, onChange, error }) {
  const [show, setShow] = useState(false);
  return (
    <TextField
      label={label}
      type={show ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      error={!!error}
      helperText={error || 'Minimum 6 characters'}
      fullWidth
      size="small"
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton size="small" onClick={() => setShow(s => !s)} edge="end">
              {show ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
}

const emptyAdd = { username: '', email: '', password: '', role: 'payroll_officer' };

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(false);

  // Add dialog
  const [addOpen,  setAddOpen]  = useState(false);
  const [addForm,  setAddForm]  = useState(emptyAdd);
  const [addErr,   setAddErr]   = useState({});
  const [addSaving, setAddSaving] = useState(false);

  // Edit dialog
  const [editUser,  setEditUser]  = useState(null);
  const [editForm,  setEditForm]  = useState({});
  const [editErr,   setEditErr]   = useState({});
  const [editSaving, setEditSaving] = useState(false);

  // Reset-password dialog
  const [resetUser, setResetUser] = useState(null);
  const [resetPwd,  setResetPwd]  = useState('');
  const [resetErr,  setResetErr]  = useState('');
  const [resetSaving, setResetSaving] = useState(false);

  // Delete dialog
  const [deleteUser,   setDeleteUser]   = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersAPI.getAll();
      setUsers(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Add user ──────────────────────────────────────────────────────────────
  const validateAdd = () => {
    const errs = {};
    if (!addForm.username.trim()) errs.username = 'Required';
    if (!addForm.email.trim())    errs.email    = 'Required';
    if (!addForm.password)        errs.password = 'Required';
    else if (addForm.password.length < 6) errs.password = 'Minimum 6 characters';
    if (!addForm.role)            errs.role     = 'Required';
    return errs;
  };

  const handleAdd = async () => {
    const errs = validateAdd();
    if (Object.keys(errs).length) { setAddErr(errs); return; }
    setAddSaving(true);
    try {
      await usersAPI.create(addForm);
      toast.success(`User "${addForm.username}" created`);
      setAddOpen(false);
      setAddForm(emptyAdd);
      setAddErr({});
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    } finally {
      setAddSaving(false);
    }
  };

  const openAdd = () => { setAddForm(emptyAdd); setAddErr({}); setAddOpen(true); };

  // ── Edit user ─────────────────────────────────────────────────────────────
  const openEdit = (u) => {
    setEditUser(u);
    setEditForm({ username: u.username, email: u.email, role: u.role });
    setEditErr({});
  };

  const handleEdit = async () => {
    const errs = {};
    if (!editForm.username?.trim()) errs.username = 'Required';
    if (!editForm.email?.trim())    errs.email    = 'Required';
    if (Object.keys(errs).length) { setEditErr(errs); return; }
    setEditSaving(true);
    try {
      await usersAPI.update(editUser.id, editForm);
      toast.success('User updated');
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update user');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Reset password ────────────────────────────────────────────────────────
  const openReset = (u) => { setResetUser(u); setResetPwd(''); setResetErr(''); };

  const handleReset = async () => {
    if (!resetPwd || resetPwd.length < 6) { setResetErr('Minimum 6 characters'); return; }
    setResetSaving(true);
    try {
      await usersAPI.resetPassword(resetUser.id, resetPwd);
      toast.success(`Password reset for "${resetUser.username}"`);
      setResetUser(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setResetSaving(false);
    }
  };

  // ── Delete user ───────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await usersAPI.delete(deleteUser.id);
      toast.success(`"${deleteUser.username}" deleted`);
      setDeleteUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete user');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Deactivate / Activate ─────────────────────────────────────────────────
  const handleDeactivate = async (u) => {
    try {
      await usersAPI.deactivate(u.id);
      toast.success(`"${u.username}" deactivated`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to deactivate');
    }
  };

  const handleActivate = async (u) => {
    try {
      await usersAPI.activate(u.id);
      toast.success(`"${u.username}" activated`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to activate');
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ManageAccountsIcon sx={{ color: '#6366f1', fontSize: 28 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              User Management
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 0.25 }}>
              Manage system accounts and their access levels
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openAdd}
          sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }}
        >
          Add User
        </Button>
      </Box>

      {/* Role legend */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {ALL_ROLES.map(r => <RoleChip key={r} role={r} />)}
      </Box>

      {/* Table */}
      <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        {loading ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <CircularProgress size={32} sx={{ color: '#6366f1' }} />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  <TableCell sx={{ ...TH, minWidth: 200 }}>User</TableCell>
                  <TableCell sx={{ ...TH, minWidth: 120 }}>Role</TableCell>
                  <TableCell sx={{ ...TH, minWidth: 90 }}>Status</TableCell>
                  <TableCell sx={{ ...TH, minWidth: 180 }}>Last Login</TableCell>
                  <TableCell sx={{ ...TH, minWidth: 160 }}>Created</TableCell>
                  <TableCell sx={{ ...TH, textAlign: 'right' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
                      No users found
                    </TableCell>
                  </TableRow>
                )}
                {users.map(u => {
                  const isSelf = String(u.id) === String(currentUser?.id);
                  return (
                    <TableRow key={u.id} sx={{ opacity: u.is_active ? 1 : 0.55, '&:hover': { bgcolor: 'action.hover' } }}>
                      <TableCell sx={TD}>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{u.username}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{u.email}</Typography>
                        {isSelf && <Typography sx={{ fontSize: '0.65rem', color: '#6366f1', fontWeight: 700 }}>— You</Typography>}
                      </TableCell>
                      <TableCell sx={TD}><RoleChip role={u.role} /></TableCell>
                      <TableCell sx={TD}>
                        <Chip
                          label={u.is_active ? 'Active' : 'Inactive'}
                          size="small"
                          sx={{
                            bgcolor: u.is_active ? '#10b98115' : '#ef444415',
                            color:   u.is_active ? '#10b981'   : '#ef4444',
                            fontWeight: 700, fontSize: '0.7rem',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ ...TD, color: 'text.secondary', fontSize: '0.8rem' }}>{fmtDate(u.last_login)}</TableCell>
                      <TableCell sx={{ ...TD, color: 'text.secondary', fontSize: '0.8rem' }}>{fmtDate(u.created_at)}</TableCell>
                      <TableCell sx={{ ...TD, textAlign: 'right' }}>
                        <Tooltip title="Edit user">
                          <IconButton size="small" onClick={() => openEdit(u)} sx={{ color: '#6366f1', '&:hover': { bgcolor: '#6366f110' } }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reset password">
                          <IconButton size="small" onClick={() => openReset(u)} sx={{ color: '#f59e0b', '&:hover': { bgcolor: '#f59e0b10' } }}>
                            <LockResetIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {u.is_active ? (
                          <Tooltip title={isSelf ? 'Cannot deactivate yourself' : 'Deactivate user'}>
                            <span>
                              <IconButton size="small" disabled={isSelf} onClick={() => handleDeactivate(u)} sx={{ color: '#ef4444', '&:hover': { bgcolor: '#ef444410' }, '&.Mui-disabled': { color: 'action.disabled' } }}>
                                <PersonOffIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        ) : (
                          <Tooltip title="Activate user">
                            <IconButton size="small" onClick={() => handleActivate(u)} sx={{ color: '#10b981', '&:hover': { bgcolor: '#10b98110' } }}>
                              <PersonIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title={isSelf ? 'Cannot delete yourself' : 'Delete user'}>
                          <span>
                            <IconButton size="small" disabled={isSelf} onClick={() => setDeleteUser(u)}
                              sx={{ color: '#dc2626', '&:hover': { bgcolor: '#dc262610' }, '&.Mui-disabled': { color: 'action.disabled' } }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ── Add User Dialog ────────────────────────────────────────────────── */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Add New User</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <TextField
            label="Username" value={addForm.username} size="small" fullWidth
            error={!!addErr.username} helperText={addErr.username}
            onChange={e => setAddForm(f => ({ ...f, username: e.target.value }))}
          />
          <TextField
            label="Email" type="email" value={addForm.email} size="small" fullWidth
            error={!!addErr.email} helperText={addErr.email}
            onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
          />
          <PasswordField
            label="Password"
            value={addForm.password}
            onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))}
            error={addErr.password}
          />
          <FormControl size="small" fullWidth error={!!addErr.role}>
            <InputLabel>Role</InputLabel>
            <Select label="Role" value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}>
              {ALL_ROLES.map(r => (
                <MenuItem key={r} value={r}>{ROLE_META[r]?.label || r}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
            <strong>Super Admin</strong> — full access + manage all users<br />
            <strong>HR</strong> — employee profiles, rates, timesheets; can add Payroll Officers<br />
            <strong>Payroll Officer</strong> — pay periods, payslips, bank file generation
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setAddOpen(false)} sx={{ borderRadius: '10px', textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleAdd} disabled={addSaving}
            startIcon={addSaving ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ borderRadius: '10px', textTransform: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' }}>
            {addSaving ? 'Creating…' : 'Create User'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit User Dialog ───────────────────────────────────────────────── */}
      <Dialog open={!!editUser} onClose={() => setEditUser(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Edit User</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <TextField
            label="Username" value={editForm.username || ''} size="small" fullWidth
            error={!!editErr.username} helperText={editErr.username}
            onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))}
          />
          <TextField
            label="Email" type="email" value={editForm.email || ''} size="small" fullWidth
            error={!!editErr.email} helperText={editErr.email}
            onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Role</InputLabel>
            <Select
              label="Role"
              value={editForm.role || ''}
              onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
              disabled={editUser && String(editUser.id) === String(currentUser?.id)}
            >
              {ALL_ROLES.map(r => (
                <MenuItem key={r} value={r}>{ROLE_META[r]?.label || r}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {editUser && String(editUser.id) === String(currentUser?.id) && (
            <Alert severity="warning" sx={{ fontSize: '0.8rem' }}>You cannot change your own role.</Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setEditUser(null)} sx={{ borderRadius: '10px', textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleEdit} disabled={editSaving}
            startIcon={editSaving ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ borderRadius: '10px', textTransform: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' }}>
            {editSaving ? 'Saving…' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirm Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!deleteUser} onClose={() => setDeleteUser(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Delete User</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
            Permanently delete <strong>{deleteUser?.username}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setDeleteUser(null)} sx={{ borderRadius: '10px', textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleDelete} disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon fontSize="small" />}
            sx={{ borderRadius: '10px', textTransform: 'none', bgcolor: '#dc2626', '&:hover': { bgcolor: '#b91c1c' } }}>
            {deleteLoading ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Reset Password Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!resetUser} onClose={() => setResetUser(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Reset Password</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
            Setting a new password for <strong>{resetUser?.username}</strong>.
          </Typography>
          <PasswordField
            label="New Password"
            value={resetPwd}
            onChange={e => { setResetPwd(e.target.value); setResetErr(''); }}
            error={resetErr}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setResetUser(null)} sx={{ borderRadius: '10px', textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleReset} disabled={resetSaving}
            startIcon={resetSaving ? <CircularProgress size={14} color="inherit" /> : null}
            sx={{ borderRadius: '10px', textTransform: 'none', bgcolor: '#f59e0b', '&:hover': { bgcolor: '#d97706' } }}>
            {resetSaving ? 'Updating…' : 'Reset Password'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
