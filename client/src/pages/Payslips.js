import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, CircularProgress, Grid, Divider, Checkbox,
  List, ListItem, ListItemText, LinearProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeleteIcon from '@mui/icons-material/Delete';
import PublishIcon from '@mui/icons-material/Publish';

import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import PeopleIcon from '@mui/icons-material/People';
import { timesheetAPI, payslipsAPI, employeesAPI, jobsAPI, verificationsAPI } from '../api';
import { useAuth } from '../context/AuthContext';

function pollJob(jobId, onProgress) {
  return new Promise((resolve, reject) => {
    const id = setInterval(async () => {
      try {
        const res = await jobsAPI.getStatus(jobId);
        const job = res.data;
        if (job.progress && onProgress) onProgress(job.progress);
        if (job.status === 'done')   { clearInterval(id); resolve(job.result); }
        else if (job.status === 'failed') { clearInterval(id); reject(new Error(job.error || 'Job failed')); }
      } catch (err) { clearInterval(id); reject(err); }
    }, 1500);
  });
}

const TH = { fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', py: 1.5, px: 2 };
const TD = { fontSize: '0.85rem', color: 'text.primary', py: 1.5, px: 2 };

function InfoRow({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1.25, borderBottom: '1px solid', borderBottomColor: 'divider' }}>
      <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>{value}</Typography>
    </Box>
  );
}

