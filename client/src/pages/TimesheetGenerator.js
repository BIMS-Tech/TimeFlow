import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, CircularProgress, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  FormControl, InputLabel, Select, MenuItem, Alert, Collapse, Chip
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CalculateIcon from '@mui/icons-material/Calculate';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import AddIcon from '@mui/icons-material/Add';
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
        color: done || active ? 'white' : '#94a3b8',
        boxShadow: active ? '0 4px 12px rgba(99,102,241,0.4)' : 'none',
      }}>
        {done ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : num}
      </Box>
      <Typography sx={{ fontSize: '0.68rem', mt: 0.5, fontWeight: active ? 700 : 400, color: active ? '#6366f1' : done ? '#10b981' : '#94a3b8', whiteSpace: 'nowrap' }}>
        {label}
      </Typography>
    </Box>
  );
}

function Steps({ current }) {
  const steps = ['Select Employee', 'Select Period', 'Calculate', 'Send for Approval'];
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
const TH = { fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', py: 1.5, px: 2 };
const TD = { fontSize: '0.875rem', color: '#1e293b', py: 1.25, px: 2 };

export default function TimesheetGenerator() {
  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState(null);

  const [periods, setPeriods] = useState([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  const [preview, setPreview] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [expandedDays, setExpandedDays] = useState(false);

  const step = submitted ? 3 : preview ? 2 : (selectedEmp && selectedPeriod) ? 1 : selectedEmp ? 1 : 0;

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

  const handleCalculate = async () => {
    if (!selectedEmp || !selectedPeriod) return;
    setCalculating(true);
    setPreview(null);
    setSubmitted(null);
    try {
      const res = await timesheetGeneratorAPI.preview(selectedEmp.id, startDate, endDate);
      setPreview(res.data);
      if (res.data.wrikeError) toast(`Wrike fetch failed: ${res.data.wrikeError}`, { icon: '⚠️', duration: 6000 });
      if (res.data.totalHours === 0) toast('No hours found for this period.', { icon: '⚠️' });
      else if (res.data.source === 'db') toast('Showing imported hours from database.', { icon: 'ℹ️', duration: 5000 });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to fetch timelogs');
    } finally {
      setCalculating(false);
    }
  };

  const handleSubmit = async () => {
    if (!preview || !selectedPeriod) return;
    setSubmitting(true);
    try {
      const res = await timesheetGeneratorAPI.submit(
        selectedEmp.id,
        startDate,
        endDate,
        selectedPeriod.period_name
      );
      setSubmitted(res.data);
      if (res.data?.alreadyPending) toast('This timesheet is already pending approval.', { icon: 'ℹ️', duration: 5000 });
      else toast.success('Timesheet sent for employee approval!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedEmp(null);
    setSelectedPeriod(null);
    setPreview(null);
    setSubmitted(null);
  };

  const currency = selectedEmp?.currency || 'USD';
  const sortedTasks = preview?.taskDetails ? [...preview.taskDetails].sort((a, b) => a.date.localeCompare(b.date)) : [];
  const dailyEntries = preview?.dailyHours ? Object.entries(preview.dailyHours).filter(([, h]) => h > 0).sort(([a], [b]) => a.localeCompare(b)) : [];

  const startDate = selectedPeriod?.start_date ? String(selectedPeriod.start_date).substring(0, 10) : '';
  const endDate = selectedPeriod?.end_date ? String(selectedPeriod.end_date).substring(0, 10) : '';

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Generate Timesheet</Typography>
        {(selectedEmp || preview) && (
          <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={handleReset}
            sx={{ borderRadius: '10px', textTransform: 'none', borderColor: '#e2e8f0', color: '#475569', '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
            Start Over
          </Button>
        )}
      </Box>

      <Steps current={step} />

      <Grid container spacing={2} sx={{ alignItems: 'start' }}>
        {/* Left panel */}
        <Grid item xs={12} md={preview ? 4 : 6}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

            {/* Employee select */}
            <Paper elevation={0} sx={{ p: 2, borderRadius: 0, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: '#6366f115', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PeopleIcon sx={{ fontSize: 14, color: '#6366f1' }} />
                </Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>Select Employee</Typography>
              </Box>
              {empLoading ? <CircularProgress size={20} sx={{ color: '#6366f1' }} /> : (
                <FormControl fullWidth size="small">
                  <InputLabel>Choose an employee</InputLabel>
                  <Select label="Choose an employee" value={selectedEmp?.id || ''}
                    onChange={e => { const emp = employees.find(em => em.id === parseInt(e.target.value)); setSelectedEmp(emp || null); setPreview(null); setSubmitted(null); }}
                    sx={{ borderRadius: '10px' }}>
                    <MenuItem value="">— Choose an employee —</MenuItem>
                    {employees.map(e => <MenuItem key={e.id} value={e.id}>{e.name}{e.department ? ` · ${e.department}` : ''}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              {selectedEmp && (
                <Box sx={{ mt: 1.5, p: 1.25, bgcolor: '#6366f108', borderRadius: 0 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>{selectedEmp.name}</Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', mt: 0.25 }}>
                    {selectedEmp.employee_id} · {selectedEmp.department || 'No dept'} · {currency} {selectedEmp.hourly_rate}/hr
                  </Typography>
                </Box>
              )}
            </Paper>

            {/* Period select */}
            <Paper elevation={0} sx={{ p: 2, borderRadius: 0, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', opacity: selectedEmp ? 1 : 0.5, pointerEvents: selectedEmp ? 'auto' : 'none' }}>
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
                  <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8', mb: 1 }}>No pay periods created yet.</Typography>
                  <Button variant="outlined" size="small" component={Link} to="/periods" startIcon={<AddIcon />}
                    sx={{ textTransform: 'none', borderRadius: '8px', borderColor: '#6366f1', color: '#6366f1' }}>
                    Create a Period
                  </Button>
                </Box>
              ) : (
                <FormControl fullWidth size="small">
                  <InputLabel>Choose a pay period</InputLabel>
                  <Select label="Choose a pay period" value={selectedPeriod?.id || ''}
                    onChange={e => {
                      const p = periods.find(p => p.id === parseInt(e.target.value));
                      setSelectedPeriod(p || null);
                      setPreview(null);
                      setSubmitted(null);
                    }}
                    sx={{ borderRadius: '10px' }}>
                    <MenuItem value="">— Choose a period —</MenuItem>
                    {periods.map(p => (
                      <MenuItem key={p.id} value={p.id}>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 500 }}>{p.period_name}</Typography>
                          <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8' }}>
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
                    <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>{selectedPeriod.period_name}</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', mt: 0.25 }}>
                      {fmtDate(startDate)} – {fmtDate(endDate)}
                    </Typography>
                  </Box>
                  <Chip
                    label={selectedPeriod.status.replace('_', ' ')}
                    size="small"
                    sx={{
                      bgcolor: `${STATUS_COLORS[selectedPeriod.status] || '#6366f1'}18`,
                      color: STATUS_COLORS[selectedPeriod.status] || '#6366f1',
                      fontWeight: 600, fontSize: '0.65rem', textTransform: 'capitalize'
                    }}
                  />
                </Box>
              )}
            </Paper>

            {/* Calculate */}
            <Button variant="contained" fullWidth startIcon={calculating ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <CalculateIcon />}
              onClick={handleCalculate} disabled={!selectedEmp || !selectedPeriod || calculating}
              sx={{ py: 1.5, borderRadius: '4px', textTransform: 'none', fontSize: '0.95rem', fontWeight: 700, background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}>
              {calculating ? 'Calculating…' : 'Calculate Hours'}
            </Button>

            {/* Send for approval */}
            {preview && !submitted && (
              <Button variant="contained" fullWidth startIcon={submitting ? <CircularProgress size={18} sx={{ color: 'white' }} /> : <SendIcon />}
                onClick={handleSubmit} disabled={submitting || preview.totalHours === 0}
                sx={{ py: 1.5, borderRadius: '4px', textTransform: 'none', fontSize: '0.95rem', fontWeight: 700, background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)', boxShadow: '0 4px 16px rgba(16,185,129,0.4)' }}>
                {submitting ? 'Submitting…' : 'Send for Approval'}
              </Button>
            )}
          </Box>
        </Grid>

        {/* Right panel — results */}
        {preview && (
          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Success banner */}
              {submitted && (
                <Alert severity={submitted.alreadyPending ? 'info' : 'success'} sx={{ borderRadius: 0 }}>
                  <strong>{submitted.alreadyPending ? 'Already Pending Approval' : 'Routed for Employee Approval'}</strong>
                  <br />
                  {submitted.alreadyPending
                    ? 'This timesheet is already waiting for approval — no duplicate created.'
                    : `The timesheet CSV has been generated and is now visible to ${selectedEmp?.name} in their portal.`}
                </Alert>
              )}

              {/* Source warning */}
              {(preview.source === 'db' || preview.wrikeError) && (
                <Alert severity={preview.wrikeError ? 'error' : 'warning'} sx={{ borderRadius: 0 }}>
                  {preview.wrikeError && <><strong>Wrike API error:</strong> {preview.wrikeError}<br /></>}
                  {preview.source === 'db' && 'Showing hours from imported database records — Wrike returned 0 for this period.'}
                </Alert>
              )}

              {/* Summary tiles */}
              <Grid container spacing={1.5}>
                {[
                  { icon: <AccessTimeIcon />, label: 'Total Hours', value: `${preview.totalHours}h`, color: '#6366f1' },
                  { icon: <TrendingUpIcon />, label: 'Regular / OT', value: `${preview.regularHours}h / ${preview.overtimeHours}h`, color: '#f59e0b' },
                  { icon: <ReceiptLongIcon />, label: 'Gross Pay', value: fmt(preview.grossAmount, currency), color: '#10b981' },
                ].map(c => (
                  <Grid item xs={4} key={c.label}>
                    <Paper elevation={0} sx={{ p: 2, borderRadius: 0, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75, color: c.color }}>
                        {React.cloneElement(c.icon, { sx: { fontSize: 18 } })}
                        <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{c.label}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{c.value}</Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>

              {/* Period info */}
              <Paper elevation={0} sx={{ p: 2, borderRadius: 0, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', mb: 0.25 }}>Period</Typography>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{fmtDate(startDate)} – {fmtDate(endDate)}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', mb: 0.25 }}>Hourly Rate</Typography>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{fmt(preview.hourlyRate, currency)}/hr</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography sx={{ color: '#94a3b8', fontSize: '0.75rem', mb: 0.25 }}>Regular Pay</Typography>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{fmt(preview.regularHours * preview.hourlyRate, currency)}</Typography>
                  </Grid>
                </Grid>
                {preview.overtimeHours > 0 && (
                  <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 2, fontSize: '0.875rem' }}>
                    <Box><Typography component="span" sx={{ color: '#94a3b8', fontSize: '0.8rem' }}>OT Rate </Typography><strong>{fmt(preview.hourlyRate * 1.5, currency)}/hr</strong></Box>
                    <Box><Typography component="span" sx={{ color: '#94a3b8', fontSize: '0.8rem' }}>OT Pay </Typography><strong>{fmt(preview.overtimeHours * preview.hourlyRate * 1.5, currency)}</strong></Box>
                  </Box>
                )}
              </Paper>

              {/* Daily breakdown (collapsible) */}
              {dailyEntries.length > 0 && (
                <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                  <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setExpandedDays(v => !v)}>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>Daily Breakdown ({dailyEntries.length} days)</Typography>
                    {expandedDays ? <ExpandLessIcon sx={{ fontSize: 20, color: '#94a3b8' }} /> : <ExpandMoreIcon sx={{ fontSize: 20, color: '#94a3b8' }} />}
                  </Box>
                  <Collapse in={expandedDays}>
                    <TableContainer>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                          <TableRow>
                            <TableCell sx={TH}>Date</TableCell>
                            <TableCell sx={{ ...TH, textAlign: 'right' }}>Hours</TableCell>
                            <TableCell sx={{ ...TH, textAlign: 'right' }}>Pay</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {dailyEntries.map(([date, hours]) => (
                            <TableRow key={date} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                              <TableCell sx={TD}>{fmtDay(date)}</TableCell>
                              <TableCell sx={{ ...TD, textAlign: 'right', fontWeight: 600 }}>{hours.toFixed(2)}h</TableCell>
                              <TableCell sx={{ ...TD, textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{fmt(hours * preview.hourlyRate, currency)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow sx={{ bgcolor: '#f1f5f9' }}>
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

              {/* Task details */}
              {sortedTasks.length > 0 && (
                <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                  <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>Task Details ({sortedTasks.length} entries)</Typography>
                  </Box>
                  <TableContainer sx={{ maxHeight: 320 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          {['Date', 'Task', 'Comment', 'Hours'].map((h, i) => <TableCell key={h} sx={{ ...TH, bgcolor: '#f8fafc', textAlign: i === 3 ? 'right' : 'left' }}>{h}</TableCell>)}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sortedTasks.map((t, i) => (
                          <TableRow key={i} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                            <TableCell sx={{ ...TD, whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{fmtDay(t.date)}</TableCell>
                            <TableCell sx={{ ...TD, color: '#6366f1', maxWidth: 200, fontSize: '0.8rem' }}>{t.taskTitle}</TableCell>
                            <TableCell sx={{ ...TD, color: '#94a3b8', maxWidth: 180, fontSize: '0.8rem' }}>{t.comment || '—'}</TableCell>
                            <TableCell sx={{ ...TD, textAlign: 'right', fontWeight: 700, fontSize: '0.8rem' }}>{t.hours.toFixed(2)}h</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              )}

              {preview.totalHours === 0 && (
                <Paper elevation={0} sx={{ p: 5, borderRadius: 0, border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center', color: '#94a3b8' }}>
                  <AccessTimeIcon sx={{ fontSize: 40, opacity: 0.2, mb: 1 }} />
                  <Typography sx={{ fontWeight: 600, mb: 0.5, color: '#475569' }}>No hours found</Typography>
                  <Typography sx={{ fontSize: '0.875rem' }}>
                    No time was logged in Wrike for <strong>{preview.employee.name}</strong> between {fmtDate(startDate)} and {fmtDate(endDate)}.
                  </Typography>
                </Paper>
              )}
            </Box>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
