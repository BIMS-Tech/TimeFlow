import { useState, useEffect, useCallback } from 'react';
import { portalAPI } from '../api';
import { useThemeMode } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Box, Typography, Button, CircularProgress, Grid, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Avatar, Divider, IconButton, Tooltip, Alert, Select, MenuItem, FormControl,
  InputLabel, LinearProgress, TextField, Dialog, DialogTitle, DialogContent,
  AppBar, Toolbar
} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import KeyIcon from '@mui/icons-material/Key';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import LogoutIcon from '@mui/icons-material/Logout';
import AccessTimeFilledIcon from '@mui/icons-material/AccessTimeFilled';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import MenuIcon from '@mui/icons-material/Menu';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { getMissingBankFields } from '../utils/employeeProfile';

const DRAWER_W = 240;


const fmt = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';



const TH = { fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', py: 1.25, px: 2, bgcolor: 'action.hover' };
const TD = { fontSize: '0.875rem', py: 1.25, px: 2 };

// ─── NAV ITEMS ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard',      icon: <DashboardIcon /> },
  { key: 'payslips',  label: 'My Payslips',    icon: <ReceiptLongIcon /> },
  { key: 'profile',   label: 'My Profile',     icon: <AccountCircleIcon /> },
  { key: 'settings',  label: 'Change Password', icon: <KeyIcon /> },
];


// ─── PORTAL CATEGORY HOURS PANEL ─────────────────────────────────────────────

const CATEGORY_COLORS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6'];

