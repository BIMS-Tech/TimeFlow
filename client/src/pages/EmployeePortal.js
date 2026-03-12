import { useState, useEffect, useCallback } from 'react';
import { portalAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Box, Typography, Button, Chip, CircularProgress, Grid, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Avatar, Divider, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, IconButton, Tooltip, Alert
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import KeyIcon from '@mui/icons-material/Key';
import LogoutIcon from '@mui/icons-material/Logout';
import AccessTimeFilledIcon from '@mui/icons-material/AccessTimeFilled';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

const DRAWER_W = 240;
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const STATUS = {
  pending:  { color: '#f59e0b', bg: '#f59e0b18', label: 'Pending' },
  approved: { color: '#10b981', bg: '#10b98118', label: 'Approved' },
  rejected: { color: '#ef4444', bg: '#ef444418', label: 'Rejected' },
};

function StatusChip({ status }) {
  const s = STATUS[status] || STATUS.pending;
  return <Chip label={s.label} size="small" sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: '0.72rem', borderRadius: '4px' }} />;
}

const TH = { fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', py: 1.25, px: 2, bgcolor: '#f8fafc' };
const TD = { fontSize: '0.875rem', py: 1.25, px: 2 };

// ─── NAV ITEMS ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { key: 'dashboard',  label: 'Dashboard',      icon: <DashboardIcon /> },
  { key: 'timesheets', label: 'My Timesheets',   icon: <DescriptionIcon /> },
  { key: 'payslips',   label: 'My Payslips',     icon: <ReceiptLongIcon /> },
  { key: 'settings',   label: 'Change Password', icon: <KeyIcon /> },
];

// ─── TIMESHEET ROW (expandable) ───────────────────────────────────────────────
function TimesheetRow({ ts, currency, onApprove, onReject }) {
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);
  const cur = currency || 'BDT';
  const token = localStorage.getItem('token');

  return (
    <>
      <TableRow sx={{ cursor: 'pointer', bgcolor: expanded ? '#f8faff' : 'white' }} onClick={() => setExpanded(v => !v)}>
        <TableCell sx={TD}><StatusChip status={ts.approval_status} /></TableCell>
        <TableCell sx={{ ...TD, fontWeight: 600 }}>{ts.period_name}</TableCell>
        <TableCell sx={TD}>{fmt(ts.start_date)} – {fmt(ts.end_date)}</TableCell>
        <TableCell sx={{ ...TD, fontWeight: 600 }}>{parseFloat(ts.total_hours || 0).toFixed(1)}h</TableCell>
        <TableCell sx={{ ...TD, fontWeight: 700, color: '#0f172a' }}>{cur} {parseFloat(ts.gross_amount || 0).toLocaleString()}</TableCell>
        <TableCell sx={TD}>
          <IconButton size="small" sx={{ color: '#94a3b8' }}>{expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}</IconButton>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6} sx={{ p: 0, bgcolor: '#f8faff', borderBottom: '1px solid #e2e8f0' }}>
            <Box sx={{ p: 2.5 }}>
              {/* Detail tiles */}
              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                {[
                  ['Regular Hours', `${parseFloat(ts.regular_hours || 0).toFixed(1)}h`],
                  ['Overtime Hours', `${parseFloat(ts.overtime_hours || 0).toFixed(1)}h`],
                  ['Hourly Rate', `${cur} ${parseFloat(ts.hourly_rate || 0).toFixed(2)}`],
                  ['Gross Amount', `${cur} ${parseFloat(ts.gross_amount || 0).toLocaleString()}`],
                  ['Status', ts.approval_status],
                  ts.approved_at ? ['Approved On', fmt(ts.approved_at)] : ['Submitted', fmt(ts.created_at)],
                ].map(([label, val]) => (
                  <Grid item xs={6} sm={4} md={2} key={label}>
                    <Box sx={{ bgcolor: 'white', border: '1px solid #e2e8f0', p: 1.25 }}>
                      <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8', mb: 0.25, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</Typography>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', textTransform: 'capitalize' }}>{val}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>

              {ts.rejection_reason && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: '4px' }}><strong>Rejection Reason:</strong> {ts.rejection_reason}</Alert>
              )}

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button size="small" variant="outlined" startIcon={<DownloadIcon />}
                  component="a" href={`${API_BASE}/portal/timesheets/${ts.id}/csv?token=${token}`} rel="noopener noreferrer"
                  sx={{ borderColor: '#e2e8f0', color: '#475569', '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
                  Download CSV
                </Button>
                {ts.approval_status === 'pending' && (
                  <>
                    <Button size="small" variant="contained" startIcon={acting ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <CheckCircleIcon />}
                      onClick={async (e) => { e.stopPropagation(); setActing(true); try { await onApprove(ts); } finally { setActing(false); } }}
                      disabled={acting}
                      sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, background: 'none', backgroundColor: '#10b981' }}>
                      Approve
                    </Button>
                    <Button size="small" variant="outlined" startIcon={<CancelIcon />}
                      onClick={(e) => { e.stopPropagation(); onReject(ts); }}
                      sx={{ borderColor: '#ef4444', color: '#ef4444', '&:hover': { bgcolor: '#ef444408' } }}>
                      Reject
                    </Button>
                  </>
                )}
              </Box>
            </Box>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── SECTIONS ────────────────────────────────────────────────────────────────

