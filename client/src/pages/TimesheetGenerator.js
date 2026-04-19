import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, CircularProgress, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  FormControl, InputLabel, Select, MenuItem, Alert, Collapse, Chip,
  Checkbox, Divider, LinearProgress
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
import { employeesAPI, timesheetAPI, timesheetGeneratorAPI } from '../api';

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

function StepBubble({ num, label, active, done }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Box sx={{
        width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: '0.85rem', flexShrink: 0, transition: 'all 0.2s',
        background: done ? '#10b981' : active ? 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' : '#e2e8f0',
        color: done || active ? 'white' : 'text.disabled',
        boxShadow: active ? '0 4px 12px rgba(99,102,241,0.4)' : 'none',
      }}>
        {done ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : num}
      </Box>
      <Typography sx={{ fontSize: '0.68rem', mt: 0.5, fontWeight: active ? 700 : 400, color: active ? '#6366f1' : done ? '#10b981' : 'text.disabled', whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
    </Box>
  );
}

function Steps({ current }) {
  const steps = ['Select Employees', 'Select Period', 'Generate Payslips'];
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <StepBubble num={i + 1} label={s} active={i === current} done={i < current} />
          {i < steps.length - 1 && (
            <Box sx={{ flex: 1, height: 2, mt: 2, mx: 0.5, background: i < current ? '#10b981' : '#e2e8f0', transition: 'background 0.3s' }} />
          )}
        </React.Fragment>
      ))}
    </Box>
  );
}

