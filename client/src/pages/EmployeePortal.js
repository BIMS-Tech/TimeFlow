import { useState, useEffect, useCallback } from 'react';
import { portalAPI } from '../api';
import AppShell from '../components/AppShell';
import { tokens } from '../theme';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Box, Typography, Button, CircularProgress, Grid, Paper,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Avatar, IconButton, Tooltip, Alert, Select, MenuItem, FormControl,
  InputLabel, LinearProgress, TextField, Skeleton,
} from '@mui/material';
import SpaceDashboardIcon from '@mui/icons-material/SpaceDashboardOutlined';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLongOutlined';
import LockResetIcon from '@mui/icons-material/LockResetOutlined';
import BadgeIcon from '@mui/icons-material/BadgeOutlined';
import AccountBalanceIcon from '@mui/icons-material/AccountBalanceOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForwardOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmberOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutlined';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOffOutlined';
import { getMissingBankFields } from '../utils/employeeProfile';
import { formatHM, formatHoursAsHM } from '../utils/time';

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const TH = { fontSize: '0.8rem', fontWeight: 600, color: 'text.secondary', py: 1.25, px: 2, bgcolor: 'action.hover' };
const TD = { fontSize: '0.875rem', py: 1.5, px: 2 };

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard',       icon: <SpaceDashboardIcon /> },
  { key: 'payslips',  label: 'My Payslips',     icon: <ReceiptLongIcon /> },
  { key: 'profile',   label: 'My Profile',      icon: <BadgeIcon /> },
  { key: 'settings',  label: 'Change Password', icon: <LockResetIcon /> },
];

const CATEGORY_COLORS = ['#2a7f96','#4f67c9','#2e9466','#d08c1e','#d04a40','#8a63b8','#c25a87','#2f9c94'];

// ─── CATEGORY HOURS ───────────────────────────────────────────────────────────
function PortalCategoryHoursPanel({ timesheets }) {
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

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
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [selectedPeriodId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const categories = data?.categoryBreakdown || [];
  const maxHours = categories.length ? Math.max(...categories.map(c => parseFloat(c.total_hours))) : 0;

  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '16px', mt: 2.5, overflow: 'hidden' }}>
      <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Hours by Category</Typography>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel sx={{ fontSize: '0.8rem' }}>Period</InputLabel>
          <Select value={selectedPeriodId} label="Period" onChange={e => setSelectedPeriodId(e.target.value)}
            sx={{ fontSize: '0.8rem', borderRadius: '10px' }}>
            <MenuItem value=""><em>All periods</em></MenuItem>
            {periodOptions.map(p => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>
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
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{cat.category || 'Uncategorized'}</Typography>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color }}>{formatHoursAsHM(hrs)}</Typography>
              </Box>
              <LinearProgress variant="determinate" value={pct} sx={{
                height: 8, borderRadius: 1, bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 1 },
              }} />
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function DashboardSection({ employee, timesheets, payslips, onNavigate }) {
  const cur = employee?.currency || '';
  const totalEarned = payslips.reduce((s, p) => s + parseFloat(p.net_amount || 0), 0);
  const totalMinutes = payslips.reduce((s, p) => s + (p.total_minutes != null ? parseInt(p.total_minutes,10) : Math.round((parseFloat(p.total_hours)||0)*60)), 0);
  const missingFields = employee ? getMissingBankFields(employee) : [];

  return (
    <Box>
      {/* Welcome banner */}
      {employee && (
        <Paper elevation={0} sx={{
          mb: 2.5, borderRadius: '16px', overflow: 'hidden',
          background: 'linear-gradient(135deg, #2a7f96 0%, #4da3ba 100%)',
          boxShadow: '0 8px 24px rgba(42,127,150,0.25)',
        }}>
          <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar sx={{ width: 52, height: 52, bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 800, fontSize: '1.1rem', borderRadius: '14px' }}>
              {employee.name?.slice(0, 2).toUpperCase()}
            </Avatar>
            <Box>
              <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)' }}>Welcome back</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.25rem', color: 'white', lineHeight: 1.2 }}>{employee.name}</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', mt: 0.25 }}>
                {employee.employee_id} · {employee.department || 'N/A'} · {employee.position || 'N/A'}
              </Typography>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Incomplete profile warning */}
      {missingFields.length > 0 && (
        <Paper elevation={0} sx={{ mb: 2, borderRadius: '14px', border: '1px solid #fbbf2460', bgcolor: '#fdf6e7', p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <WarningAmberIcon sx={{ color: '#d08c1e', fontSize: 20, mt: 0.1, flexShrink: 0 }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#7a4a0c' }}>Bank profile is incomplete</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#94600f' }}>Missing: {missingFields.join(', ')}</Typography>
            </Box>
          </Box>
          <Button size="small" variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => onNavigate('profile')}
            sx={{ bgcolor: '#d08c1e', '&:hover': { bgcolor: '#b5730f' }, boxShadow: 'none', flexShrink: 0, borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}>
            Update Profile
          </Button>
        </Paper>
      )}

      {/* Stats */}
      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        {[
          { label: 'Total Payslips', value: payslips.length,                                                    sub: 'generated',    color: '#2e9466', bg: '#10b98112' },
          { label: 'Total Earned',   value: `${cur} ${totalEarned.toLocaleString()}`,                          sub: 'net pay',      color: '#2a7f96', bg: '#6366f112' },
          { label: 'Total Hours',    value: formatHM(totalMinutes),                                        sub: 'all periods',  color: '#4f67c9', bg: '#0ea5e912' },
          { label: 'Latest Payslip', value: payslips[0] ? `${cur} ${parseFloat(payslips[0].net_amount||0).toLocaleString()}` : '—',
            sub: payslips[0]?.period_name || 'no payslips yet', color: '#d08c1e', bg: '#f59e0b12' },
        ].map(({ label, value, sub, color, bg }) => (
          <Grid size={{ xs: 6, sm: 3 }} key={label}>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '16px', p: 2, bgcolor: bg }}>
              <Typography sx={{ fontSize: '0.78rem', color: 'text.disabled', mb: 0.5 }}>{label}</Typography>
              <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color, lineHeight: 1.1 }}>{value}</Typography>
              <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', mt: 0.25 }}>{sub}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Recent payslips */}
      {payslips.length > 0 && (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '16px', overflow: 'hidden', mb: 0 }}>
          <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Recent Payslips</Typography>
            {payslips.length > 3 && (
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => onNavigate('payslips')}
                sx={{ color: '#2a7f96', fontSize: '0.75rem', textTransform: 'none' }}>
                View all
              </Button>
            )}
          </Box>
          {payslips.slice(0, 3).map((p, i) => (
            <Box key={p.id} sx={{ px: 2.5, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: i < Math.min(payslips.length, 3) - 1 ? '1px solid' : 'none', borderBottomColor: 'divider' }}>
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.period_name}</Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', fontFamily: 'monospace' }}>{p.payslip_number}</Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontWeight: 800, color: '#2e9466', fontSize: '1rem' }}>{employee?.currency || ''} {parseFloat(p.net_amount || 0).toLocaleString()}</Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>net pay</Typography>
              </Box>
            </Box>
          ))}
        </Paper>
      )}

      <PortalCategoryHoursPanel timesheets={timesheets} />
    </Box>
  );
}

