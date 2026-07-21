import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, CircularProgress, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Alert, Collapse, Chip, Checkbox, Divider, LinearProgress, InputAdornment, TextField,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ReceiptIcon from '@mui/icons-material/Receipt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import AddIcon from '@mui/icons-material/Add';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import SearchIcon from '@mui/icons-material/Search';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { employeesAPI, timesheetAPI, timesheetGeneratorAPI, jobsAPI, verificationsAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatHoursAsHM } from '../utils/time';

function pollJob(jobId, onProgress) {
  return new Promise((resolve, reject) => {
    const id = setInterval(async () => {
      try {
        const res = await jobsAPI.getStatus(jobId);
        const job = res.data;
        if (onProgress) onProgress(job.status);
        if (job.status === 'done')   { clearInterval(id); resolve(job.result); }
        else if (job.status === 'failed') { clearInterval(id); reject(new Error(job.error || 'Job failed')); }
      } catch (err) { clearInterval(id); reject(err); }
    }, 1500);
  });
}

const CURRENCY_SYMBOLS = { USD: '$', PHP: '₱', BDT: '৳' };
function fmt(amount, currency = 'USD') {
  const sym = CURRENCY_SYMBOLS[currency] || currency + ' ';
  return `${sym}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDay(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const PERIOD_STATUS_LABEL = { open: 'Open', pending_approval: 'Pending Approval', approved: 'Approved', completed: 'Completed', paid: 'Paid' };
const PERIOD_STATUS_COLOR = { open: '#6366f1', pending_approval: '#f59e0b', approved: '#10b981', completed: '#10b981', paid: '#10b981' };

const TH = { fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', py: 1.5, px: 2 };
const TD = { fontSize: '0.85rem', color: 'text.primary', py: 1.25, px: 2 };

function StepIndicator({ steps, current }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
      {steps.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <React.Fragment key={label}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{
                width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '0.8rem', flexShrink: 0, transition: 'all 0.25s',
                background: done   ? '#10b981' :
                            active ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'transparent',
                border: done || active ? 'none' : '2px solid',
                borderColor: 'divider',
                color: done || active ? 'white' : 'text.disabled',
                boxShadow: active ? '0 4px 14px rgba(99,102,241,0.4)' : 'none',
              }}>
                {done ? <CheckCircleIcon sx={{ fontSize: 15 }} /> : i + 1}
              </Box>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: active ? 700 : 400, color: active ? '#6366f1' : done ? '#10b981' : 'text.disabled', whiteSpace: 'nowrap' }}>
                {label}
              </Typography>
            </Box>
            {i < steps.length - 1 && (
              <Box sx={{ flex: 1, height: 2, mx: 1.5, borderRadius: 2, bgcolor: i < current ? '#10b981' : 'divider', transition: 'background 0.3s', minWidth: 20 }} />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
}

function SummaryCard({ icon, label, value, color }) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: '14px', border: '1px solid', borderColor: `${color}25`, bgcolor: `${color}06` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
        <Box sx={{ width: 28, height: 28, borderRadius: '8px', bgcolor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {React.cloneElement(icon, { sx: { fontSize: 15, color } })}
        </Box>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'text.secondary' }}>{label}</Typography>
      </Box>
      <Typography sx={{ fontSize: '1.3rem', fontWeight: 800, color: 'text.primary', lineHeight: 1 }}>{value}</Typography>
    </Paper>
  );
}

export default function TimesheetGenerator() {
  const { user } = useAuth();
  const showRates      = user?.role === 'super_admin' || user?.role === 'hr';
  const showHourlyRate = showRates;
  const isReadOnly     = user?.role === 'accounting_manager';

  const [employees, setEmployees]           = useState([]);
  const [empLoading, setEmpLoading]         = useState(true);
  const [empSearch, setEmpSearch]           = useState('');
  const [selectedIds, setSelectedIds]       = useState(new Set());

  const [periods, setPeriods]               = useState([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [periodTypeFilter, setPeriodTypeFilter] = useState('all');
  const [periodSearch, setPeriodSearch]     = useState('');
  const [verificationStatus, setVerificationStatus] = useState({});
  const [verLoading,         setVerLoading]         = useState(false);
  const [payslipEmpIds,      setPayslipEmpIds]      = useState(new Set());

  const [generating, setGenerating]         = useState(false);
  const [progress, setProgress]             = useState({ done: 0, total: 0 });
  const [currentGenEmp, setCurrentGenEmp]   = useState(null);

  const [preview, setPreview]               = useState(null);
  const [submitted, setSubmitted]           = useState(null);
  const [expandedDays, setExpandedDays]     = useState(false);
  const [expandedTasks, setExpandedTasks]   = useState(true);
  const [taskPanelWidth, setTaskPanelWidth] = useState(360);
  const isDraggingTask  = React.useRef(false);
  const dragStartX      = React.useRef(0);
  const dragStartWidth  = React.useRef(360);

  const onTaskDragStart = (e) => {
    e.preventDefault();
    isDraggingTask.current  = true;
    dragStartX.current      = e.clientX;
    dragStartWidth.current  = taskPanelWidth;
    const onMove = (mv) => {
      if (!isDraggingTask.current) return;
      const delta = dragStartX.current - mv.clientX;
      setTaskPanelWidth(Math.max(200, Math.min(640, dragStartWidth.current + delta)));
    };
    const onUp = () => {
      isDraggingTask.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const [bulkResults, setBulkResults] = useState(null);

  // Pay periods filtered by type (local/international) + search term
  const pq = periodSearch.trim().toLowerCase();
  const visiblePeriods = periods.filter(p => {
    const isForeign = p.period_type === 'foreign';
    if (periodTypeFilter === 'local' && isForeign) return false;
    if (periodTypeFilter === 'foreign' && !isForeign) return false;
    if (!pq) return true;
    return (p.period_name || '').toLowerCase().includes(pq);
  });

  // Employees filtered by period type AND verified status
  const periodCategory = selectedPeriod?.period_type === 'foreign' ? 'foreign' : 'local';
  const allPeriodEmployees = selectedPeriod
    ? employees.filter(e => (e.hire_category || 'local') === periodCategory)
    : [];
  const eligibleEmployees = allPeriodEmployees.filter(
    e => verificationStatus[e.id]?.status === 'verified' && !payslipEmpIds.has(e.id)
  );
  const doneEmployees = allPeriodEmployees.filter(e => payslipEmpIds.has(e.id));
  const rejectedEmployees = allPeriodEmployees.filter(
    e => verificationStatus[e.id]?.status === 'rejected'
  );
  const pendingEmployees  = allPeriodEmployees.filter(
    e => !verificationStatus[e.id] || verificationStatus[e.id]?.status === 'pending'
  );

  const hasSelection = selectedIds.size > 0;
  const allSelected  = eligibleEmployees.length > 0 && selectedIds.size === eligibleEmployees.length;
  const isSingle     = selectedIds.size === 1;
  const isDone       = isSingle ? !!submitted : !!bulkResults;

  // Step: 0=Select Period, 1=Select Employees, 2=Generate
  const step = isDone ? 2 : (hasSelection && selectedPeriod) ? 2 : selectedPeriod ? 1 : 0;

  const startDate = selectedPeriod?.start_date ? String(selectedPeriod.start_date).substring(0, 10) : '';
  const endDate   = selectedPeriod?.end_date   ? String(selectedPeriod.end_date).substring(0, 10)   : '';

  useEffect(() => {
    employeesAPI.getAll(true)
      .then(res => setEmployees(res.data || []))
      .catch(() => toast.error('Failed to load employees'))
      .finally(() => setEmpLoading(false));
    timesheetAPI.getPeriods(100, 0)
      .then(res => setPeriods(res.data || []))
      .catch(() => toast.error('Failed to load periods'))
      .finally(() => setPeriodsLoading(false));
  }, []);

  const handleSelectPeriod = (p) => {
    setSelectedPeriod(p);
    setSelectedIds(new Set());
    setPreview(null); setSubmitted(null); setBulkResults(null);
    setVerificationStatus({});
    setPayslipEmpIds(new Set());
    setVerLoading(true);
    Promise.all([
      verificationsAPI.getStatus(p.id),
      timesheetAPI.getPeriodPayslips(p.id),
    ])
      .then(([verRes, payRes]) => {
        setVerificationStatus(verRes.data || {});
        setPayslipEmpIds(new Set((payRes.data || []).map(ps => ps.employee_id)));
      })
      .catch(() => { setVerificationStatus({}); setPayslipEmpIds(new Set()); })
      .finally(() => setVerLoading(false));
  };

  const toggleEmployee = (id) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    setPreview(null); setSubmitted(null); setBulkResults(null);
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(eligibleEmployees.map(e => e.id)));
    setPreview(null); setSubmitted(null); setBulkResults(null);
  };

  const handleGenerate = async () => {
    if (!hasSelection || !selectedPeriod) return;
    setGenerating(true);
    setPreview(null); setSubmitted(null); setBulkResults(null);
    const empIds = [...selectedIds];

    if (isSingle) {
      const emp = employees.find(e => e.id === empIds[0]);
      try {
        const previewRes = await timesheetGeneratorAPI.preview(emp.id, startDate, endDate);
        setPreview(previewRes.data);
        if (previewRes.data.wrikeError) toast(`Wrike fetch failed: ${previewRes.data.wrikeError}`, { icon: '⚠️', duration: 6000 });
        if (previewRes.data.totalHours === 0) {
          if (previewRes.data.noApprovedHours) toast('No Wrike-approved hours found.', { icon: '⚠️', duration: 8000 });
          else toast('No hours found for this period.', { icon: '⚠️' });
          return;
        }
        if (previewRes.data.source === 'db') toast('Using imported hours from database.', { icon: 'ℹ️', duration: 5000 });
        const res = await timesheetGeneratorAPI.submit(emp.id, startDate, endDate, selectedPeriod.period_name);
        let resultData = res.data;
        if (resultData?.jobId) resultData = await pollJob(resultData.jobId);
        setSubmitted(resultData);
        if (resultData?.alreadyPending) toast('Timesheet already processed.', { icon: 'ℹ️', duration: 5000 });
        else toast.success('Payslip generated successfully!');
      } catch (err) {
        toast.error(err.response?.data?.error || err.message || 'Failed to generate payslip');
      } finally { setGenerating(false); }
    } else {
      const results = [];
      setProgress({ done: 0, total: empIds.length });
      for (let i = 0; i < empIds.length; i++) {
        const emp = employees.find(e => e.id === empIds[i]);
        setCurrentGenEmp(emp.name);
        try {
          const previewRes = await timesheetGeneratorAPI.preview(emp.id, startDate, endDate);
          if (previewRes.data.totalHours === 0) {
            results.push({ emp, status: 'no_hours', noApprovedHours: previewRes.data.noApprovedHours });
          } else {
            const res = await timesheetGeneratorAPI.submit(emp.id, startDate, endDate, selectedPeriod.period_name);
            let resultData = res.data;
            if (resultData?.jobId) resultData = await pollJob(resultData.jobId);
            results.push({ emp, status: resultData?.alreadyPending ? 'exists' : 'generated', hours: previewRes.data.totalHours, gross: previewRes.data.grossAmount });
          }
        } catch (err) {
          results.push({ emp, status: 'error', error: err.response?.data?.error || err.message || 'Failed' });
        }
        setProgress({ done: i + 1, total: empIds.length });
      }
      setCurrentGenEmp(null);
      setBulkResults(results);
      const generated = results.filter(r => r.status === 'generated').length;
      const errors    = results.filter(r => r.status === 'error').length;
      if (errors > 0) toast(`Generated ${generated}, ${errors} failed`, { icon: '⚠️' });
      else toast.success(`Generated ${generated} of ${empIds.length} payslips`);
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setSelectedIds(new Set()); setSelectedPeriod(null);
    setPreview(null); setSubmitted(null); setBulkResults(null);
    setVerificationStatus({}); setPayslipEmpIds(new Set());
  };

  const singleEmp    = isSingle ? employees.find(e => selectedIds.has(e.id)) : null;
  const currency     = singleEmp?.currency || 'USD';
  const sortedTasks  = preview?.taskDetails ? [...preview.taskDetails].sort((a, b) => a.date.localeCompare(b.date)) : [];
  const dailyEntries = preview?.dailyHours  ? Object.entries(preview.dailyHours).filter(([, h]) => h > 0).sort(([a], [b]) => a.localeCompare(b)) : [];
  const showRight    = (isSingle && preview) || (!isSingle && bulkResults);

  const visibleEmployees = empSearch
    ? eligibleEmployees.filter(e => e.name.toLowerCase().includes(empSearch.toLowerCase()) || e.employee_id?.toLowerCase().includes(empSearch.toLowerCase()))
    : eligibleEmployees;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #10b981, #34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ReceiptIcon sx={{ color: 'white', fontSize: 18 }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Process Payroll</Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>Select a pay period — then choose from verified employees</Typography>
          </Box>
        </Box>
        {(selectedPeriod || hasSelection) && (
          <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={handleReset}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: '#ef4444', color: '#ef4444' } }}>
            Start Over
          </Button>
        )}
      </Box>

      <StepIndicator steps={['Select Period', 'Select Employees', 'Generate']} current={step} />

      <Grid container spacing={2} sx={{ alignItems: 'start' }}>
        {/* ── Left panel ─────────────────────────────────────────────────── */}
        <Grid item xs={12} md={showRight ? 4 : 5}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

            {/* ── Step 1: Period select (always active) ── */}
            <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: selectedPeriod ? '#6366f140' : 'divider', overflow: 'hidden' }}>
              <Box sx={{ px: 2, py: 1.75, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 28, height: 28, borderRadius: '8px', bgcolor: '#6366f115', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CalendarMonthIcon sx={{ fontSize: 14, color: '#6366f1' }} />
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Pay Period</Typography>
                </Box>
                <Button size="small" component={Link} to="/periods" startIcon={<AddIcon sx={{ fontSize: '13px !important' }} />}
                  sx={{ textTransform: 'none', fontSize: '0.72rem', fontWeight: 600, color: '#6366f1', borderRadius: '8px', py: 0.4, px: 1, bgcolor: '#6366f110', '&:hover': { bgcolor: '#6366f120' } }}>
                  New
                </Button>
              </Box>

              {!periodsLoading && periods.length > 0 && (
                <Box sx={{ px: 1.5, pt: 1.25, pb: 1, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {[
                      { value: 'all',     label: 'All',           color: '#6366f1' },
                      { value: 'local',   label: 'Local',         color: '#6366f1' },
                      { value: 'foreign', label: 'International',  color: '#0ea5e9' },
                    ].map(t => {
                      const active = periodTypeFilter === t.value;
                      return (
                        <Box key={t.value} onClick={() => setPeriodTypeFilter(t.value)}
                          sx={{ flex: 1, textAlign: 'center', py: 0.5, cursor: 'pointer', borderRadius: '7px',
                            border: '1px solid', borderColor: active ? t.color : 'divider',
                            bgcolor: active ? `${t.color}12` : 'transparent',
                            transition: 'all 0.15s', '&:hover': { bgcolor: `${t.color}10` } }}>
                          <Typography sx={{ fontSize: '0.68rem', fontWeight: active ? 700 : 500, color: active ? t.color : 'text.secondary' }}>
                            {t.label}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                  <TextField
                    size="small" placeholder="Search period…"
                    value={periodSearch} onChange={e => setPeriodSearch(e.target.value)}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment>,
                      endAdornment: periodSearch ? (
                        <InputAdornment position="end">
                          <Box component="span" onClick={() => setPeriodSearch('')} sx={{ cursor: 'pointer', color: 'text.disabled', fontSize: '1rem', lineHeight: 1, px: 0.5 }}>×</Box>
                        </InputAdornment>
                      ) : null,
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.76rem' } }}
                  />
                </Box>
              )}

              {periodsLoading ? (
                <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={20} sx={{ color: '#6366f1' }} /></Box>
              ) : periods.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center', px: 2 }}>
                  <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled', mb: 1.5 }}>No pay periods yet.</Typography>
                  <Button variant="outlined" size="small" component={Link} to="/periods" startIcon={<AddIcon />}
                    sx={{ textTransform: 'none', borderRadius: '8px', borderColor: '#6366f1', color: '#6366f1', fontSize: '0.75rem' }}>
                    Create a Period
                  </Button>
                </Box>
              ) : (
                <Box sx={{ maxHeight: 260, overflowY: 'auto' }}>
                  {visiblePeriods.length === 0 ? (
                    <Box sx={{ py: 4, textAlign: 'center', px: 2 }}>
                      <Typography sx={{ fontSize: '0.78rem', color: 'text.disabled' }}>No periods match your filter</Typography>
                    </Box>
                  ) : visiblePeriods.map((p, idx) => {
                    const sel       = selectedPeriod?.id === p.id;
                    const typeColor = p.period_type === 'foreign' ? '#0ea5e9' : '#6366f1';
                    const statusLabel = PERIOD_STATUS_LABEL[p.status] || p.status;
                    const statusColor = PERIOD_STATUS_COLOR[p.status] || '#6366f1';
                    return (
                      <Box key={p.id}
                        onClick={() => handleSelectPeriod(p)}
                        sx={{ px: 2, py: 1.25, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          bgcolor: sel ? `${typeColor}08` : 'transparent',
                          borderLeft: sel ? `3px solid ${typeColor}` : '3px solid transparent',
                          borderBottom: idx < visiblePeriods.length - 1 ? '1px solid' : 'none',
                          borderBottomColor: 'divider', transition: 'all 0.15s',
                          '&:hover': { bgcolor: sel ? `${typeColor}10` : 'action.hover' } }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontWeight: sel ? 700 : 500, fontSize: '0.82rem', color: sel ? typeColor : 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.period_name}
                          </Typography>
                          <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', mt: 0.15 }}>
                            {new Date(p.start_date).toLocaleDateString()} – {new Date(p.end_date).toLocaleDateString()}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0, ml: 1 }}>
                          <Chip label={p.period_type === 'foreign' ? 'Intl' : 'Local'} size="small"
                            sx={{ height: 16, fontSize: '0.58rem', fontWeight: 700, bgcolor: `${typeColor}18`, color: typeColor }} />
                          <Chip label={statusLabel} size="small"
                            sx={{ height: 16, fontSize: '0.58rem', fontWeight: 600,
                              bgcolor: `${statusColor}18`, color: statusColor }} />
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Paper>

            {/* ── Step 2: Employee select (active after period is chosen) ── */}
            <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', overflow: 'hidden',
              opacity: selectedPeriod ? 1 : 0.45, pointerEvents: selectedPeriod ? 'auto' : 'none' }}>
              <Box sx={{ px: 2, py: 1.75, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 28, height: 28, borderRadius: '8px', bgcolor: '#10b98115', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PeopleIcon sx={{ fontSize: 14, color: '#10b981' }} />
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Employees</Typography>
                  {selectedPeriod && (
                    <Chip label={selectedPeriod.period_type === 'foreign' ? 'International' : 'Local'} size="small"
                      sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700,
                        bgcolor: selectedPeriod.period_type === 'foreign' ? '#0ea5e918' : '#10b98118',
                        color:   selectedPeriod.period_type === 'foreign' ? '#0ea5e9'   : '#10b981' }} />
                  )}
                </Box>
                {selectedIds.size > 0 && (
                  <Chip label={`${selectedIds.size} selected`} size="small"
                    sx={{ bgcolor: '#10b98115', color: '#10b981', fontWeight: 700, fontSize: '0.7rem', height: 22 }} />
                )}
              </Box>

              {!selectedPeriod ? (
                <Box sx={{ py: 6, textAlign: 'center', color: 'text.disabled' }}>
                  <CalendarMonthIcon sx={{ fontSize: 30, opacity: 0.2, mb: 1 }} />
                  <Typography sx={{ fontSize: '0.82rem' }}>Select a pay period first</Typography>
                </Box>
              ) : verLoading || empLoading ? (
                <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}><CircularProgress size={22} sx={{ color: '#10b981' }} /></Box>
              ) : doneEmployees.length === allPeriodEmployees.length && allPeriodEmployees.length > 0 ? (
                // All employees already have payslips
                <Box sx={{ py: 5, px: 2.5, textAlign: 'center' }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: '#10b98115', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 1.5 }}>
                    <CheckCircleIcon sx={{ fontSize: 22, color: '#10b981' }} />
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#065f46', mb: 0.5 }}>All Payslips Generated</Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 2 }}>
                    All {doneEmployees.length} {periodCategory} employees already have payslips for this period.
                    To regenerate, delete the existing payslips first from the Payslips page.
                  </Typography>
                  <Chip label={`${doneEmployees.length} payslips exist`} size="small" icon={<CheckCircleIcon sx={{ fontSize: '13px !important' }} />}
                    sx={{ bgcolor: '#10b98115', color: '#10b981', fontWeight: 700, '& .MuiChip-icon': { color: '#10b981' } }} />
                </Box>
              ) : allPeriodEmployees.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center', px: 2 }}>
                  <PeopleIcon sx={{ fontSize: 30, opacity: 0.2, color: 'text.disabled', mb: 1 }} />
                  <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: 'text.secondary', mb: 0.5 }}>No Employees</Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: 'text.disabled' }}>
                    No {selectedPeriod.period_type === 'foreign' ? 'international' : 'local'} employees exist in the system.
                  </Typography>
                </Box>
              ) : eligibleEmployees.length === 0 && doneEmployees.length > 0 ? (
                // Partially done: some payslips generated, remaining employees not yet verified
                <Box sx={{ py: 3, px: 2.5 }}>
                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <Chip icon={<CheckCircleIcon sx={{ fontSize: '13px !important' }} />}
                      label={`${doneEmployees.length} payslip${doneEmployees.length !== 1 ? 's' : ''} generated`}
                      size="small" sx={{ bgcolor: '#10b98115', color: '#10b981', fontWeight: 700, fontSize: '0.7rem', '& .MuiChip-icon': { color: '#10b981' } }} />
                    {pendingEmployees.length > 0 && (
                      <Chip label={`${pendingEmployees.length} not yet verified`}
                        size="small" sx={{ bgcolor: '#f59e0b15', color: '#f59e0b', fontWeight: 700, fontSize: '0.7rem' }} />
                    )}
                    {rejectedEmployees.length > 0 && (
                      <Chip label={`${rejectedEmployees.length} rejected`}
                        size="small" sx={{ bgcolor: '#ef444415', color: '#ef4444', fontWeight: 700, fontSize: '0.7rem' }} />
                    )}
                  </Box>
                  <Box sx={{ bgcolor: '#10b9810a', border: '1px solid #10b98130', borderRadius: '12px', p: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <CheckCircleIcon sx={{ fontSize: 18, color: '#10b981', mt: 0.1, flexShrink: 0 }} />
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: '#065f46', mb: 0.4 }}>
                          Payroll partially processed
                        </Typography>
                        <Typography sx={{ fontSize: '0.78rem', color: '#065f46', lineHeight: 1.5 }}>
                          {doneEmployees.length} payslip{doneEmployees.length !== 1 ? 's have' : ' has'} already been generated.
                          {pendingEmployees.length > 0 && ` ${pendingEmployees.length} remaining employee${pendingEmployees.length !== 1 ? 's' : ''} need${pendingEmployees.length === 1 ? 's' : ''} timesheet verification before they can be processed.`}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                  {(pendingEmployees.length > 0 || rejectedEmployees.length > 0) && (
                    <Button component={Link} to="/wrike" variant="outlined" size="small" startIcon={<VerifiedUserIcon sx={{ fontSize: '14px !important' }} />}
                      sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.8rem',
                        borderColor: '#6366f1', color: '#6366f1', '&:hover': { bgcolor: '#6366f110', borderColor: '#6366f1' } }}>
                      Verify Remaining Employees
                    </Button>
                  )}
                </Box>
              ) : eligibleEmployees.length === 0 ? (
                <Box sx={{ py: 3, px: 2.5 }}>
                  {/* Status breakdown */}
                  <Box sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap' }}>
                    <Chip icon={<PeopleIcon sx={{ fontSize: '13px !important' }} />}
                      label={`${allPeriodEmployees.length} total employee${allPeriodEmployees.length !== 1 ? 's' : ''}`}
                      size="small" sx={{ bgcolor: '#6366f115', color: '#6366f1', fontWeight: 700, fontSize: '0.7rem' }} />
                    {pendingEmployees.length > 0 && (
                      <Chip label={`${pendingEmployees.length} not verified`}
                        size="small" sx={{ bgcolor: '#f59e0b15', color: '#f59e0b', fontWeight: 700, fontSize: '0.7rem' }} />
                    )}
                    {rejectedEmployees.length > 0 && (
                      <Chip label={`${rejectedEmployees.length} rejected`}
                        size="small" sx={{ bgcolor: '#ef444415', color: '#ef4444', fontWeight: 700, fontSize: '0.7rem' }} />
                    )}
                  </Box>
                  {/* Guidance */}
                  <Box sx={{ bgcolor: '#f59e0b0a', border: '1px solid #f59e0b30', borderRadius: '12px', p: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <VerifiedUserIcon sx={{ fontSize: 18, color: '#f59e0b', mt: 0.1, flexShrink: 0 }} />
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: '#92400e', mb: 0.4 }}>
                          No verified employees for this period
                        </Typography>
                        <Typography sx={{ fontSize: '0.78rem', color: '#92400e', lineHeight: 1.5 }}>
                          {allPeriodEmployees.length} {selectedPeriod.period_type === 'foreign' ? 'international' : 'local'} employee{allPeriodEmployees.length !== 1 ? 's are' : ' is'} set up but {allPeriodEmployees.length !== 1 ? 'none have' : 'has not'} been verified for this pay period yet.
                          You need to verify timesheets first before processing payroll.
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', mb: 1.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Follow these steps:
                  </Typography>
                  {[
                    { step: 1, label: 'Go to Verify Timesheet', sub: 'Review and verify each employee\'s timesheet for this period', action: true },
                    { step: 2, label: 'Mark employees as Verified', sub: 'Only verified employees will appear here for processing' },
                    { step: 3, label: 'Come back to Process Payroll', sub: 'Select this period again and the verified list will appear' },
                  ].map(({ step: n, label, sub, action }) => (
                    <Box key={n} sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'flex-start' }}>
                      <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: '#6366f115', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.1 }}>
                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: '#6366f1' }}>{n}</Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'text.primary', lineHeight: 1.3 }}>{label}</Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{sub}</Typography>
                      </Box>
                    </Box>
                  ))}
                  <Button component={Link} to="/wrike" variant="contained" size="small" startIcon={<VerifiedUserIcon sx={{ fontSize: '14px !important' }} />}
                    sx={{ mt: 1, textTransform: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.8rem',
                      background: 'linear-gradient(135deg, #6366f1, #818cf8)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
                    Go to Verify Timesheet
                  </Button>
                </Box>
              ) : (
                <>
                  {/* Partial payslip banner */}
                  {doneEmployees.length > 0 && doneEmployees.length < allPeriodEmployees.length && (
                    <Box sx={{ px: 2, py: 1, bgcolor: '#10b9810a', borderBottom: '1px solid #10b98125', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleIcon sx={{ fontSize: 14, color: '#10b981', flexShrink: 0 }} />
                      <Typography sx={{ fontSize: '0.72rem', color: '#065f46' }}>
                        <strong>{doneEmployees.length}</strong> of {allPeriodEmployees.length} employees already have payslips — showing only the remaining {eligibleEmployees.length}.
                      </Typography>
                    </Box>
                  )}

                  {/* Partial verification banner */}
                  {(pendingEmployees.length > 0 || rejectedEmployees.length > 0) && (
                    <Box sx={{ px: 2, py: 1, bgcolor: '#f59e0b0a', borderBottom: '1px solid #f59e0b25', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: '0.72rem', color: '#92400e', lineHeight: 1.4 }}>
                        Showing <strong>{eligibleEmployees.length} verified</strong> of {allPeriodEmployees.length} employees.
                        {pendingEmployees.length > 0 && ` ${pendingEmployees.length} still need verification.`}
                        {rejectedEmployees.length > 0 && ` ${rejectedEmployees.length} rejected.`}
                      </Typography>
                      <Button component={Link} to="/wrike" size="small"
                        sx={{ textTransform: 'none', fontSize: '0.68rem', fontWeight: 700, color: '#6366f1', flexShrink: 0, p: 0.5,
                          '&:hover': { bgcolor: '#6366f110' } }}>
                        Verify more →
                      </Button>
                    </Box>
                  )}

                  {/* Search */}
                  <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderBottomColor: 'divider' }}>
                    <TextField fullWidth size="small" placeholder="Search employees…" value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '0.82rem' } }}
                      slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment> } }} />
                  </Box>

                  {/* Select All */}
                  <Box onClick={toggleAll}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, cursor: 'pointer', bgcolor: 'rgba(16,185,129,0.03)', borderBottom: '1px solid', borderBottomColor: 'divider', '&:hover': { bgcolor: 'rgba(16,185,129,0.06)' } }}>
                    <Checkbox size="small" checked={allSelected} indeterminate={selectedIds.size > 0 && !allSelected}
                      onChange={toggleAll} onClick={e => e.stopPropagation()}
                      sx={{ p: 0, color: '#10b981', '&.Mui-checked': { color: '#10b981' }, '&.MuiCheckbox-indeterminate': { color: '#10b981' } }} />
                    <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#10b981' }}>
                      {allSelected ? 'Deselect All' : 'Select All'} ({eligibleEmployees.length} verified)
                    </Typography>
                  </Box>

                  {/* Employee list */}
                  <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                    {visibleEmployees.map((emp, idx) => {
                      const checked = selectedIds.has(emp.id);
                      return (
                        <Box key={emp.id}>
                          <Box onClick={() => toggleEmployee(emp.id)}
                            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.1, cursor: 'pointer',
                              bgcolor: checked ? '#10b98108' : 'transparent',
                              borderLeft: checked ? '3px solid #10b981' : '3px solid transparent',
                              transition: 'all 0.15s',
                              '&:hover': { bgcolor: checked ? '#10b98110' : 'action.hover' } }}>
                            <Checkbox size="small" checked={checked} onChange={() => toggleEmployee(emp.id)} onClick={e => e.stopPropagation()}
                              sx={{ p: 0, color: 'text.disabled', '&.Mui-checked': { color: '#10b981' } }} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <Typography sx={{ fontWeight: checked ? 700 : 500, fontSize: '0.85rem', color: 'text.primary', lineHeight: 1.3 }}>
                                  {emp.name}
                                </Typography>
                                <Chip label="Verified" size="small"
                                  sx={{ height: 14, fontSize: '0.55rem', fontWeight: 700, bgcolor: '#10b98115', color: '#10b981' }} />
                              </Box>
                              <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
                                {emp.employee_id}{emp.department ? ` · ${emp.department}` : ''}{showHourlyRate ? ` · ${emp.currency || 'USD'} ${emp.hourly_rate}/hr` : ''}
                              </Typography>
                            </Box>
                          </Box>
                          {idx < visibleEmployees.length - 1 && <Divider />}
                        </Box>
                      );
                    })}
                  </Box>
                </>
              )}
            </Paper>

            {/* Generate button */}
            {!isDone && !isReadOnly && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Button variant="contained" fullWidth size="large"
                  startIcon={generating ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <ReceiptIcon />}
                  onClick={handleGenerate}
                  disabled={!hasSelection || !selectedPeriod || generating}
                  sx={{ py: 1.4, borderRadius: '12px', textTransform: 'none', fontSize: '0.95rem', fontWeight: 700,
                    background: 'linear-gradient(135deg, #10b981, #34d399)',
                    boxShadow: '0 4px 16px rgba(16,185,129,0.4)',
                    '&:disabled': { opacity: 0.5, boxShadow: 'none' } }}>
                  {generating
                    ? (isSingle ? 'Processing…' : `Processing ${progress.done} / ${progress.total}…`)
                    : `Process Payroll${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
                </Button>

                {/* Bulk progress */}
                {generating && !isSingle && progress.total > 0 && (
                  <Paper elevation={0} sx={{ borderRadius: '12px', border: '1px solid', borderColor: 'divider', p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 700 }}>
                        {currentGenEmp ? `Processing: ${currentGenEmp}` : 'Generating payslips…'}
                      </Typography>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: '#10b981' }}>
                        {Math.round((progress.done / progress.total) * 100)}%
                      </Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={(progress.done / progress.total) * 100}
                      sx={{ height: 7, borderRadius: 4, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#10b981', borderRadius: 4 } }} />
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', mt: 0.75 }}>{progress.done} of {progress.total} done</Typography>
                  </Paper>
                )}
              </Box>
            )}
          </Box>
        </Grid>

        {/* ── Right panel — single employee preview ──────────────────────── */}
        {isSingle && preview && (
          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>

                {submitted && (
                  <Alert severity={submitted.alreadyPending ? 'info' : 'success'} sx={{ borderRadius: '12px' }}>
                    <strong>{submitted.alreadyPending ? 'Already Processed' : 'Payslip Generated'}</strong><br />
                    {submitted.alreadyPending
                      ? 'This timesheet has already been processed — no duplicate created.'
                      : `Payslip for ${singleEmp?.name} generated successfully.`}
                  </Alert>
                )}

                {(preview.source === 'db' || preview.wrikeError) && (
                  <Alert severity={preview.wrikeError ? 'error' : 'warning'} sx={{ borderRadius: '12px' }}>
                    {preview.wrikeError && <><strong>Wrike API error:</strong> {preview.wrikeError}<br /></>}
                    {preview.source === 'db' && 'Showing hours from imported database records — Wrike returned 0 for this period.'}
                  </Alert>
                )}

                {/* Summary cards */}
                <Grid container spacing={1.5}>
                  <Grid item xs={showRates ? 4 : 6}>
                    <SummaryCard icon={<AccessTimeIcon />}  label="Total Hours"   value={formatHoursAsHM(preview.totalHours)}                              color="#6366f1" />
                  </Grid>
                  <Grid item xs={showRates ? 4 : 6}>
                    <SummaryCard icon={<TrendingUpIcon />}  label="Regular / OT"  value={`${formatHoursAsHM(preview.regularHours)} / ${formatHoursAsHM(preview.overtimeHours)}`} color="#f59e0b" />
                  </Grid>
                  {showRates && (
                    <Grid item xs={4}>
                      <SummaryCard icon={<ReceiptLongIcon />} label="Gross Pay"   value={fmt(preview.grossAmount, currency)}                     color="#10b981" />
                    </Grid>
                  )}
                </Grid>

                {/* Rate breakdown */}
                <Paper elevation={0} sx={{ p: 2, borderRadius: '14px', border: '1px solid', borderColor: 'divider' }}>
                  <Grid container spacing={2}>
                    <Grid item xs={showHourlyRate ? 4 : 6}>
                      <Typography sx={{ color: 'text.secondary', fontSize: '0.72rem', mb: 0.5 }}>Period</Typography>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{fmtDate(startDate)} – {fmtDate(endDate)}</Typography>
                    </Grid>
                    {showHourlyRate && (
                      <Grid item xs={4}>
                        <Typography sx={{ color: 'text.secondary', fontSize: '0.72rem', mb: 0.5 }}>Hourly Rate</Typography>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{fmt(preview.hourlyRate, currency)}/hr</Typography>
                      </Grid>
                    )}
                    {showRates && (
                      <Grid item xs={showHourlyRate ? 4 : 6}>
                        <Typography sx={{ color: 'text.secondary', fontSize: '0.72rem', mb: 0.5 }}>Regular Pay</Typography>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{fmt(preview.regularHours * preview.hourlyRate, currency)}</Typography>
                      </Grid>
                    )}
                  </Grid>
                  {showRates && preview.overtimeHours > 0 && (
                    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderTopColor: 'divider', display: 'flex', gap: 3 }}>
                      {showHourlyRate && (
                        <Box>
                          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.25 }}>OT Rate</Typography>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{fmt(preview.hourlyRate * 1.5, currency)}/hr</Typography>
                        </Box>
                      )}
                      <Box>
                        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.25 }}>OT Pay</Typography>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#f59e0b' }}>{fmt(preview.overtimeHours * preview.hourlyRate * 1.5, currency)}</Typography>
                      </Box>
                    </Box>
                  )}
                </Paper>

                {/* Daily breakdown */}
                {dailyEntries.length > 0 && (
                  <Paper elevation={0} sx={{ borderRadius: '14px', border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                    <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none', borderBottom: expandedDays ? '1px solid' : 'none', borderBottomColor: 'divider' }}
                      onClick={() => setExpandedDays(v => !v)}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Daily Breakdown ({dailyEntries.length} days)</Typography>
                      {expandedDays ? <ExpandLessIcon sx={{ fontSize: 18, color: 'text.disabled' }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: 'text.disabled' }} />}
                    </Box>
                    <Collapse in={expandedDays}>
                      <TableContainer>
                        <Table size="small">
                          <TableHead sx={{ bgcolor: 'action.hover' }}>
                            <TableRow>
                              <TableCell sx={TH}>Date</TableCell>
                              <TableCell sx={{ ...TH, textAlign: 'right' }}>Hours</TableCell>
                              {showRates && <TableCell sx={{ ...TH, textAlign: 'right' }}>Pay</TableCell>}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {dailyEntries.map(([date, hours]) => (
                              <TableRow key={date} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                                <TableCell sx={TD}>{fmtDay(date)}</TableCell>
                                <TableCell sx={{ ...TD, textAlign: 'right', fontWeight: 600 }}>{formatHoursAsHM(hours)}</TableCell>
                                {showRates && <TableCell sx={{ ...TD, textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{fmt(hours * preview.hourlyRate, currency)}</TableCell>}
                              </TableRow>
                            ))}
                            <TableRow sx={{ bgcolor: 'action.hover' }}>
                              <TableCell sx={{ ...TD, fontWeight: 800 }}>Total</TableCell>
                              <TableCell sx={{ ...TD, textAlign: 'right', fontWeight: 800 }}>{formatHoursAsHM(preview.totalHours)}</TableCell>
                              {showRates && <TableCell sx={{ ...TD, textAlign: 'right', fontWeight: 800, color: '#10b981' }}>{fmt(preview.grossAmount, currency)}</TableCell>}
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Collapse>
                  </Paper>
                )}

                {preview.totalHours === 0 && (
                  <Paper elevation={0} sx={{ p: 5, borderRadius: '14px', border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                    <AccessTimeIcon sx={{ fontSize: 26, color: 'text.disabled', mb: 1 }} />
                    <Typography sx={{ fontWeight: 700, mb: 0.75, color: 'text.secondary' }}>
                      {preview.noApprovedHours ? 'No Approved Hours in Wrike' : 'No Hours Found'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: 'text.disabled' }}>
                      {preview.noApprovedHours
                        ? <>Timelogs exist but none are approved yet.</>
                        : <>No time logged between {fmtDate(startDate)} and {fmtDate(endDate)}.</>}
                    </Typography>
                  </Paper>
                )}

                {/* Mobile task details */}
                {sortedTasks.length > 0 && (
                  <Paper elevation={0} sx={{ display: { xs: 'block', md: 'none' }, borderRadius: '14px', border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                    <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid', borderBottomColor: 'divider' }}
                      onClick={() => setExpandedTasks(v => !v)}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Task Details ({sortedTasks.length})</Typography>
                      {expandedTasks ? <ExpandLessIcon sx={{ fontSize: 18, color: 'text.disabled' }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: 'text.disabled' }} />}
                    </Box>
                    <Collapse in={expandedTasks}>
                      <TableContainer>
                        <Table size="small">
                          <TableHead sx={{ bgcolor: 'action.hover' }}>
                            <TableRow>{['Date','Task','Comment','Hrs'].map((h, i) => <TableCell key={h} sx={{ ...TH, textAlign: i === 3 ? 'right' : 'left' }}>{h}</TableCell>)}</TableRow>
                          </TableHead>
                          <TableBody>
                            {sortedTasks.map((t, i) => (
                              <TableRow key={i} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                                <TableCell sx={{ ...TD, whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{fmtDay(t.date)}</TableCell>
                                <TableCell sx={{ ...TD, color: '#6366f1', fontSize: '0.78rem' }}>{t.taskTitle}</TableCell>
                                <TableCell sx={{ ...TD, color: 'text.disabled', fontSize: '0.78rem' }}>{t.comment || '—'}</TableCell>
                                <TableCell sx={{ ...TD, textAlign: 'right', fontWeight: 700, fontSize: '0.78rem' }}>{formatHoursAsHM(t.hours)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Collapse>
                  </Paper>
                )}
              </Box>

              {/* Desktop task panel (draggable) */}
              {sortedTasks.length > 0 && (
                <Box sx={{ display: { xs: 'none', md: 'flex' }, flexShrink: 0, width: taskPanelWidth, alignSelf: 'stretch' }}>
                  <Box onMouseDown={onTaskDragStart}
                    sx={{ width: 8, flexShrink: 0, cursor: 'ew-resize', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: 'action.hover', borderLeft: '1px solid', borderRight: '1px solid', borderColor: 'divider',
                      '&:hover': { bgcolor: '#6366f115' } }}>
                    <Box sx={{ width: 2, height: 28, borderRadius: 4, bgcolor: 'text.disabled', opacity: 0.3 }} />
                  </Box>
                  <Paper elevation={0} sx={{ flex: 1, borderRadius: '0 14px 14px 0', border: '1px solid', borderColor: 'divider', borderLeft: 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid', borderBottomColor: 'divider' }}
                      onClick={() => setExpandedTasks(v => !v)}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Task Details ({sortedTasks.length})</Typography>
                      {expandedTasks ? <ExpandLessIcon sx={{ fontSize: 18, color: 'text.disabled' }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: 'text.disabled' }} />}
                    </Box>
                    <Collapse in={expandedTasks}>
                      <TableContainer sx={{ maxHeight: '70vh', overflow: 'auto' }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>{['Date','Task','Comment','Hrs'].map((h, i) => <TableCell key={h} sx={{ ...TH, bgcolor: 'action.hover', textAlign: i === 3 ? 'right' : 'left' }}>{h}</TableCell>)}</TableRow>
                          </TableHead>
                          <TableBody>
                            {sortedTasks.map((t, i) => (
                              <TableRow key={i} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                                <TableCell sx={{ ...TD, whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{fmtDay(t.date)}</TableCell>
                                <TableCell sx={{ ...TD, color: '#6366f1', fontSize: '0.78rem', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.taskTitle}</TableCell>
                                <TableCell sx={{ ...TD, color: 'text.disabled', fontSize: '0.78rem', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.comment || '—'}</TableCell>
                                <TableCell sx={{ ...TD, textAlign: 'right', fontWeight: 700, fontSize: '0.78rem' }}>{formatHoursAsHM(t.hours)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Collapse>
                  </Paper>
                </Box>
              )}
            </Box>
          </Grid>
        )}

        {/* ── Right panel — bulk results ──────────────────────────────────── */}
        {!isSingle && bulkResults && (
          <Grid item xs={12} md={8}>
            <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
              <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Generation Results</Typography>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Generated',     count: bulkResults.filter(r => r.status === 'generated').length, color: '#10b981' },
                    { label: 'Already Exist', count: bulkResults.filter(r => r.status === 'exists').length,    color: '#6366f1' },
                    { label: 'No Hours',      count: bulkResults.filter(r => r.status === 'no_hours').length,  color: '#f59e0b' },
                    { label: 'Errors',        count: bulkResults.filter(r => r.status === 'error').length,     color: '#ef4444' },
                  ].filter(s => s.count > 0).map(s => (
                    <Chip key={s.label} label={`${s.count} ${s.label}`} size="small"
                      sx={{ bgcolor: `${s.color}15`, color: s.color, fontWeight: 700, fontSize: '0.72rem' }} />
                  ))}
                </Box>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      {['Employee', 'Department', 'Hours', ...(showRates ? ['Gross'] : []), 'Status'].map(h => <TableCell key={h} sx={TH}>{h}</TableCell>)}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bulkResults.map((r, i) => {
                      const statusMap = {
                        generated: { label: 'Generated',              color: '#10b981', icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> },
                        exists:    { label: 'Already Exists',          color: '#6366f1', icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> },
                        no_hours:  { label: r.noApprovedHours ? 'Not Approved in Wrike' : 'No Hours', color: '#f59e0b', icon: <RemoveCircleOutlineIcon sx={{ fontSize: 14 }} /> },
                        error:     { label: 'Error',                   color: '#ef4444', icon: <ErrorOutlineIcon sx={{ fontSize: 14 }} /> },
                      };
                      const s = statusMap[r.status];
                      return (
                        <TableRow key={i} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                          <TableCell sx={TD}>
                            <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.emp.name}</Typography>
                            <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>{r.emp.employee_id}</Typography>
                          </TableCell>
                          <TableCell sx={{ ...TD, color: 'text.secondary' }}>{r.emp.department || '—'}</TableCell>
                          <TableCell sx={TD}>{r.hours ? formatHoursAsHM(r.hours) : '—'}</TableCell>
                          {showRates && <TableCell sx={TD}>{r.gross ? fmt(r.gross, r.emp.currency || 'USD') : '—'}</TableCell>}
                          <TableCell sx={TD}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: s.color }}>
                              {s.icon}
                              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: s.color }}>
                                {r.status === 'error' ? r.error : s.label}
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