function DashboardSection({ employee, timesheets, payslips, onNavigate }) {
  const cur = employee?.currency || 'BDT';
  const pending  = timesheets.filter(t => t.approval_status === 'pending');
  const approved = timesheets.filter(t => t.approval_status === 'approved');
  const totalEarned = approved.reduce((s, t) => s + parseFloat(t.gross_amount || 0), 0);
  const totalHours  = approved.reduce((s, t) => s + parseFloat(t.total_hours || 0), 0);

  return (
    <Box>
      {/* Welcome banner */}
      {employee && (
        <Paper elevation={0} sx={{ mb: 2.5, border: '1px solid #e2e8f0', borderLeft: '4px solid #6366f1', p: 2.5, display: 'flex', alignItems: 'center', gap: 2, borderRadius: 0 }}>
          <Avatar sx={{ width: 48, height: 48, bgcolor: '#6366f115', color: '#6366f1', fontWeight: 700, fontSize: '1rem', borderRadius: '4px' }}>
            {employee.name?.slice(0, 2).toUpperCase()}
          </Avatar>
          <Box>
            <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Welcome back</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: '#0f172a', lineHeight: 1.2 }}>{employee.name}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
              {employee.employee_id} · {employee.department || 'N/A'} · {employee.position || 'N/A'}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Stats */}
      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        {[
          { label: 'Pending Review', value: pending.length, sub: 'timesheets', color: '#f59e0b', border: '#f59e0b' },
          { label: 'Total Approved', value: approved.length, sub: 'timesheets', color: '#10b981', border: '#10b981' },
          { label: 'Total Earned', value: `${cur} ${totalEarned.toLocaleString()}`, sub: 'gross (approved)', color: '#6366f1', border: '#6366f1' },
          { label: 'Total Hours', value: `${totalHours.toFixed(1)}h`, sub: 'approved periods', color: '#0ea5e9', border: '#0ea5e9' },
        ].map(({ label, value, sub, color, border }) => (
          <Grid item xs={6} sm={3} key={label}>
            <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderTop: `3px solid ${border}`, p: 2, borderRadius: 0 }}>
              <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>{label}</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</Typography>
              <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', mt: 0.25 }}>{sub}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Pending action alert */}
      {pending.length > 0 && (
        <Paper elevation={0} sx={{ mb: 2, border: '1px solid #fbbf24', bgcolor: '#fffbeb', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <HourglassEmptyIcon sx={{ color: '#f59e0b', fontSize: 20 }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#92400e' }}>{pending.length} timesheet{pending.length > 1 ? 's' : ''} awaiting your review</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#b45309' }}>Please review and approve or reject</Typography>
            </Box>
          </Box>
          <Button size="small" variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => onNavigate('timesheets')}
            sx={{ bgcolor: '#f59e0b', '&:hover': { bgcolor: '#d97706' }, background: 'none', backgroundColor: '#f59e0b', boxShadow: 'none' }}>
            Review Now
          </Button>
        </Paper>
      )}

      {/* Recent payslips */}
      {payslips.length > 0 && (
        <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 0, overflow: 'hidden' }}>
          <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Recent Payslips</Typography>
            {payslips.length > 3 && (
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => onNavigate('payslips')} sx={{ color: '#6366f1', fontSize: '0.75rem' }}>
                View all
              </Button>
            )}
          </Box>
          {payslips.slice(0, 3).map((p, i) => (
            <Box key={p.id} sx={{ px: 2.5, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none' }}>
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.period_name}</Typography>
                <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>{p.payslip_number}</Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontWeight: 800, color: '#10b981', fontSize: '1rem' }}>{employee?.currency || 'BDT'} {parseFloat(p.net_amount || 0).toLocaleString()}</Typography>
                <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8' }}>net pay</Typography>
              </Box>
            </Box>
          ))}
        </Paper>
      )}
    </Box>
  );
}