// ─── PAYSLIPS ─────────────────────────────────────────────────────────────────
function PayslipsSection({ payslips, currency }) {
  const cur = currency || '';

  const handleOpenPDF = (p) => {
    const url = portalAPI.payslipPdfUrl(p.id);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (payslips.length === 0) return (
    <Paper elevation={0} sx={{ p: 8, border: '1px solid', borderColor: 'divider', borderRadius: '16px', textAlign: 'center', color: 'text.disabled' }}>
      <ReceiptLongIcon sx={{ fontSize: 48, opacity: 0.2, mb: 1.5 }} />
      <Typography sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>No Payslips Yet</Typography>
      <Typography sx={{ fontSize: '0.875rem' }}>Payslips will appear here once generated by your administrator.</Typography>
    </Paper>
  );

  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '16px', overflow: 'hidden' }}>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {['Payslip No.', 'Period', 'Hours', 'Gross', 'Net Pay', 'PDF'].map(h => (
                <TableCell key={h} sx={TH}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {payslips.map(p => (
              <TableRow key={p.id} sx={{ '&:hover td': { bgcolor: 'action.hover' } }}>
                <TableCell sx={{ ...TD, fontFamily: 'monospace', fontSize: '0.8rem', color: '#2a7f96', fontWeight: 600 }}>{p.payslip_number}</TableCell>
                <TableCell sx={TD}>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.period_name}</Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>{fmt(p.start_date)} – {fmt(p.end_date)}</Typography>
                </TableCell>
                <TableCell sx={TD}>{formatHoursAsHM(p.total_hours || 0)}</TableCell>
                <TableCell sx={TD}>{cur} {parseFloat(p.gross_amount || 0).toLocaleString()}</TableCell>
                <TableCell sx={{ ...TD, fontWeight: 800, color: '#2e9466', fontSize: '1rem' }}>{cur} {parseFloat(p.net_amount || 0).toLocaleString()}</TableCell>
                <TableCell sx={TD}>
                  <Tooltip title="Open PDF in new tab">
                    <IconButton size="small" onClick={() => handleOpenPDF(p)}
                      sx={{ color: '#2a7f96', '&:hover': { bgcolor: '#6366f115' } }}>
                      <PictureAsPdfIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
const EMP_TYPE_LABELS = { full_time: 'Full-Time', part_time: 'Part-Time', contractor: 'Contractor' };
const HIRE_CAT_LABELS = { local: 'Local', foreign: 'Foreign' };

const F = ({ label, field, form, setForm, xs = 12, sm = 6, multiline = false }) => (
  <Grid size={{ xs: xs, sm: sm }}>
    <TextField fullWidth label={label} size="small" multiline={multiline} rows={multiline ? 2 : 1}
      value={form[field] || ''}
      onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
  </Grid>
);

const R = ({ label, value, xs = 12, sm = 6 }) => (
  <Grid size={{ xs: xs, sm: sm }}>
    <Box>
      <Typography sx={{ fontSize: '0.78rem', color: 'text.disabled', mb: 0.25 }}>{label}</Typography>
      <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: value ? 'text.primary' : 'text.disabled' }}>{value || '—'}</Typography>
    </Box>
  </Grid>
);

function ProfileSection({ employee, onUpdated }) {
  const isForeign = employee?.hire_category === 'foreign';
  const emptyForm = {
    first_name: '', last_name: '', middle_name: '', employee_address: '',
    bank_name: '', bank_account_number: '', bank_account_name: '', bank_branch: '', bank_swift_code: '', bank_address: '',
    remittance_type: '', beneficiary_code: '', beneficiary_address: '',
    beneficiary_building_no: '', beneficiary_building_name: '', beneficiary_street: '',
    beneficiary_city: '', beneficiary_postal_code: '',
    country_of_destination: '', purpose_nature: '',
    intermediary_bank_name: '', intermediary_bank_address: '', intermediary_bank_swift: '',
    payee_tin: '', payee_zip_code: '', payee_foreign_address: '', payee_foreign_zip_code: '', tax_code: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (employee) setForm(Object.fromEntries(Object.keys(emptyForm).map(k => [k, employee[k] || ''])));
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

  const CardHeader = ({ icon, title, sub }) => (
    <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5 }}>
      {icon}
      <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
      {sub && <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', ml: 0.5 }}>— {sub}</Typography>}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 700 }}>

      {missingFields.length > 0 ? (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, bgcolor: '#f59e0b10', border: '1px solid #f59e0b40', borderRadius: '12px', p: 1.75 }}>
          <WarningAmberIcon sx={{ fontSize: 18, color: '#d08c1e', mt: 0.1, flexShrink: 0 }} />
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#7a4a0c' }}>Banking profile incomplete</Typography>
            <Typography sx={{ fontSize: '0.8rem', color: '#94600f' }}>Missing: {missingFields.join(', ')} — contact your administrator to update.</Typography>
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#10b98110', border: '1px solid #10b98140', borderRadius: '12px', p: 1.75 }}>
          <CheckCircleIcon sx={{ fontSize: 18, color: '#2e9466' }} />
          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#1b5e40' }}>Bank profile is complete</Typography>
        </Box>
      )}

      {/* Employment Info (read-only) */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '16px', overflow: 'hidden' }}>
        <CardHeader icon={<BadgeIcon sx={{ color: '#2a7f96', fontSize: 20 }} />} title="Employment Details" />
        <Box sx={{ p: 2.5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          {[
            ['Employee ID',     employee?.employee_id],
            ['Full Name',       employee?.name],
            ['Department',      employee?.department || '—'],
            ['Position',        employee?.position || '—'],
            ['Employment Type', EMP_TYPE_LABELS[employee?.employment_type] || '—'],
            ['Hire Category',   HIRE_CAT_LABELS[employee?.hire_category] || '—'],
            ['Hire Date',       employee?.hire_date ? new Date(employee.hire_date).toLocaleDateString() : '—'],
            ['Currency',        employee?.currency || '—'],
          ].map(([label, val]) => (
            <Box key={label}>
              <Typography sx={{ fontSize: '0.78rem', color: 'text.disabled', mb: 0.25 }}>{label}</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{val}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Name Details */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '16px', overflow: 'hidden' }}>
        <CardHeader icon={<BadgeIcon sx={{ color: '#2a7f96', fontSize: 20 }} />} title="Name Details" sub="used in bank transfer files" />
        <Box sx={{ p: 2.5 }}>
          <Grid container spacing={2}>
            <F label="First Name *"  field="first_name"  form={form} setForm={setForm} />
            <F label="Last Name *"   field="last_name"   form={form} setForm={setForm} />
            <F label="Middle Name"   field="middle_name" form={form} setForm={setForm} />
          </Grid>
        </Box>
      </Paper>

      {/* Address — local employees only */}
      {!isForeign && (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '16px', overflow: 'hidden' }}>
          <CardHeader icon={<BadgeIcon sx={{ color: '#2a7f96', fontSize: 20 }} />} title="Address Details" />
          <Box sx={{ p: 2.5 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <TextField fullWidth label="Employee Address" multiline rows={2} size="small"
                  placeholder="House/Unit no., Street, Barangay, City, Province, ZIP"
                  value={form.employee_address || ''}
                  onChange={e => setForm(f => ({ ...f, employee_address: e.target.value }))}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
              </Grid>
            </Grid>
          </Box>
        </Paper>
      )}

      {/* Bank Details — read-only */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '16px', overflow: 'hidden' }}>
        <CardHeader icon={<AccountBalanceIcon sx={{ color: '#2a7f96', fontSize: 20 }} />} title="Bank Details" sub="managed by admin" />
        <Box sx={{ px: 2.5, py: 1.25, bgcolor: 'action.hover', borderBottom: '1px solid', borderBottomColor: 'divider' }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            Banking information is managed by your administrator. Contact admin if any details need updating.
          </Typography>
        </Box>
        <Box sx={{ p: 2.5 }}>
          <Grid container spacing={2}>
            <R label="Bank Name"       value={form.bank_name} />
            <R label="Account Name"    value={form.bank_account_name} />
            <R label="Account Number"  value={form.bank_account_number} />
            <R label="Branch"          value={form.bank_branch} />
            {isForeign && <R label="SWIFT / BIC Code" value={form.bank_swift_code} />}
            {isForeign && <R label="Bank Address"     value={form.bank_address} xs={12} sm={12} />}
          </Grid>
        </Box>
      </Paper>

      {/* International Fields (foreign only) */}
      {isForeign && (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '16px', overflow: 'hidden' }}>
          <CardHeader icon={<AccountBalanceIcon sx={{ color: '#2a7f96', fontSize: 20 }} />} title="International Transfer Details" sub="managed by admin" />
          <Box sx={{ p: 2.5 }}>
            <Grid container spacing={2}>
              <R label="Remittance Type"       value={form.remittance_type} />
              <R label="Beneficiary Code"      value={form.beneficiary_code} />
              <R label="Beneficiary Address"   value={form.beneficiary_address}   xs={12} sm={12} />
              <R label="Building No."          value={form.beneficiary_building_no} />
              <R label="Building Name"         value={form.beneficiary_building_name} />
              <R label="Street Name"           value={form.beneficiary_street}     xs={12} sm={12} />
              <R label="Town / City"           value={form.beneficiary_city} />
              <R label="Postal Code"           value={form.beneficiary_postal_code} />
              <R label="Country of Destination" value={form.country_of_destination} />
              <R label="Purpose / Nature"      value={form.purpose_nature} />
              <R label="Payee TIN"             value={form.payee_tin} />
              <R label="Payee ZIP Code"        value={form.payee_zip_code} />
              <R label="Payee Foreign Address" value={form.payee_foreign_address} xs={12} sm={12} />
              <R label="Payee Foreign ZIP"     value={form.payee_foreign_zip_code} />
              <R label="Tax Code"              value={form.tax_code} />
            </Grid>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'text.secondary', mt: 2.5, mb: 1 }}>
              Intermediary Bank
            </Typography>
            <Grid container spacing={2}>
              <R label="Intermediary Bank Name"    value={form.intermediary_bank_name} />
              <R label="Intermediary SWIFT"        value={form.intermediary_bank_swift} />
              <R label="Intermediary Bank Address" value={form.intermediary_bank_address} xs={12} sm={12} />
            </Grid>
          </Box>
        </Paper>
      )}

      <Button variant="contained" onClick={handleSave} disabled={saving}
        sx={{ alignSelf: 'flex-start', borderRadius: '12px', textTransform: 'none', fontWeight: 700,
          background: 'linear-gradient(135deg, #2a7f96 0%, #4da3ba 100%)',
          boxShadow: '0 4px 12px rgba(42,127,150,0.3)', px: 3, py: 1.25 }}>
        {saving ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Save Profile'}
      </Button>
    </Box>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
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
    } finally { setLoading(false); }
  };

  return (
    <Box sx={{ maxWidth: 460 }}>
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '16px', overflow: 'hidden' }}>
        <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <LockResetIcon sx={{ color: '#2a7f96', fontSize: 20 }} />
          <Typography sx={{ fontWeight: 700 }}>Change Password</Typography>
        </Box>
        <Box sx={{ p: 2.5 }}>
          <Alert severity="info" sx={{ mb: 2.5, borderRadius: '10px' }}>
            Logged in as <strong>{user?.username}</strong>
          </Alert>
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField fullWidth label="Current Password" size="small"
              type={showCurrent ? 'text' : 'password'} value={form.current} required
              onChange={e => setForm(f => ({ ...f, current: e.target.value }))}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
              slotProps={{ input: { endAdornment: (
                <IconButton size="small" onClick={() => setShowCurrent(v => !v)} sx={{ color: 'text.disabled' }}>
                  {showCurrent ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                </IconButton>
              )}}} />
            <TextField fullWidth label="New Password" size="small"
              type={showNew ? 'text' : 'password'} value={form.newP} required
              onChange={e => setForm(f => ({ ...f, newP: e.target.value }))}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
              slotProps={{ input: { endAdornment: (
                <IconButton size="small" onClick={() => setShowNew(v => !v)} sx={{ color: 'text.disabled' }}>
                  {showNew ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                </IconButton>
              )}}} />
            <TextField fullWidth label="Confirm New Password" size="small"
              type="password" value={form.confirm} required
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
            <Button type="submit" variant="contained" disabled={loading} fullWidth
              sx={{ py: 1.25, fontWeight: 700, borderRadius: '12px', textTransform: 'none',
                background: 'linear-gradient(135deg, #2a7f96 0%, #4da3ba 100%)',
                boxShadow: '0 4px 12px rgba(42,127,150,0.25)' }}>
              {loading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Change Password'}
            </Button>
          </Box>
          <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: '10px' }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>
              Forgot your password? Contact your admin — they can reset it from the Employees page.
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

// ─── MAIN PORTAL ──────────────────────────────────────────────────────────────
export default function EmployeePortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState('dashboard');
  const [employee, setEmployee] = useState(null);
  const [timesheets, setTimesheets] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, tsRes, psRes] = await Promise.all([
        portalAPI.getMe(), portalAPI.getTimesheets(), portalAPI.getPayslips(),
      ]);
      setEmployee(empRes.data);
      setTimesheets(tsRes.data || []);
      setPayslips(psRes.data || []);
    } catch (err) {
      const status = err?.response?.status;
      if (status !== 403 && status !== 404) toast.error('Couldn’t load your portal. Check your connection and reload the page.');
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleLogout = () => { logout(); toast.success('Logged out'); navigate('/login'); };

  const sectionTitle = NAV_ITEMS.find(n => n.key === section)?.label || '';
  const groups = [{
    label: null,
    items: NAV_ITEMS.map(({ key, label, icon }) => ({ key, label, icon, active: section === key, onClick: () => setSection(key) })),
  }];

  return (
    <AppShell
      groups={groups}
      subtitle="Employee portal"
      user={{ name: employee?.name || user?.username, role: 'Employee' }}
      onLogout={handleLogout}
      transitionKey={section}
      maxWidth={920}
    >
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h1" sx={{ color: 'text.primary' }}>
          {sectionTitle}
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Skeleton variant="rounded" height={132} />
          <Skeleton variant="rounded" height={88} />
          <Skeleton variant="rounded" height={240} />
        </Box>
      ) : !employee && section !== 'settings' ? (
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 6 }, textAlign: 'center' }}>
          <WarningAmberIcon sx={{ fontSize: 44, color: 'warning.main', mb: 1.5 }} />
          <Typography sx={{ fontFamily: tokens.fonts.display, fontWeight: 700, fontSize: '1.15rem', mb: 1 }}>Your account isn’t linked yet</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', mb: 3, maxWidth: 420, mx: 'auto' }}>
            Payslips and timesheets show up once your administrator links this login to your employee profile. You can still change your password.
          </Typography>
          <Button variant="outlined" onClick={() => setSection('settings')}>
            Change password
          </Button>
        </Paper>
      ) : (
        <>
          {section === 'dashboard' && <DashboardSection employee={employee} timesheets={timesheets} payslips={payslips} onNavigate={setSection} />}
          {section === 'payslips'  && <PayslipsSection  payslips={payslips} currency={employee?.currency} />}
          {section === 'profile'   && <ProfileSection   employee={employee} onUpdated={setEmployee} />}
          {section === 'settings'  && <SettingsSection  user={user} />}
        </>
      )}
    </AppShell>
  );
}