export default function Payslips() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const isReadOnly   = user?.role === 'accounting_manager';

  const [periods, setPeriods]               = useState([]);
  const [periodTypeFilter, setPeriodTypeFilter] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [payslips, setPayslips]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState('');
  const [selected, setSelected]             = useState(null);

  const [showBulkPanel, setShowBulkPanel]         = useState(false);
  const [employees, setEmployees]                 = useState([]);
  const [verifiedEmployeeIds, setVerifiedEmployeeIds] = useState([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [selectAll, setSelectAll]                 = useState(true);
  const [generating, setGenerating]               = useState(false);
  const [genProgress, setGenProgress]             = useState(null);
  const [bulkResult, setBulkResult]               = useState(null);

  const [deleteTarget, setDeleteTarget]     = useState(null);
  const [deleting, setDeleting]             = useState(false);

  const [releasing, setReleasing]           = useState(false);
  const [releasingId, setReleasingId]       = useState(null);

  useEffect(() => { fetchPeriods(); fetchEmployees(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPeriods = async () => {
    try {
      setLoading(true);
      const res = await timesheetAPI.getPeriods(200, 0);
      if (res.success) {
        setPeriods(res.data);
        if (res.data.length > 0) handleSelectPeriod(res.data[0]);
      }
    } catch { toast.error('Failed to load periods'); }
    finally { setLoading(false); }
  };

  const fetchEmployees = async () => {
    try {
      const res = await employeesAPI.getAll(true);
      if (res.success) setEmployees(res.data || []);
    } catch { /* non-critical */ }
  };

  const fetchPayslips = async (periodId) => {
    try {
      const res = await timesheetAPI.getPeriodPayslips(periodId);
      if (res.success) setPayslips(res.data);
    } catch { toast.error('Failed to load payslips'); }
  };

  const handleSelectPeriod = async (p) => {
    setSelectedPeriod(p); fetchPayslips(p.id); setBulkResult(null);
    try {
      const res = await verificationsAPI.getForPeriod(p.id);
      const verified = (res.data || []).filter(r => r.status === 'verified').map(r => r.employee?.id).filter(Boolean);
      setVerifiedEmployeeIds(verified);
    } catch { setVerifiedEmployeeIds([]); }
  };

  const handleFilterChange = (value) => {
    setPeriodTypeFilter(value);
    const list = periods.filter(p =>
      value === 'all' ||
      (value === 'local' ? (!p.period_type || p.period_type === 'local') : p.period_type === 'foreign')
    );
    if (list.length > 0) handleSelectPeriod(list[0]);
  };

  const handleViewPayslip = async (id) => {
    try {
      const res = await payslipsAPI.getById(id);
      if (res.success) setSelected(res.data);
    } catch { toast.error('Failed to load payslip details'); }
  };

  // Open PDF directly in a new tab using the token URL — browser handles print + download natively
  const handleOpenPDF = (payslip) => {
    const url = payslipsAPI.pdfUrl(payslip.id);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleToggleEmployee = (id) => setSelectedEmployeeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const handleSelectAll = (checked) => { setSelectAll(checked); setSelectedEmployeeIds([]); };

  const handleBulkGenerate = async () => {
    if (!selectedPeriod) return toast.error('Select a period first');
    setGenerating(true); setGenProgress(null); setBulkResult(null);
    try {
      const empIds = selectAll ? null : selectedEmployeeIds;
      const res = await payslipsAPI.generateForPeriod(selectedPeriod.id, empIds);
      let data = res.data;
      if (data?.jobId) data = await pollJob(data.jobId, p => setGenProgress(p));
      if (data) {
        setBulkResult(data);
        const { generated, skipped, errors } = data;
        if (generated > 0)     toast.success(`Generated ${generated} payslip(s)`);
        else if (skipped > 0)  toast(`${skipped} already generated`, { icon: 'ℹ️' });
        else if (errors?.length) toast.error(`${errors.length} error(s)`);
        fetchPayslips(selectedPeriod.id);
      }
    } catch (e) { toast.error(e.response?.data?.error || e.message || 'Generation failed'); }
    finally { setGenerating(false); setGenProgress(null); }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await payslipsAPI.delete(deleteTarget.id);
      toast.success('Payslip deleted');
      setDeleteTarget(null);
      if (selectedPeriod) fetchPayslips(selectedPeriod.id);
    } catch (e) {
      toast.error(e.response?.data?.error || e.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleRelease = async () => {
    if (!selectedPeriod) return;
    setReleasing(true);
    try {
      const res = await timesheetAPI.releasePayslips(selectedPeriod.id);
      toast.success(`${res.data?.released ?? ''} payslip(s) released to employees`);
      fetchPayslips(selectedPeriod.id);
    } catch (e) {
      toast.error(e.response?.data?.error || e.message || 'Release failed');
    } finally {
      setReleasing(false);
    }
  };

  const handleReleaseOne = async (payslip) => {
    setReleasingId(payslip.id);
    try {
      await payslipsAPI.releaseOne(payslip.id);
      toast.success(`${payslip.employee_name}'s payslip released`);
      fetchPayslips(selectedPeriod.id);
    } catch (e) {
      toast.error(e.response?.data?.error || e.message || 'Release failed');
    } finally {
      setReleasingId(null);
    }
  };

  const filtered = payslips.filter(p =>
    p.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.payslip_number?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPeriods = periods.filter(p =>
    periodTypeFilter === 'all' ||
    (periodTypeFilter === 'local'   ? (!p.period_type || p.period_type === 'local') : p.period_type === 'foreign')
  );

  const existingPayslipEmpIds = new Set(payslips.map(p => p.employee_id));
  const periodCategory = selectedPeriod?.period_type === 'foreign' ? 'foreign' : 'local';
  const bulkEmployees = employees
    .filter(e => !selectedPeriod || (e.hire_category || 'local') === periodCategory)
    .filter(e => !existingPayslipEmpIds.has(e.id))
    .filter(e => verifiedEmployeeIds.length === 0 || verifiedEmployeeIds.includes(e.id));

  const totalNet        = filtered.reduce((s, p) => s + (parseFloat(p.net_amount) || 0), 0);
  const totalHours      = filtered.reduce((s, p) => s + (parseFloat(p.total_hours) || 0), 0);
  const unreleased      = payslips.filter(p => p.status === 'generated').length;
  const releasedCount   = payslips.filter(p => p.status === 'released').length;
  const allReleased     = payslips.length > 0 && unreleased === 0;
  const bankUploaded    = !!selectedPeriod?.bank_uploaded_at;
  const canRelease      = bankUploaded && !isReadOnly;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ReceiptLongIcon sx={{ color: 'white', fontSize: 18 }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Payslips</Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>Release generated payslips to employees</Typography>
          </Box>
        </Box>
        {!isReadOnly && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="outlined" startIcon={<AutoAwesomeIcon sx={{ fontSize: '16px !important' }} />}
              onClick={() => setShowBulkPanel(v => !v)}
              sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem',
                borderColor: showBulkPanel ? '#6366f1' : 'divider',
                color: showBulkPanel ? '#6366f1' : 'text.secondary',
                bgcolor: showBulkPanel ? '#6366f108' : 'transparent' }}>
              Generate Payslips
            </Button>
            <Tooltip title={!bankUploaded ? 'Bank upload must be confirmed first (Generate Bank Upload page)' : ''} arrow>
              <span>
                <Button variant="contained" startIcon={releasing ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <PublishIcon sx={{ fontSize: '16px !important' }} />}
                  onClick={handleRelease}
                  disabled={releasing || !selectedPeriod || unreleased === 0 || !bankUploaded}
                  sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem',
                    background: allReleased ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'linear-gradient(135deg, #10b981, #34d399)',
                    boxShadow: '0 4px 12px rgba(16,185,129,0.3)', opacity: (allReleased || !bankUploaded) ? 0.6 : 1 }}>
                  {releasing ? 'Releasing…' : allReleased ? `All ${releasedCount} Released` : `Release All (${unreleased} pending)`}
                </Button>
              </span>
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* Bulk Generate Panel */}
      {!isReadOnly && showBulkPanel && (
        <Paper elevation={0} sx={{ mb: 2.5, borderRadius: '16px', border: '1px solid', borderColor: '#6366f130', overflow: 'hidden' }}>
          <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'rgba(99,102,241,0.03)' }}>
            <AutoAwesomeIcon sx={{ color: '#6366f1', fontSize: 17 }} />
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Bulk Generate Payslips</Typography>
            {selectedPeriod && <Chip label={selectedPeriod.period_name} size="small" sx={{ bgcolor: '#6366f115', color: '#6366f1', fontWeight: 600, fontSize: '0.72rem' }} />}
          </Box>
          <Box sx={{ p: 2.5 }}>
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}>
              Only verified employees without an existing payslip are shown.
              {bulkEmployees.length === 0 && <strong> No eligible employees for this period.</strong>}
            </Typography>
            <Box sx={{ maxHeight: 220, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: '10px', overflow: 'hidden' }}>
              <List dense disablePadding>
                <ListItem disablePadding sx={{ borderBottom: '1px solid', borderBottomColor: 'divider', bgcolor: 'action.hover', px: 1 }}>
                  <Checkbox checked={selectAll} onChange={e => handleSelectAll(e.target.checked)} size="small" sx={{ color: '#6366f1', '&.Mui-checked': { color: '#6366f1' } }} />
                  <ListItemText
                    primary={<Typography sx={{ fontSize: '0.875rem', fontWeight: 700 }}>All Employees ({bulkEmployees.length})</Typography>}
                    secondary={selectAll ? 'Will generate for all eligible employees' : 'Select specific employees below'}
                    sx={{ '& .MuiListItemText-secondary': { fontSize: '0.7rem' } }}
                  />
                </ListItem>
                {bulkEmployees.map(emp => (
                  <ListItem key={emp.id} disablePadding
                    onClick={() => { if (selectAll) return; handleToggleEmployee(emp.id); }}
                    sx={{ borderBottom: '1px solid', borderBottomColor: 'divider', cursor: selectAll ? 'default' : 'pointer',
                      opacity: selectAll ? 0.6 : 1,
                      bgcolor: (!selectAll && selectedEmployeeIds.includes(emp.id)) ? '#6366f108' : 'transparent',
                      '&:hover': { bgcolor: selectAll ? 'transparent' : '#6366f108' } }}>
                    <Checkbox checked={selectAll || selectedEmployeeIds.includes(emp.id)} disabled={selectAll}
                      onChange={() => handleToggleEmployee(emp.id)} size="small"
                      sx={{ color: '#6366f1', '&.Mui-checked': { color: '#6366f1' } }} />
                    <ListItemText primary={emp.name} secondary={emp.employee_id || emp.id}
                      sx={{ '& .MuiListItemText-primary': { fontSize: '0.875rem' }, '& .MuiListItemText-secondary': { fontSize: '0.72rem' } }} />
                  </ListItem>
                ))}
              </List>
            </Box>
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Button variant="contained"
                startIcon={generating ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <AutoAwesomeIcon sx={{ fontSize: '16px !important' }} />}
                onClick={handleBulkGenerate}
                disabled={generating || !selectedPeriod || bulkEmployees.length === 0 || (!selectAll && selectedEmployeeIds.length === 0)}
                sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, background: 'linear-gradient(135deg, #6366f1, #818cf8)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
                {generating ? (genProgress?.total > 0 ? `${genProgress.done} / ${genProgress.total}…` : 'Generating…') : 'Generate Now'}
              </Button>
              {bulkResult && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip label={`${bulkResult.generated} generated`} size="small" sx={{ bgcolor: '#10b98115', color: '#10b981', fontWeight: 700 }} />
                  {bulkResult.skipped > 0 && <Chip label={`${bulkResult.skipped} skipped`} size="small" sx={{ bgcolor: '#f59e0b15', color: '#f59e0b', fontWeight: 700 }} />}
                  {bulkResult.errors?.length > 0 && <Chip label={`${bulkResult.errors.length} errors`} size="small" sx={{ bgcolor: '#ef444415', color: '#ef4444', fontWeight: 700 }} />}
                </Box>
              )}
            </Box>
            {generating && (
              <Box sx={{ mt: 1.5 }}>
                <LinearProgress variant={genProgress?.total > 0 ? 'determinate' : 'indeterminate'}
                  value={genProgress?.total > 0 ? (genProgress.done / genProgress.total) * 100 : undefined}
                  sx={{ height: 5, borderRadius: 3, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#6366f1', borderRadius: 3 } }} />
                {genProgress?.current && (
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.5 }}>Processing: {genProgress.current}</Typography>
                )}
              </Box>
            )}
          </Box>
        </Paper>
      )}

      <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>
        {/* Periods sidebar */}
        <Grid item xs={12} md={3}>
          <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: 2, py: 1.75, borderBottom: '1px solid', borderBottomColor: 'divider' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: 'text.primary', mb: 1 }}>Pay Periods</Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {[{ label: 'All', value: 'all' }, { label: 'Local', value: 'local' }, { label: 'Intl', value: 'foreign' }].map(opt => (
                  <Chip key={opt.value} label={opt.label} size="small" onClick={() => handleFilterChange(opt.value)}
                    sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                      bgcolor: periodTypeFilter === opt.value ? '#6366f1' : 'action.hover',
                      color:   periodTypeFilter === opt.value ? 'white' : 'text.secondary',
                      '&:hover': { bgcolor: periodTypeFilter === opt.value ? '#5254d4' : 'action.selected' } }} />
                ))}
              </Box>
            </Box>
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} sx={{ color: '#6366f1' }} /></Box>
              ) : filteredPeriods.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center', color: 'text.disabled', fontSize: '0.8rem' }}>No periods</Box>
              ) : filteredPeriods.map(p => (
                <Box key={p.id} onClick={() => handleSelectPeriod(p)}
                  sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderBottomColor: 'divider', cursor: 'pointer',
                    bgcolor: selectedPeriod?.id === p.id ? 'rgba(99,102,241,0.06)' : 'transparent',
                    borderLeft: selectedPeriod?.id === p.id ? '3px solid #6366f1' : '3px solid transparent',
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: selectedPeriod?.id === p.id ? 'rgba(99,102,241,0.08)' : 'action.hover' } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                    <Typography sx={{ fontWeight: selectedPeriod?.id === p.id ? 700 : 500, fontSize: '0.8rem', color: selectedPeriod?.id === p.id ? '#6366f1' : 'text.primary', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mr: 0.5 }}>
                      {p.period_name}
                    </Typography>
                    <Chip label={p.period_type === 'foreign' ? 'Intl' : 'LCL'} size="small"
                      sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, flexShrink: 0,
                        bgcolor: p.period_type === 'foreign' ? '#0ea5e918' : '#6366f118',
                        color:   p.period_type === 'foreign' ? '#0ea5e9'   : '#6366f1' }} />
                    {p.bank_uploaded_at
                      ? <Tooltip title="Bank uploaded — ready to release" arrow><Box component="span" sx={{ fontSize: 12, color: '#10b981' }}>✓</Box></Tooltip>
                      : <Tooltip title="Bank not yet uploaded" arrow><Box component="span" sx={{ fontSize: 12, color: '#f59e0b' }}>⚠</Box></Tooltip>}
                  </Box>
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', textTransform: 'capitalize' }}>{p.status}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Main payslips area */}
        <Grid item xs={12} md={9}>
          <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Table header */}
            <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'text.primary' }}>
                  {selectedPeriod ? selectedPeriod.period_name : 'Select a Period'}
                </Typography>
                {filtered.length > 0 && (
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.25 }}>
                    {filtered.length} payslip{filtered.length !== 1 ? 's' : ''} · {totalHours.toFixed(1)}h total · Net {filtered[0]?.currency || ''} {totalNet.toLocaleString()}
                  </Typography>
                )}
              </Box>
              <TextField placeholder="Search by name or number…" value={search} onChange={e => setSearch(e.target.value)} size="small"
                sx={{ width: 240, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'text.disabled', fontSize: 17 }} /></InputAdornment> } }} />
            </Box>

            {/* Bank upload gate warning */}
            {selectedPeriod && !bankUploaded && !isReadOnly && payslips.length > 0 && (
              <Box sx={{ px: 2.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#f59e0b0d', borderBottom: '1px solid #f59e0b30' }}>
                <Box sx={{ fontSize: 15, color: '#f59e0b' }}>⚠</Box>
                <Typography sx={{ fontSize: '0.8rem', color: '#b45309' }}>
                  Bank upload not yet confirmed for this period. Go to <strong>Generate Bank Upload</strong> → confirm upload before releasing payslips to employees.
                </Typography>
              </Box>
            )}
            {selectedPeriod && bankUploaded && !allReleased && !isReadOnly && payslips.length > 0 && (
              <Box sx={{ px: 2.5, py: 1, display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#10b9810a', borderBottom: '1px solid #10b98125' }}>
                <Box sx={{ fontSize: 14, color: '#10b981' }}>✓</Box>
                <Typography sx={{ fontSize: '0.78rem', color: '#059669' }}>
                  Bank upload confirmed — you can now release payslips to employees.
                </Typography>
              </Box>
            )}

            {/* Summary stats strip */}
            {filtered.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0, borderBottom: '1px solid', borderBottomColor: 'divider', bgcolor: 'action.hover' }}>
                {[
                  { icon: <PeopleIcon />, label: 'Employees', value: filtered.length, color: '#6366f1' },
                  { icon: <CalendarMonthIcon />, label: 'Period', value: selectedPeriod?.period_type === 'foreign' ? 'International' : 'Local', color: '#0ea5e9' },
                  { icon: <MonetizationOnIcon />, label: 'Total Net', value: `${filtered[0]?.currency || ''} ${totalNet.toLocaleString()}`, color: '#10b981' },
                ].map((s, i) => (
                  <Box key={i} sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, borderRight: i < 2 ? '1px solid' : 'none', borderColor: 'divider' }}>
                    {s.icon && <Box sx={{ color: s.color, display: 'flex', alignItems: 'center' }}>{s.icon}</Box>}
                    <Box>
                      <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{s.label}</Typography>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>{s.value}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

            {!selectedPeriod ? (
              <Box sx={{ py: 14, textAlign: 'center', color: 'text.disabled' }}>
                <Box sx={{ width: 60, height: 60, borderRadius: '18px', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                  <CalendarMonthIcon sx={{ fontSize: 28, opacity: 0.3 }} />
                </Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', mb: 0.5 }}>No Period Selected</Typography>
                <Typography sx={{ fontSize: '0.8rem' }}>Select a pay period from the left panel</Typography>
              </Box>
            ) : filtered.length === 0 ? (
              <Box sx={{ py: 14, textAlign: 'center', color: 'text.disabled' }}>
                <Box sx={{ width: 60, height: 60, borderRadius: '18px', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                  <ReceiptLongIcon sx={{ fontSize: 28, opacity: 0.3 }} />
                </Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', mb: 0.5 }}>No Payslips Yet</Typography>
                <Typography sx={{ fontSize: '0.8rem' }}>Use Generate Payslips to create payslips for this period</Typography>
              </Box>
            ) : (
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      {['Payslip No.', 'Employee', 'Hours', 'Gross', 'Net Pay', 'Status', 'Actions'].map(h => (
                        <TableCell key={h} sx={TH}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map(p => (
                      <TableRow key={p.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                        <TableCell sx={{ ...TD, fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem', color: '#6366f1' }}>
                          {p.payslip_number}
                        </TableCell>
                        <TableCell sx={TD}>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.2 }}>{p.employee_name}</Typography>
                          <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>{p.employee_id}</Typography>
                        </TableCell>
                        <TableCell sx={TD}>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.total_hours}h</Typography>
                        </TableCell>
                        <TableCell sx={{ ...TD, color: 'text.secondary' }}>
                          {p.currency || ''} {p.gross_amount?.toLocaleString()}
                        </TableCell>
                        <TableCell sx={{ ...TD, fontWeight: 700, color: '#10b981' }}>
                          {p.currency || ''} {p.net_amount?.toLocaleString()}
                        </TableCell>
                        <TableCell sx={TD}>
                          <Chip label={p.status} size="small" sx={{
                            bgcolor: p.status === 'released' ? '#10b98115' : p.status === 'paid' ? '#6366f115' : '#f59e0b15',
                            color:   p.status === 'released' ? '#10b981'   : p.status === 'paid' ? '#6366f1'   : '#f59e0b',
                            fontWeight: 700, fontSize: '0.68rem', textTransform: 'capitalize',
                          }} />
                        </TableCell>
                        <TableCell sx={TD}>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="View Details" arrow>
                              <IconButton size="small" onClick={() => handleViewPayslip(p.id)}
                                sx={{ color: '#6366f1', '&:hover': { bgcolor: '#6366f115' } }}>
                                <VisibilityIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Open PDF (print / download)" arrow>
                              <IconButton size="small" onClick={() => handleOpenPDF(p)}
                                sx={{ color: '#10b981', '&:hover': { bgcolor: '#10b98115' } }}>
                                <PictureAsPdfIcon sx={{ fontSize: 15 }} />
                              </IconButton>
                            </Tooltip>
                            {p.drive_file_url && (
                              <Tooltip title="View in Google Drive" arrow>
                                <IconButton size="small" component="a" href={p.drive_file_url} target="_blank" rel="noopener noreferrer"
                                  sx={{ color: '#0ea5e9', '&:hover': { bgcolor: '#0ea5e915' } }}>
                                  <OpenInNewIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                            {!isReadOnly && p.status === 'generated' && (
                              <Tooltip title={canRelease ? 'Release to employee' : 'Bank upload must be confirmed first'} arrow>
                                <span>
                                  <IconButton size="small"
                                    onClick={() => handleReleaseOne(p)}
                                    disabled={releasingId === p.id || !canRelease}
                                    sx={{ color: canRelease ? '#10b981' : 'text.disabled', '&:hover': { bgcolor: canRelease ? '#10b98115' : 'transparent' } }}>
                                    {releasingId === p.id
                                      ? <CircularProgress size={13} sx={{ color: '#10b981' }} />
                                      : <PublishIcon sx={{ fontSize: 15 }} />}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            )}
                            {isSuperAdmin && (
                              <Tooltip title="Delete Payslip" arrow>
                                <IconButton size="small" onClick={() => setDeleteTarget(p)}
                                  sx={{ color: '#ef4444', '&:hover': { bgcolor: '#ef444415' } }}>
                                  <DeleteIcon sx={{ fontSize: 15 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* ── Payslip Detail Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Payslip Details</DialogTitle>
        <DialogContent>
          {selected && (
            <>
              <Box sx={{ background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', borderRadius: '12px', p: 2.5, mb: 2.5 }}>
                <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Payslip Number</Typography>
                <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.2rem', color: 'white', letterSpacing: '0.04em' }}>{selected.payslip_number}</Typography>
              </Box>
              <InfoRow label="Employee"    value={selected.employee_name} />
              <InfoRow label="Period"      value={selected.period_name} />
              <InfoRow label="Total Hours" value={`${selected.total_hours}h`} />
              <InfoRow label="Hourly Rate" value={`${selected.currency || ''} ${selected.hourly_rate}`} />
              <InfoRow label="Gross Amount" value={`${selected.currency || ''} ${selected.gross_amount?.toLocaleString()}`} />
              <InfoRow label="Deductions"  value={`${selected.currency || ''} ${((selected.tax_deductions || 0) + (selected.other_deductions || 0)).toLocaleString()}`} />
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#10b98110', border: '1px solid #10b98130', borderRadius: '12px', px: 2.5, py: 1.75 }}>
                <Typography sx={{ fontWeight: 700, color: '#10b981' }}>Net Amount</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: '1.4rem', color: '#10b981' }}>
                  {selected.currency || ''} {selected.net_amount?.toLocaleString()}
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          {selected && (
            <Button variant="outlined" startIcon={<PictureAsPdfIcon />} onClick={() => handleOpenPDF(selected)}
              sx={{ borderRadius: '10px', textTransform: 'none', borderColor: '#10b981', color: '#10b981', '&:hover': { bgcolor: '#10b98110' } }}>
              Open PDF
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setSelected(null)} sx={{ borderRadius: '10px', textTransform: 'none', color: 'text.secondary' }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirmation Dialog ────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Delete Payslip?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
            This will permanently delete payslip <strong>{deleteTarget?.payslip_number}</strong> for <strong>{deleteTarget?.employee_name}</strong> and remove its PDF file. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}
            sx={{ borderRadius: '10px', textTransform: 'none', color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleDeleteConfirm} disabled={deleting}
            startIcon={deleting ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <DeleteIcon />}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, bgcolor: '#ef4444', '&:hover': { bgcolor: '#dc2626' }, boxShadow: 'none' }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