function PortalCategoryHoursPanel({ timesheets }) {
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Build period options from the employee's own timesheets
  const periodOptions = [];
  const seen = new Set();
  timesheets.forEach(ts => {
    if (ts.period_id && !seen.has(ts.period_id)) {
      seen.add(ts.period_id);
      periodOptions.push({ id: ts.period_id, name: ts.period_name });
    }
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await portalAPI.getCategoryHours(selectedPeriodId || null);
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriodId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const categories = data?.categoryBreakdown || [];
  const maxHours = categories.length ? Math.max(...categories.map(c => parseFloat(c.total_hours))) : 0;

  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 0, mt: 2.5 }}>
      {/* Header */}
      <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Hours by Category</Typography>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel sx={{ fontSize: '0.8rem' }}>Period</InputLabel>
          <Select
            value={selectedPeriodId}
            label="Period"
            onChange={e => setSelectedPeriodId(e.target.value)}
            sx={{ fontSize: '0.8rem' }}
          >
            <MenuItem value=""><em>All periods</em></MenuItem>
            {periodOptions.map(p => (
              <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2.5 }}>
        {loading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

        {!loading && categories.length === 0 && (
          <Typography sx={{ color: 'text.disabled', fontSize: '0.875rem', textAlign: 'center', py: 3 }}>
            No time entries found for the selected period.
          </Typography>
        )}

        {categories.map((cat, i) => {
          const hrs = parseFloat(cat.total_hours || 0);
          const pct = maxHours > 0 ? (hrs / maxHours) * 100 : 0;
          const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
          return (
            <Box key={cat.category || i} sx={{ mb: i < categories.length - 1 ? 2 : 0 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.primary' }}>
                  {cat.category || 'Uncategorized'}
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color }}>
                  {hrs.toFixed(1)}h
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={pct}
                sx={{
                  height: 8,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 1 },
                }}
              />
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

// ─── SECTIONS ────────────────────────────────────────────────────────────────

function DashboardSection({ employee, timesheets, payslips, onNavigate }) {
  const cur = employee?.currency || '';
  const totalEarned = payslips.reduce((s, p) => s + parseFloat(p.net_amount || 0), 0);
  const totalHours  = payslips.reduce((s, p) => s + parseFloat(p.total_hours || 0), 0);
  const missingFields = employee ? getMissingBankFields(employee) : [];

  return (
    <Box>
      {/* Welcome banner */}
      {employee && (
        <Paper elevation={0} sx={{ mb: 2.5, border: '1px solid', borderColor: 'divider', borderLeft: '4px solid #6366f1', p: 2.5, display: 'flex', alignItems: 'center', gap: 2, borderRadius: 0 }}>
          <Avatar sx={{ width: 48, height: 48, bgcolor: '#6366f115', color: '#6366f1', fontWeight: 700, fontSize: '1rem', borderRadius: '4px' }}>
            {employee.name?.slice(0, 2).toUpperCase()}
          </Avatar>
          <Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Welcome back</Typography>
            <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: 'text.primary', lineHeight: 1.2 }}>{employee.name}</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.25 }}>
              {employee.employee_id} · {employee.department || 'N/A'} · {employee.position || 'N/A'}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Incomplete profile warning */}
      {missingFields.length > 0 && (
        <Paper elevation={0} sx={{ mb: 2, border: '1px solid #fbbf24', bgcolor: '#fffbeb', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, borderRadius: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <WarningAmberIcon sx={{ color: '#f59e0b', fontSize: 20, mt: 0.1, flexShrink: 0 }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#92400e' }}>Your bank profile is incomplete</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#b45309' }}>Missing: {missingFields.join(', ')}</Typography>
            </Box>
          </Box>
          <Button size="small" variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => onNavigate('profile')}
            sx={{ bgcolor: '#f59e0b', '&:hover': { bgcolor: '#d97706' }, boxShadow: 'none', flexShrink: 0 }}>
            View Profile
          </Button>
        </Paper>
      )}

      {/* Stats */}
      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        {[
          { label: 'Total Payslips', value: payslips.length, sub: 'generated', color: '#10b981', border: '#10b981' },
          { label: 'Total Earned', value: `${cur} ${totalEarned.toLocaleString()}`, sub: 'net pay', color: '#6366f1', border: '#6366f1' },
          { label: 'Total Hours', value: `${totalHours.toFixed(1)}h`, sub: 'all periods', color: '#0ea5e9', border: '#0ea5e9' },
          { label: 'Latest Payslip', value: payslips[0] ? `${cur} ${parseFloat(payslips[0].net_amount || 0).toLocaleString()}` : '—', sub: payslips[0]?.period_name || 'no payslips yet', color: '#f59e0b', border: '#f59e0b' },
        ].map(({ label, value, sub, color, border }) => (
          <Grid item xs={6} sm={3} key={label}>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderTop: `3px solid ${border}`, p: 2, borderRadius: 0 }}>
              <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>{label}</Typography>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</Typography>
              <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', mt: 0.25 }}>{sub}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Recent payslips */}
      {payslips.length > 0 && (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 0 }}>
          <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Recent Payslips</Typography>
            {payslips.length > 3 && (
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => onNavigate('payslips')} sx={{ color: '#6366f1', fontSize: '0.75rem' }}>
                View all
              </Button>
            )}
          </Box>
          {payslips.slice(0, 3).map((p, i) => (
            <Box key={p.id} sx={{ px: 2.5, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: i < 2 ? '1px solid' : 'none', borderBottomColor: i < 2 ? 'divider' : undefined }}>
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.period_name}</Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', fontFamily: 'monospace' }}>{p.payslip_number}</Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontWeight: 800, color: '#10b981', fontSize: '1rem' }}>{employee?.currency || ''} {parseFloat(p.net_amount || 0).toLocaleString()}</Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>net pay</Typography>
              </Box>
            </Box>
          ))}
        </Paper>
      )}

      {/* Category hours breakdown */}
      <PortalCategoryHoursPanel timesheets={timesheets} />
    </Box>
  );
}


function PayslipsSection({ payslips, currency }) {
  const cur = currency || '';
  const [pdfViewerUrl, setPdfViewerUrl] = useState(null);
  const [pdfViewerName, setPdfViewerName] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleViewPDF = async (p) => {
    setPdfLoading(p.id);
    try {
      const res = await portalAPI.downloadPayslipPDF(p.id);
      const blob = new Blob([res], { type: 'application/pdf' });
      setPdfViewerUrl(URL.createObjectURL(blob));
      setPdfViewerName(p.payslip_number || 'Payslip');
    } catch { toast.error('Failed to load PDF'); }
    finally { setPdfLoading(false); }
  };

  const closePdfViewer = () => {
    if (pdfViewerUrl) URL.revokeObjectURL(pdfViewerUrl);
    setPdfViewerUrl(null);
  };

  if (payslips.length === 0) return (
    <Paper elevation={0} sx={{ p: 8, border: '1px solid', borderColor: 'divider', textAlign: 'center', color: 'text.disabled', borderRadius: 0 }}>
      <ReceiptLongIcon sx={{ fontSize: 48, opacity: 0.2, mb: 1.5 }} />
      <Typography sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>No Payslips Yet</Typography>
      <Typography sx={{ fontSize: '0.875rem' }}>Payslips will appear here once generated by your administrator.</Typography>
    </Paper>
  );

  return (
    <>
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 0 }}>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {['Payslip No.', 'Period', 'Hours', 'Gross', 'Net Pay', 'Action'].map(h => <TableCell key={h} sx={TH}>{h}</TableCell>)}
            </TableRow>
          </TableHead>
          <TableBody>
            {payslips.map(p => (
              <TableRow key={p.id} sx={{ '&:hover td': { bgcolor: 'action.hover' } }}>
                <TableCell sx={{ ...TD, fontFamily: 'monospace', fontSize: '0.8rem', color: '#6366f1', fontWeight: 600 }}>{p.payslip_number}</TableCell>
                <TableCell sx={TD}>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.period_name}</Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>{fmt(p.start_date)} – {fmt(p.end_date)}</Typography>
                </TableCell>
                <TableCell sx={TD}>{parseFloat(p.total_hours || 0).toFixed(1)}h</TableCell>
                <TableCell sx={TD}>{cur} {parseFloat(p.gross_amount || 0).toLocaleString()}</TableCell>
                <TableCell sx={{ ...TD, fontWeight: 800, color: '#10b981', fontSize: '1rem' }}>{cur} {parseFloat(p.net_amount || 0).toLocaleString()}</TableCell>
                <TableCell sx={TD}>
                  <Tooltip title="View PDF">
                    <IconButton size="small" onClick={() => handleViewPDF(p)} disabled={!!pdfLoading}
                      sx={{ color: '#6366f1', '&:hover': { bgcolor: '#6366f115' } }}>
                      {pdfLoading === p.id ? <CircularProgress size={14} /> : <DownloadIcon sx={{ fontSize: 18 }} />}
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>

    {/* PDF Viewer Dialog */}
    <Dialog open={!!pdfViewerUrl} onClose={closePdfViewer} maxWidth="lg" fullWidth
      slotProps={{ paper: { sx: { borderRadius: '4px', height: '90vh' } } }}>
      <DialogTitle sx={{ fontWeight: 700, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{pdfViewerName}</span>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />}
            component="a" href={pdfViewerUrl} download={`${pdfViewerName}.pdf`}
            sx={{ borderRadius: '8px', textTransform: 'none', borderColor: 'divider', color: 'text.secondary' }}>
            Download
          </Button>
          <Button size="small" onClick={closePdfViewer}
            sx={{ borderRadius: '8px', textTransform: 'none', color: 'text.secondary' }}>
            Close
          </Button>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
        {pdfViewerUrl && (
          <iframe src={pdfViewerUrl} title={pdfViewerName}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

const EMP_TYPE_LABELS = { full_time: 'Full-Time', part_time: 'Part-Time', contractor: 'Contractor' };
const HIRE_CAT_LABELS = { local: 'Local', foreign: 'Foreign' };

const F = ({ label, field, form, setForm, xs = 12, sm = 6, type = 'text', multiline = false }) => (
  <Grid item xs={xs} sm={sm}>
    <TextField fullWidth label={label} size="small" type={type} multiline={multiline} rows={multiline ? 2 : 1}
      value={form[field] || ''}
      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
  </Grid>
);

const R = ({ label, value, xs = 12, sm = 6 }) => (
  <Grid item xs={xs} sm={sm}>
    <Box>
      <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.25 }}>{label}</Typography>
      <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: value ? 'text.primary' : 'text.disabled' }}>{value || '—'}</Typography>
    </Box>
  </Grid>
);

function ProfileSection({ employee, onUpdated }) {
  const isForeign = employee?.hire_category === 'foreign';
  const emptyForm = {
    first_name: '', last_name: '', middle_name: '',
    bank_name: '', bank_account_number: '', bank_account_name: '', bank_branch: '', bank_swift_code: '',
    remittance_type: '', beneficiary_code: '', beneficiary_address: '', bank_address: '',
    country_of_destination: '', purpose_nature: '',
    intermediary_bank_name: '', intermediary_bank_address: '', intermediary_bank_swift: '',
    payee_tin: '', payee_zip_code: '', payee_foreign_address: '', payee_foreign_zip_code: '', tax_code: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (employee) {
      setForm(Object.fromEntries(Object.keys(emptyForm).map(k => [k, employee[k] || ''])));
    }
  }, [employee]); // eslint-disable-line react-hooks/exhaustive-deps

  const missingFields = employee ? getMissingBankFields(employee) : [];

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await portalAPI.updateProfile(form);
      if (res.success) { toast.success('Profile updated'); onUpdated(res.data); }
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update profile'); }
    finally { setSaving(false); }
  };

  const SectionHeader = ({ icon, title, sub }) => (
    <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5 }}>
      {icon}
      <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
      {sub && <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', ml: 0.5 }}>— {sub}</Typography>}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 680 }}>

      {/* Completeness banner */}
      {missingFields.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, bgcolor: '#f59e0b10', border: '1px solid #f59e0b40', borderRadius: '8px', p: 1.75 }}>
          <WarningAmberIcon sx={{ fontSize: 18, color: '#f59e0b', mt: 0.1, flexShrink: 0 }} />
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#92400e' }}>Banking profile incomplete</Typography>
            <Typography sx={{ fontSize: '0.8rem', color: '#b45309' }}>Missing: {missingFields.join(', ')} — contact your administrator to update.</Typography>
          </Box>
        </Box>
      )}
      {missingFields.length === 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#10b98110', border: '1px solid #10b98140', borderRadius: '8px', p: 1.75 }}>
          <CheckCircleIcon sx={{ fontSize: 18, color: '#10b981' }} />
          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#065f46' }}>Bank profile is complete</Typography>
        </Box>
      )}

      {/* Employment Info (read-only) */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 0 }}>
        <SectionHeader icon={<AccountCircleIcon sx={{ color: '#6366f1', fontSize: 20 }} />} title="Employment Details" />
        <Box sx={{ p: 2.5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          {[
            ['Employee ID', employee?.employee_id],
            ['Full Name', employee?.name],
            ['Department', employee?.department || '—'],
            ['Position', employee?.position || '—'],
            ['Employment Type', EMP_TYPE_LABELS[employee?.employment_type] || '—'],
            ['Hire Category', HIRE_CAT_LABELS[employee?.hire_category] || '—'],
            ['Hire Date', employee?.hire_date ? new Date(employee.hire_date).toLocaleDateString() : '—'],
            ['Currency', employee?.currency || '—'],
          ].map(([label, val]) => (
            <Box key={label}>
              <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.25 }}>{label}</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{val}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Name Details */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 0 }}>
        <SectionHeader icon={<AccountCircleIcon sx={{ color: '#6366f1', fontSize: 20 }} />} title="Name Details" sub="used in bank transfer files" />
        <Box sx={{ p: 2.5 }}>
          <Grid container spacing={2}>
            <F label="First Name *" field="first_name" form={form} setForm={setForm} />
            <F label="Last Name *" field="last_name" form={form} setForm={setForm} />
            <F label="Middle Name" field="middle_name" form={form} setForm={setForm} />
          </Grid>
        </Box>
      </Paper>

      {/* Bank Details — read-only */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 0 }}>
        <SectionHeader icon={<AccountBalanceIcon sx={{ color: '#6366f1', fontSize: 20 }} />} title="Bank Details" sub="managed by admin" />
        <Box sx={{ px: 2.5, py: 1.5, bgcolor: '#f8fafc', borderBottom: '1px solid', borderBottomColor: 'divider' }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            Banking information is managed by your administrator. Contact admin if any details need to be updated.
          </Typography>
        </Box>
        <Box sx={{ p: 2.5 }}>
          <Grid container spacing={2}>
            <R label="Bank Name" value={form.bank_name} />
            <R label="Account Name" value={form.bank_account_name} />
            <R label="Account Number" value={form.bank_account_number} />
            <R label="Branch" value={form.bank_branch} />
            {isForeign && <R label="SWIFT / BIC Code" value={form.bank_swift_code} />}
            {isForeign && <R label="Bank Address" value={form.bank_address} />}
          </Grid>
        </Box>
      </Paper>

      {/* DFT / International Fields (foreign only) — read-only */}
      {isForeign && (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 0 }}>
          <SectionHeader icon={<AccountBalanceIcon sx={{ color: '#6366f1', fontSize: 20 }} />} title="International Transfer Details" sub="managed by admin" />
          <Box sx={{ p: 2.5 }}>
            <Grid container spacing={2}>
              <R label="Remittance Type" value={form.remittance_type} />
              <R label="Beneficiary Code" value={form.beneficiary_code} />
              <R label="Beneficiary Address" value={form.beneficiary_address} xs={12} sm={12} />
              <R label="Country of Destination" value={form.country_of_destination} />
              <R label="Purpose / Nature" value={form.purpose_nature} />
              <R label="Payee TIN" value={form.payee_tin} />
              <R label="Payee ZIP Code" value={form.payee_zip_code} />
              <R label="Payee Foreign Address" value={form.payee_foreign_address} xs={12} sm={12} />
              <R label="Payee Foreign ZIP" value={form.payee_foreign_zip_code} />
              <R label="Tax Code" value={form.tax_code} />
            </Grid>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.secondary', mt: 2.5, mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Intermediary Bank
            </Typography>
            <Grid container spacing={2}>
              <R label="Intermediary Bank Name" value={form.intermediary_bank_name} />
              <R label="Intermediary SWIFT" value={form.intermediary_bank_swift} />
              <R label="Intermediary Bank Address" value={form.intermediary_bank_address} xs={12} sm={12} />
            </Grid>
          </Box>
        </Paper>
      )}

      <Button variant="contained" onClick={handleSave} disabled={saving}
        sx={{ alignSelf: 'flex-start', borderRadius: '10px', textTransform: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)', px: 3 }}>
        {saving ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Save Profile'}
      </Button>
    </Box>
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
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 0 }}>
        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
              slotProps={{ input: { endAdornment: <IconButton size="small" onClick={() => setShowCurrent(v => !v)} sx={{ color: 'text.disabled' }}>{showCurrent ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}</IconButton> } }} />
            <TextField fullWidth label="New Password" type={showNew ? 'text' : 'password'} value={form.newP}
              onChange={e => setForm(f => ({ ...f, newP: e.target.value }))} required
              slotProps={{ input: { endAdornment: <IconButton size="small" onClick={() => setShowNew(v => !v)} sx={{ color: 'text.disabled' }}>{showNew ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}</IconButton> } }} />
            <TextField fullWidth label="Confirm New Password" type="password" value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} required />
            <Button type="submit" variant="contained" disabled={loading} fullWidth
              sx={{ py: 1.25, fontWeight: 700, mt: 0.5 }}>
              {loading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Change Password'}
            </Button>
          </Box>
          <Typography sx={{ mt: 2, fontSize: '0.75rem', color: 'text.disabled', p: 1.5, bgcolor: 'action.hover', borderRadius: '4px' }}>
            Forgot your password? Contact your admin — they can reset it from the Employees page.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}