function TimesheetsSection({ timesheets, currency, onApprove, onReject }) {
  const pending  = timesheets.filter(t => t.approval_status === 'pending');
  const approved = timesheets.filter(t => t.approval_status === 'approved');
  const rejected = timesheets.filter(t => t.approval_status === 'rejected');

  if (timesheets.length === 0) return (
    <Paper elevation={0} sx={{ p: 8, border: '1px solid #e2e8f0', textAlign: 'center', color: '#94a3b8', borderRadius: 0 }}>
      <DescriptionIcon sx={{ fontSize: 48, opacity: 0.2, mb: 1.5 }} />
      <Typography sx={{ fontWeight: 600, color: '#475569', mb: 0.5 }}>No Timesheets Yet</Typography>
      <Typography sx={{ fontSize: '0.875rem' }}>Your manager will send timesheets for your review.</Typography>
    </Paper>
  );

  const groups = [
    { label: 'Pending Your Review', color: '#f59e0b', items: pending },
    { label: 'Approved', color: '#10b981', items: approved },
    { label: 'Rejected', color: '#ef4444', items: rejected },
  ].filter(g => g.items.length > 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {groups.map(({ label, color, items }) => (
        <Box key={label}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Box sx={{ width: 3, height: 16, bgcolor: color, borderRadius: 0 }} />
            <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color }}>{label} ({items.length})</Typography>
          </Box>
          <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 0, overflow: 'hidden' }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Status', 'Period', 'Dates', 'Hours', 'Gross', ''].map(h => <TableCell key={h} sx={TH}>{h}</TableCell>)}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map(ts => <TimesheetRow key={ts.id} ts={ts} currency={currency} onApprove={onApprove} onReject={onReject} />)}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      ))}
    </Box>
  );
}