const STATUS_COLORS = { open: '#6366f1', processing: '#f59e0b', pending_approval: '#f59e0b', approved: '#10b981', rejected: '#ef4444', paid: '#10b981' };
const TH = { fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', py: 1.5, px: 2 };
const TD = { fontSize: '0.875rem', color: 'text.primary', py: 1.25, px: 2 };

export default function TimesheetGenerator() {
  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [periods, setPeriods] = useState([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  // Single-employee result (detailed)
  const [preview, setPreview] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  const [expandedDays, setExpandedDays] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState(true);
  const [taskPanelWidth, setTaskPanelWidth] = useState(360);
  const isDraggingTask = React.useRef(false);
  const dragStartX = React.useRef(0);
  const dragStartWidth = React.useRef(360);

  const onTaskDragStart = (e) => {
    e.preventDefault();
    isDraggingTask.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = taskPanelWidth;
    const onMove = (mv) => {
      if (!isDraggingTask.current) return;
      // divider drag: moving left widens the right panel
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

  // Multi-employee result (summary table)
  const [bulkResults, setBulkResults] = useState(null);

  const hasSelection = selectedIds.size > 0;
  const allSelected = employees.length > 0 && selectedIds.size === employees.length;
  const isSingle = selectedIds.size === 1;
  const isDone = isSingle ? !!submitted : !!bulkResults;
  const step = isDone ? 2 : (hasSelection && selectedPeriod) ? 1 : 0;

  const startDate = selectedPeriod?.start_date ? String(selectedPeriod.start_date).substring(0, 10) : '';
  const endDate = selectedPeriod?.end_date ? String(selectedPeriod.end_date).substring(0, 10) : '';

  useEffect(() => {
    employeesAPI.getAll(true)
      .then(res => setEmployees(res.data || []))
      .catch(() => toast.error('Failed to load employees'))
      .finally(() => setEmpLoading(false));

    timesheetAPI.getPeriods(50, 0)
      .then(res => setPeriods(res.data || []))
      .catch(() => toast.error('Failed to load periods'))
      .finally(() => setPeriodsLoading(false));
  }, []);

  const toggleEmployee = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setPreview(null); setSubmitted(null); setBulkResults(null);
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(employees.map(e => e.id)));
    }
    setPreview(null); setSubmitted(null); setBulkResults(null);
  };

  const handleGenerate = async () => {
    if (!hasSelection || !selectedPeriod) return;
    setGenerating(true);
    setPreview(null); setSubmitted(null); setBulkResults(null);

    const empIds = [...selectedIds];

    if (isSingle) {
      // Single employee: detailed preview + submit
      const emp = employees.find(e => e.id === empIds[0]);
      try {
        const previewRes = await timesheetGeneratorAPI.preview(emp.id, startDate, endDate);
        setPreview(previewRes.data);
        if (previewRes.data.wrikeError) toast(`Wrike fetch failed: ${previewRes.data.wrikeError}`, { icon: '⚠️', duration: 6000 });
        if (previewRes.data.totalHours === 0) {
          if (previewRes.data.noApprovedHours) {
            toast('No Wrike-approved hours found for this period. Approve the timelogs in Wrike first.', { icon: '⚠️', duration: 8000 });
          } else {
            toast('No hours found for this period.', { icon: '⚠️' });
          }
          return;
        }
        if (previewRes.data.source === 'db') toast('Using imported hours from database.', { icon: 'ℹ️', duration: 5000 });
        const res = await timesheetGeneratorAPI.submit(emp.id, startDate, endDate, selectedPeriod.period_name);
        setSubmitted(res.data);
        if (res.data?.alreadyPending) toast('This timesheet has already been processed.', { icon: 'ℹ️', duration: 5000 });
        else toast.success('Payslip generated successfully!');
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to generate payslip');
      } finally {
        setGenerating(false);
      }
    } else {
      // Multiple employees: loop and collect results
      const results = [];
      setProgress({ done: 0, total: empIds.length });

      for (let i = 0; i < empIds.length; i++) {
        const emp = employees.find(e => e.id === empIds[i]);
        try {
          const previewRes = await timesheetGeneratorAPI.preview(emp.id, startDate, endDate);
          if (previewRes.data.totalHours === 0) {
            results.push({ emp, status: 'no_hours', noApprovedHours: previewRes.data.noApprovedHours });
          } else {
            const res = await timesheetGeneratorAPI.submit(emp.id, startDate, endDate, selectedPeriod.period_name);
            results.push({ emp, status: res.data?.alreadyPending ? 'exists' : 'generated', hours: previewRes.data.totalHours, gross: previewRes.data.grossAmount });
          }
        } catch (err) {
          results.push({ emp, status: 'error', error: err.response?.data?.error || 'Failed' });
        }
        setProgress({ done: i + 1, total: empIds.length });
      }

      setBulkResults(results);
      const generated = results.filter(r => r.status === 'generated').length;
      const errors = results.filter(r => r.status === 'error').length;
      if (errors > 0) toast(`Generated ${generated}, ${errors} failed`, { icon: '⚠️' });
      else toast.success(`Generated ${generated} of ${empIds.length} payslips`);
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setSelectedIds(new Set());
    setSelectedPeriod(null);
    setPreview(null); setSubmitted(null); setBulkResults(null);
  };

  const singleEmp = isSingle ? employees.find(e => selectedIds.has(e.id)) : null;
  const currency = singleEmp?.currency || 'USD';
  const sortedTasks = preview?.taskDetails ? [...preview.taskDetails].sort((a, b) => a.date.localeCompare(b.date)) : [];
  const dailyEntries = preview?.dailyHours ? Object.entries(preview.dailyHours).filter(([, h]) => h > 0).sort(([a], [b]) => a.localeCompare(b)) : [];

  const showRightPanel = (isSingle && preview) || (!isSingle && bulkResults);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>Generate Payslip</Typography>
        {hasSelection && (
          <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={handleReset}
            sx={{ borderRadius: '10px', textTransform: 'none', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
            Start Over
          </Button>
        )}
      </Box>

      <Steps current={step} />

      <Grid container spacing={2} sx={{ alignItems: 'start' }}>
        {/* Left panel */}
        <Grid item xs={12} md={showRightPanel ? 4 : 6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

            {/* Employee multi-select */}
            <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <Box sx={{ p: 2, pb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: '#6366f115', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <PeopleIcon sx={{ fontSize: 14, color: '#6366f1' }} />
                    </Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>Select Employees</Typography>
                  </Box>
                  {selectedIds.size > 0 && (
                    <Chip label={`${selectedIds.size} selected`} size="small"
                      sx={{ bgcolor: '#6366f115', color: '#6366f1', fontWeight: 700, fontSize: '0.72rem' }} />
                  )}
                </Box>
              </Box>

              {empLoading ? (
                <Box sx={{ p: 2 }}><CircularProgress size={20} sx={{ color: '#6366f1' }} /></Box>
              ) : (
                <>
                  {/* Select All row */}
                  <Box
                    onClick={toggleAll}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, cursor: 'pointer', bgcolor: 'action.hover', borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider', '&:hover': { bgcolor: 'action.selected' } }}>
                    <Checkbox
                      size="small"
                      checked={allSelected}
                      indeterminate={selectedIds.size > 0 && !allSelected}
                      onChange={toggleAll}
                      onClick={e => e.stopPropagation()}
                      sx={{ p: 0, color: '#6366f1', '&.Mui-checked': { color: '#6366f1' }, '&.MuiCheckbox-indeterminate': { color: '#6366f1' } }}
                    />
                    <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: 'text.primary' }}>
                      {allSelected ? 'Deselect All' : 'Select All'} ({employees.length})
                    </Typography>
                  </Box>

                  {/* Employee list */}
                  <Box sx={{ maxHeight: 280, overflowY: 'auto' }}>
                    {employees.map((emp, idx) => {
                      const checked = selectedIds.has(emp.id);
                      return (
                        <Box key={emp.id}>
                          <Box
                            onClick={() => toggleEmployee(emp.id)}
                            sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.1, cursor: 'pointer', bgcolor: checked ? '#6366f108' : 'transparent', '&:hover': { bgcolor: checked ? '#6366f112' : 'action.hover' }, transition: 'background 0.15s' }}>
                            <Checkbox
                              size="small"
                              checked={checked}
                              onChange={() => toggleEmployee(emp.id)}
                              onClick={e => e.stopPropagation()}
                              sx={{ p: 0, color: 'text.disabled', '&.Mui-checked': { color: '#6366f1' } }}
                            />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ fontWeight: checked ? 600 : 400, fontSize: '0.875rem', color: 'text.primary', lineHeight: 1.3 }}>{emp.name}</Typography>
                              <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                                {emp.employee_id}{emp.department ? ` · ${emp.department}` : ''} · {emp.currency || 'USD'} {emp.hourly_rate}/hr
                              </Typography>
                            </Box>
                          </Box>
                          {idx < employees.length - 1 && <Divider />}
                        </Box>
                      );
                    })}
                  </Box>
                </>
              )}
            </Paper>

            {/* Period select */}
            <Paper elevation={0} sx={{ p: 2, borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', opacity: hasSelection ? 1 : 0.5, pointerEvents: hasSelection ? 'auto' : 'none' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: '#6366f115', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CalendarMonthIcon sx={{ fontSize: 14, color: '#6366f1' }} />
                  </Box>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>Select Pay Period</Typography>
                </Box>
                <Button size="small" component={Link} to="/periods" startIcon={<AddIcon />}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', color: '#6366f1', p: 0.5 }}>
                  New Period
                </Button>
              </Box>

              {periodsLoading ? <CircularProgress size={20} sx={{ color: '#6366f1' }} /> : periods.length === 0 ? (
                <Box sx={{ py: 2, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.875rem', color: 'text.disabled', mb: 1 }}>No pay periods created yet.</Typography>
                  <Button variant="outlined" size="small" component={Link} to="/periods" startIcon={<AddIcon />}
                    sx={{ textTransform: 'none', borderRadius: '8px', borderColor: '#6366f1', color: '#6366f1' }}>
                    Create a Period
                  </Button>
                </Box>
              ) : (
                <FormControl fullWidth size="small">
                  <InputLabel>Choose a pay period</InputLabel>
                  <Select label="Choose a pay period" value={selectedPeriod?.id || ''}
                    onChange={e => { const p = periods.find(p => p.id === parseInt(e.target.value)); setSelectedPeriod(p || null); setPreview(null); setSubmitted(null); setBulkResults(null); }}
                    sx={{ borderRadius: '10px' }}>
                    <MenuItem value="">— Choose a period —</MenuItem>
                    {periods.map(p => (
                      <MenuItem key={p.id} value={p.id}>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>{p.period_name}</Typography>
                          <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                            {new Date(p.start_date).toLocaleDateString()} – {new Date(p.end_date).toLocaleDateString()}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {selectedPeriod && (
                <Box sx={{ mt: 1.5, p: 1.25, bgcolor: '#6366f108', borderRadius: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: 'text.primary' }}>{selectedPeriod.period_name}</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', mt: 0.25 }}>
                      {fmtDate(startDate)} – {fmtDate(endDate)}
                    </Typography>
                  </Box>
                  <Chip
                    label={selectedPeriod.status.replace('_', ' ')}
                    size="small"
                    sx={{ bgcolor: `${STATUS_COLORS[selectedPeriod.status] || '#6366f1'}18`, color: STATUS_COLORS[selectedPeriod.status] || '#6366f1', fontWeight: 600, fontSize: '0.65rem', textTransform: 'capitalize' }}
                  />
                </Box>
              )}
            </Paper>

            {/* Generate button + progress */}
            {!isDone && (
              <Box>
                <Button variant="contained" fullWidth
                  startIcon={generating ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <ReceiptIcon />}
                  onClick={handleGenerate} disabled={!hasSelection || !selectedPeriod || generating}
                  sx={{ py: 1.5, borderRadius: '4px', textTransform: 'none', fontSize: '0.95rem', fontWeight: 700, background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)', boxShadow: '0 4px 16px rgba(16,185,129,0.4)' }}>
                  {generating
                    ? (isSingle ? 'Generating…' : `Generating ${progress.done} / ${progress.total}…`)
                    : `Generate Payslip${selectedIds.size !== 1 ? 's' : ''}${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
                </Button>
                {generating && !isSingle && progress.total > 0 && (
                  <LinearProgress variant="determinate" value={(progress.done / progress.total) * 100}
                    sx={{ mt: 1, borderRadius: 1, height: 6, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#10b981' } }} />
                )}
              </Box>
            )}
          </Box>
        </Grid>

        {/* Right panel — single employee detailed results */}
        {isSingle && preview && (
          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {submitted && (
                  <Alert severity={submitted.alreadyPending ? 'info' : 'success'} sx={{ borderRadius: 0 }}>
                    <strong>{submitted.alreadyPending ? 'Already Processed' : 'Payslip Generated'}</strong><br />
                    {submitted.alreadyPending
                      ? 'This timesheet has already been processed — no duplicate created.'
                      : `The payslip for ${singleEmp?.name} has been generated successfully.`}
                  </Alert>
                )}

                {(preview.source === 'db' || preview.wrikeError) && (
                  <Alert severity={preview.wrikeError ? 'error' : 'warning'} sx={{ borderRadius: 0 }}>
                    {preview.wrikeError && <><strong>Wrike API error:</strong> {preview.wrikeError}<br /></>}
                    {preview.source === 'db' && 'Showing hours from imported database records — Wrike returned 0 for this period.'}
                  </Alert>
                )}

                <Grid container spacing={1.5}>
                  {[
                    { icon: <AccessTimeIcon />, label: 'Total Hours', value: `${preview.totalHours}h`, color: '#6366f1' },
                    { icon: <TrendingUpIcon />, label: 'Regular / OT', value: `${preview.regularHours}h / ${preview.overtimeHours}h`, color: '#f59e0b' },
                    { icon: <ReceiptLongIcon />, label: 'Gross Pay', value: fmt(preview.grossAmount, currency), color: '#10b981' },
                  ].map(c => (
                    <Grid item xs={4} key={c.label}>
                      <Paper elevation={0} sx={{ p: 2, borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75, color: c.color }}>
                          {React.cloneElement(c.icon, { sx: { fontSize: 18 } })}
                          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</Typography>
                        </Box>
                        <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: 'text.primary' }}>{c.value}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>

                <Paper elevation={0} sx={{ p: 2, borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      <Typography sx={{ color: 'text.disabled', fontSize: '0.75rem', mb: 0.25 }}>Period</Typography>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{fmtDate(startDate)} – {fmtDate(endDate)}</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography sx={{ color: 'text.disabled', fontSize: '0.75rem', mb: 0.25 }}>Hourly Rate</Typography>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{fmt(preview.hourlyRate, currency)}/hr</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography sx={{ color: 'text.disabled', fontSize: '0.75rem', mb: 0.25 }}>Regular Pay</Typography>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{fmt(preview.regularHours * preview.hourlyRate, currency)}</Typography>
                    </Grid>
                  </Grid>
                  {preview.overtimeHours > 0 && (
                    <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid', borderTopColor: 'divider', display: 'flex', gap: 2, fontSize: '0.875rem' }}>
                      <Box><Typography component="span" sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>OT Rate </Typography><strong>{fmt(preview.hourlyRate * 1.5, currency)}/hr</strong></Box>
                      <Box><Typography component="span" sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>OT Pay </Typography><strong>{fmt(preview.overtimeHours * preview.hourlyRate * 1.5, currency)}</strong></Box>
                    </Box>
                  )}
                </Paper>

                {dailyEntries.length > 0 && (
                  <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                    <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => setExpandedDays(v => !v)}>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>Daily Breakdown ({dailyEntries.length} days)</Typography>
                      {expandedDays ? <ExpandLessIcon sx={{ fontSize: 20, color: 'text.disabled' }} /> : <ExpandMoreIcon sx={{ fontSize: 20, color: 'text.disabled' }} />}
                    </Box>
                    <Collapse in={expandedDays}>
                      <TableContainer>
                        <Table size="small">
                          <TableHead sx={{ bgcolor: 'action.hover' }}>
                            <TableRow>
                              <TableCell sx={TH}>Date</TableCell>
                              <TableCell sx={{ ...TH, textAlign: 'right' }}>Hours</TableCell>
                              <TableCell sx={{ ...TH, textAlign: 'right' }}>Pay</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {dailyEntries.map(([date, hours]) => (
                              <TableRow key={date} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                                <TableCell sx={TD}>{fmtDay(date)}</TableCell>
                                <TableCell sx={{ ...TD, textAlign: 'right', fontWeight: 600 }}>{hours.toFixed(2)}h</TableCell>
                                <TableCell sx={{ ...TD, textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{fmt(hours * preview.hourlyRate, currency)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow sx={{ bgcolor: 'action.hover' }}>
                              <TableCell sx={{ ...TD, fontWeight: 700 }}>Total</TableCell>
                              <TableCell sx={{ ...TD, textAlign: 'right', fontWeight: 700 }}>{preview.totalHours}h</TableCell>
                              <TableCell sx={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{fmt(preview.grossAmount, currency)}</TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Collapse>
                  </Paper>
                )}

                {preview.totalHours === 0 && (
                  <Paper elevation={0} sx={{ p: 5, borderRadius: 0, border: '1px solid', borderColor: 'divider', textAlign: 'center', color: 'text.disabled' }}>
                    <AccessTimeIcon sx={{ fontSize: 40, opacity: 0.2, mb: 1 }} />
                    <Typography sx={{ fontWeight: 600, mb: 0.5, color: 'text.secondary' }}>
                      {preview.noApprovedHours ? 'No Wrike-Approved Hours' : 'No Hours Found'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem' }}>
                      {preview.noApprovedHours
                        ? <>Timelogs exist in Wrike for <strong>{preview.employee?.name}</strong> but none are approved yet. Approve them in Wrike before generating payslips.</>
                        : <>No time was logged for <strong>{preview.employee?.name}</strong> between {fmtDate(startDate)} and {fmtDate(endDate)}.</>
                      }
                    </Typography>
                  </Paper>
                )}
              </Box>

              {sortedTasks.length > 0 && (
                <Box sx={{ display: 'flex', flexShrink: 0, width: taskPanelWidth, alignSelf: 'stretch' }}>
                  <Box
                    onMouseDown={onTaskDragStart}
                    sx={{
                      width: 8, flexShrink: 0, cursor: 'ew-resize', userSelect: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: 'action.hover', borderLeft: '1px solid', borderRight: '1px solid', borderColor: 'divider',
                      '&:hover': { bgcolor: '#6366f120' },
                    }}
                  >
                    <Box sx={{ width: 2, height: 28, borderRadius: 4, bgcolor: 'text.disabled', opacity: 0.35 }} />
                  </Box>
                  <Paper elevation={0} sx={{ flex: 1, borderRadius: 0, border: '1px solid', borderColor: 'divider', borderLeft: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid', borderBottomColor: 'divider' }}
                      onClick={() => setExpandedTasks(v => !v)}>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>Task Details ({sortedTasks.length})</Typography>
                      {expandedTasks ? <ExpandLessIcon sx={{ fontSize: 18, color: 'text.disabled' }} /> : <ExpandMoreIcon sx={{ fontSize: 18, color: 'text.disabled' }} />}
                    </Box>
                    <Collapse in={expandedTasks}>
                      <TableContainer sx={{ maxHeight: '70vh', overflow: 'auto' }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              {['Date', 'Task', 'Comment', 'Hrs'].map((h, i) => (
                                <TableCell key={h} sx={{ ...TH, bgcolor: 'action.hover', textAlign: i === 3 ? 'right' : 'left' }}>{h}</TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {sortedTasks.map((t, i) => (
                              <TableRow key={i} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                                <TableCell sx={{ ...TD, whiteSpace: 'nowrap', fontSize: '0.78rem' }}>{fmtDay(t.date)}</TableCell>
                                <TableCell sx={{ ...TD, color: '#6366f1', fontSize: '0.78rem', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.taskTitle}</TableCell>
                                <TableCell sx={{ ...TD, color: 'text.disabled', fontSize: '0.78rem', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.comment || '—'}</TableCell>
                                <TableCell sx={{ ...TD, textAlign: 'right', fontWeight: 700, fontSize: '0.78rem' }}>{t.hours.toFixed(2)}h</TableCell>
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

        {/* Right panel — bulk results */}
        {!isSingle && bulkResults && (
          <Grid item xs={12} md={8}>
            <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Generation Results</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {[
                    { label: `${bulkResults.filter(r => r.status === 'generated').length} Generated`, color: '#10b981' },
                    { label: `${bulkResults.filter(r => r.status === 'exists').length} Already Exist`, color: '#6366f1' },
                    { label: `${bulkResults.filter(r => r.status === 'no_hours').length} No Hours`, color: '#f59e0b' },
                    { label: `${bulkResults.filter(r => r.status === 'error').length} Errors`, color: '#ef4444' },
                  ].filter(s => parseInt(s.label) > 0).map(s => (
                    <Chip key={s.label} label={s.label} size="small"
                      sx={{ bgcolor: `${s.color}15`, color: s.color, fontWeight: 700, fontSize: '0.72rem' }} />
                  ))}
                </Box>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      {['Employee', 'Department', 'Hours', 'Gross', 'Status'].map(h => <TableCell key={h} sx={TH}>{h}</TableCell>)}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {bulkResults.map((r, i) => {
                      const statusMap = {
                        generated: { label: 'Generated', color: '#10b981', icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> },
                        exists: { label: 'Already Exists', color: '#6366f1', icon: <CheckCircleIcon sx={{ fontSize: 14 }} /> },
                        no_hours: { label: r.noApprovedHours ? 'Not Approved in Wrike' : 'No Hours', color: '#f59e0b', icon: <RemoveCircleOutlineIcon sx={{ fontSize: 14 }} /> },
                        error: { label: 'Error', color: '#ef4444', icon: <ErrorOutlineIcon sx={{ fontSize: 14 }} /> },
                      };
                      const s = statusMap[r.status];
                      return (
                        <TableRow key={i} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                          <TableCell sx={TD}>
                            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.emp.name}</Typography>
                            <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>{r.emp.employee_id}</Typography>
                          </TableCell>
                          <TableCell sx={{ ...TD, color: 'text.secondary' }}>{r.emp.department || '—'}</TableCell>
                          <TableCell sx={TD}>{r.hours ? `${r.hours}h` : '—'}</TableCell>
                          <TableCell sx={TD}>{r.gross ? fmt(r.gross, r.emp.currency || 'USD') : '—'}</TableCell>
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