// ─── MAIN PORTAL ─────────────────────────────────────────────────────────────
export default function EmployeePortal() {
  const { user, logout } = useAuth();
  const { mode, toggleTheme } = useThemeMode();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [section, setSection] = useState('dashboard');
  const [employee, setEmployee] = useState(null);
  const [timesheets, setTimesheets] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const handleLogout = () => { logout(); toast.success('Logged out'); navigate('/login'); };

  const sectionTitle = NAV_ITEMS.find(n => n.key === section)?.label || '';

  const initials = employee?.name?.slice(0, 2).toUpperCase() || user?.username?.slice(0, 2).toUpperCase() || 'ME';

  const drawerContent = (
    <>
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
                <ListItemButton onClick={() => { setSection(key); setMobileOpen(false); }} sx={{
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
          <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'} arrow>
            <IconButton size="small" onClick={toggleTheme} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#818cf8', bgcolor: 'rgba(99,102,241,0.15)' } }}>
              {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Logout" arrow>
            <IconButton size="small" onClick={handleLogout} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#ef4444', bgcolor: 'rgba(239,68,68,0.1)' } }}>
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </>
  );

  const drawerSx = {
    width: DRAWER_W, flexShrink: 0,
    '& .MuiDrawer-paper': {
      width: DRAWER_W,
      background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)',
      border: 'none',
      boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
    },
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Mobile top bar */}
      {isMobile && (
        <AppBar position="fixed" elevation={0} sx={{ bgcolor: '#0f172a', borderBottom: '1px solid rgba(255,255,255,0.08)', zIndex: theme.zIndex.drawer + 1 }}>
          <Toolbar sx={{ gap: 1.5 }}>
            <IconButton edge="start" onClick={() => setMobileOpen(v => !v)} sx={{ color: 'rgba(255,255,255,0.7)' }}>
              <MenuIcon />
            </IconButton>
            <AccessTimeFilledIcon sx={{ color: '#818cf8', fontSize: 20 }} />
            <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '1rem', flex: 1 }}>Timeflow</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>{sectionTitle}</Typography>
          </Toolbar>
        </AppBar>
      )}

      {/* Sidebar — temporary on mobile, permanent on desktop */}
      {isMobile ? (
        <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }} sx={drawerSx}>
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer variant="permanent" sx={drawerSx}>
          {drawerContent}
        </Drawer>
      )}

      {/* Main content */}
      <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 }, pt: { xs: 9, md: 3 }, minWidth: 0, overflowY: 'auto' }}>
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
          {/* Page header */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>
              {sectionTitle}
            </Typography>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
              <CircularProgress sx={{ color: '#6366f1' }} />
            </Box>
          ) : (
            <>
              {section === 'dashboard' && <DashboardSection employee={employee} timesheets={timesheets} payslips={payslips} onNavigate={setSection} />}
              {section === 'payslips'  && <PayslipsSection payslips={payslips} currency={employee?.currency} />}
              {section === 'profile'   && <ProfileSection employee={employee} onUpdated={setEmployee} />}
              {section === 'settings'  && <SettingsSection user={user} />}
            </>
          )}
        </Box>
      </Box>

    </Box>
  );
}