function PayslipsSection({ payslips, currency }) {
  const cur = currency || 'BDT';
  const token = localStorage.getItem('token');

  if (payslips.length === 0) return (
    <Paper elevation={0} sx={{ p: 8, border: '1px solid #e2e8f0', textAlign: 'center', color: '#94a3b8', borderRadius: 0 }}>
      <ReceiptLongIcon sx={{ fontSize: 48, opacity: 0.2, mb: 1.5 }} />
      <Typography sx={{ fontWeight: 600, color: '#475569', mb: 0.5 }}>No Payslips Yet</Typography>
      <Typography sx={{ fontSize: '0.875rem' }}>Payslips are generated after your timesheet is approved.</Typography>
    </Paper>
  );

  return (
    <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 0, overflow: 'hidden' }}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              {['Payslip No.', 'Period', 'Hours', 'Gross', 'Net Pay', 'Action'].map(h => <TableCell key={h} sx={TH}>{h}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            {payslips.map(p => (
              <TableRow key={p.id} sx={{ '&:hover td': { bgcolor: '#f8faff' } }}>
                <TableCell sx={{ ...TD, fontFamily: 'monospace', fontSize: '0.8rem', color: '#6366f1', fontWeight: 600 }}>{p.payslip_number}</TableCell>
                <TableCell sx={TD}>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.period_name}</Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>{fmt(p.start_date)} – {fmt(p.end_date)}</Typography>
                </TableCell>
                <TableCell sx={TD}>{parseFloat(p.total_hours || 0).toFixed(1)}h</TableCell>
                <TableCell sx={TD}>{cur} {parseFloat(p.gross_amount || 0).toLocaleString()}</TableCell>
                <TableCell sx={{ ...TD, fontWeight: 800, color: '#10b981', fontSize: '1rem' }}>{cur} {parseFloat(p.net_amount || 0).toLocaleString()}</TableCell>
                <TableCell sx={TD}>
                  {p.pdf_path && (
                    <Tooltip title="Download PDF">
                      <IconButton size="small" component="a" href={`${API_BASE}/portal/payslips/${p.id}/pdf?token=${token}`} target="_blank" rel="noopener noreferrer"
                        sx={{ color: '#6366f1', '&:hover': { bgcolor: '#6366f115' } }}>
                        <DownloadIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

function SettingsSection({ user }) {
  const [form, setForm] = useState({ current: '', newP: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newP !== form.confirm) return toast.error('New passwords do not match');
    if (form.newP.length < 6) return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      await portalAPI.changePassword(form.current, form.newP);
      toast.success('Password changed successfully');
      setForm({ current: '', newP: '', confirm: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 440 }}>
      <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 0, overflow: 'hidden' }}>
        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <KeyIcon sx={{ color: '#6366f1', fontSize: 20 }} />
          <Typography sx={{ fontWeight: 700 }}>Change Password</Typography>
        </Box>
        <Box sx={{ p: 2.5 }}>
          <Alert severity="info" sx={{ mb: 2.5, borderRadius: '4px' }}>
            Logged in as <strong>{user?.username}</strong>
          </Alert>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField fullWidth label="Current Password" type={showCurrent ? 'text' : 'password'} value={form.current}
              onChange={e => setForm(f => ({ ...f, current: e.target.value }))} required
              slotProps={{ input: { endAdornment: <IconButton size="small" onClick={() => setShowCurrent(v => !v)} sx={{ color: '#94a3b8' }}>{showCurrent ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}</IconButton> } }} />
            <TextField fullWidth label="New Password" type={showNew ? 'text' : 'password'} value={form.newP}
              onChange={e => setForm(f => ({ ...f, newP: e.target.value }))} required
              slotProps={{ input: { endAdornment: <IconButton size="small" onClick={() => setShowNew(v => !v)} sx={{ color: '#94a3b8' }}>{showNew ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}</IconButton> } }} />
            <TextField fullWidth label="Confirm New Password" type="password" value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} required />
            <Button type="submit" variant="contained" disabled={loading} fullWidth
              sx={{ py: 1.25, fontWeight: 700, mt: 0.5 }}>
              {loading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Change Password'}
            </Button>
          </Box>
          <Typography sx={{ mt: 2, fontSize: '0.75rem', color: '#94a3b8', p: 1.5, bgcolor: '#f8fafc', borderRadius: '4px' }}>
            Forgot your password? Contact your admin — they can reset it from the Employees page.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

// ─── REJECT DIALOG ────────────────────────────────────────────────────────────
function RejectDialog({ timesheet, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return toast.error('Please provide a reason');
    setLoading(true);
    try { await onConfirm(reason, files); onClose(); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={!!timesheet} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Reject Timesheet</DialogTitle>
      <DialogContent>
        <Typography sx={{ color: '#64748b', fontSize: '0.875rem', mb: 2 }}>
          Period: <strong>{timesheet?.period_name}</strong>
        </Typography>
        <TextField fullWidth multiline rows={4} label="Reason *" placeholder="Describe the issue or discrepancy…"
          value={reason} onChange={e => setReason(e.target.value)} sx={{ mb: 2 }} />
        <Box>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1 }}>Supporting files (optional)</Typography>
          <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, border: '1px dashed #cbd5e1', cursor: 'pointer', color: '#64748b', fontSize: '0.875rem', '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
            <UploadFileIcon sx={{ fontSize: 18 }} /> Attach files
            <input type="file" multiple hidden onChange={e => setFiles(Array.from(e.target.files))} />
          </Box>
          {files.length > 0 && (
            <Box sx={{ mt: 1 }}>
              {files.map((f, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.5 }}>
                  <AttachFileIcon sx={{ fontSize: 14, color: '#94a3b8' }} />
                  <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>{f.name}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: '#64748b' }}>Cancel</Button>
        <Button variant="contained" startIcon={loading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <CancelIcon />}
          onClick={handleSubmit} disabled={loading}
          sx={{ bgcolor: '#ef4444', '&:hover': { bgcolor: '#dc2626' }, background: 'none', backgroundColor: '#ef4444' }}>
          Submit Rejection
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── MAIN PORTAL ─────────────────────────────────────────────────────────────
export default function EmployeePortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState('dashboard');
  const [employee, setEmployee] = useState(null);
  const [timesheets, setTimesheets] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, tsRes, psRes] = await Promise.all([portalAPI.getMe(), portalAPI.getTimesheets(), portalAPI.getPayslips()]);
      setEmployee(empRes.data);
      setTimesheets(tsRes.data || []);
      setPayslips(psRes.data || []);
    } catch { toast.error('Failed to load portal data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (ts) => {
    try {
      await portalAPI.approve(ts.id);
      toast.success('Timesheet approved!');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Approval failed'); }
  };

  const handleRejectConfirm = async (reason, files) => {
    try {
      await portalAPI.reject(rejectTarget.id, reason, files);
      toast.success('Rejection submitted.');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Rejection failed'); }
  };

  const handleLogout = () => { logout(); toast.success('Logged out'); navigate('/login'); };

  const pendingCount = timesheets.filter(t => t.approval_status === 'pending').length;
  const sectionTitle = NAV_ITEMS.find(n => n.key === section)?.label || '';

  const initials = employee?.name?.slice(0, 2).toUpperCase() || user?.username?.slice(0, 2).toUpperCase() || 'ME';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f1f5f9' }}>
      {/* Sidebar */}
      <Drawer variant="permanent" sx={{
        width: DRAWER_W, flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_W,
          background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)',
          border: 'none',
          boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
        },
      }}>
        {/* Logo */}
        <Box sx={{ px: 2.5, pt: 3, pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 36, height: 36, bgcolor: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}>
              <AccessTimeFilledIcon sx={{ color: '#818cf8', fontSize: 20 }} />
            </Box>
            <Box>
              <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '1rem', lineHeight: 1.1 }}>Timeflow</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Employee Portal</Typography>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 2 }} />

        {/* Nav */}
        <Box sx={{ flex: 1, py: 1.5 }}>
          <Typography sx={{ px: 3, py: 0.75, fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            My Portal
          </Typography>
          <List sx={{ px: 1.5 }}>
            {NAV_ITEMS.map(({ key, label, icon }) => {
              const active = section === key;
              return (
                <ListItem key={key} disablePadding sx={{ mb: 0.25 }}>
                  <ListItemButton onClick={() => setSection(key)} sx={{
                    borderRadius: '4px', px: 2, py: 1,
                    color: active ? 'white' : 'rgba(255,255,255,0.55)',
                    background: active ? 'linear-gradient(135deg, rgba(99,102,241,0.9) 0%, rgba(129,140,248,0.8) 100%)' : 'transparent',
                    boxShadow: active ? '0 2px 12px rgba(99,102,241,0.4)' : 'none',
                    '&:hover:not([aria-selected="true"])': { bgcolor: 'rgba(255,255,255,0.07)', color: 'white' },
                    transition: 'all 0.15s',
                  }}>
                    <ListItemIcon sx={{ color: active ? 'white' : 'rgba(255,255,255,0.4)', minWidth: 36 }}>
                      {icon}
                    </ListItemIcon>
                    <ListItemText primary={label} sx={{ '& .MuiListItemText-primary': { fontSize: '0.875rem', fontWeight: active ? 700 : 500 } }} />
                    {key === 'timesheets' && pendingCount > 0 && (
                      <Chip label={pendingCount} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800, bgcolor: '#f59e0b', color: 'white', '& .MuiChip-label': { px: 0.75 } }} />
                    )}
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 2 }} />

        {/* User */}
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Avatar sx={{ width: 32, height: 32, fontSize: '0.75rem', fontWeight: 700, bgcolor: 'rgba(99,102,241,0.3)', color: '#818cf8', borderRadius: '4px' }}>
              {initials}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ color: 'white', fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {employee?.name || user?.username}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.65rem' }}>Employee</Typography>
            </Box>
            <Tooltip title="Logout" arrow>
              <IconButton size="small" onClick={handleLogout} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#ef4444', bgcolor: 'rgba(239,68,68,0.1)' } }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Drawer>

      {/* Main content */}
      <Box component="main" sx={{ flex: 1, p: 3, minWidth: 0, overflowY: 'auto' }}>
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
          {/* Page header */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              {sectionTitle}
            </Typography>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
              <CircularProgress sx={{ color: '#6366f1' }} />
            </Box>
          ) : (
            <>
              {section === 'dashboard'  && <DashboardSection employee={employee} timesheets={timesheets} payslips={payslips} onNavigate={setSection} />}
              {section === 'timesheets' && <TimesheetsSection timesheets={timesheets} currency={employee?.currency} onApprove={handleApprove} onReject={setRejectTarget} />}
              {section === 'payslips'   && <PayslipsSection payslips={payslips} currency={employee?.currency} />}
              {section === 'settings'   && <SettingsSection user={user} />}
            </>
          )}
        </Box>
      </Box>

      <RejectDialog timesheet={rejectTarget} onClose={() => setRejectTarget(null)} onConfirm={handleRejectConfirm} />
    </Box>
  );
}
