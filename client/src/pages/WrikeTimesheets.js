import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, Chip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, Select, MenuItem, FormControl, InputLabel, Alert,
  FormControlLabel, Switch,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PeopleIcon from '@mui/icons-material/People';
import { wrikeAPI, employeesAPI } from '../api';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import DateRangeIcon from '@mui/icons-material/DateRange';
import CalendarViewMonthIcon from '@mui/icons-material/CalendarViewMonth';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CURRENCY_SYMBOLS = { USD: '$', PHP: '₱', BDT: '৳' };

function getMondayOf(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function fmtDay(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCurrency(amount, currency) {
  const sym = CURRENCY_SYMBOLS[currency] || currency;
  return `${sym}${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TH = { fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', py: 1.5, px: 1.5 };
const TD = { fontSize: '0.875rem', color: 'text.primary', py: 1.5, px: 1.5 };

function getMonthOf(dateStr) {
  return dateStr.substring(0, 7);
}

export default function WrikeTimesheets() {
  const [viewMode,  setViewMode]  = useState('weekly'); // 'weekly' | 'monthly'
  const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date().toISOString().split('T')[0]));
  const [month,     setMonth]     = useState(() => getMonthOf(new Date().toISOString()));
  const [data,      setData]      = useState([]);
  const [days,      setDays]      = useState([]);
  const [weeks,     setWeeks]     = useState([]); // monthly mode — week buckets
  const [loading,   setLoading]   = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [error,     setError]     = useState(null);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [employees, setEmployees] = useState([]);
  const [approvedOnly, setApprovedOnly] = useState(false);

  useEffect(() => {
    employeesAPI.getAll(false).then(res => setEmployees(res.data || [])).catch(() => {});
  }, []);

  const fetchTimelogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (viewMode === 'monthly') {
        const res = await wrikeAPI.getMonthlyTimelogs(month, approvedOnly);
        setData(res.data || []);
        setWeeks(res.weeks || []);
        setDays([]);
      } else {
        const res = await wrikeAPI.getWeeklyTimelogs(weekStart, approvedOnly);
        setData(res.data || []);
        setDays(res.days || []);
        setWeeks([]);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setError(msg);
      toast.error(`Failed to fetch timelogs: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [viewMode, weekStart, month, approvedOnly]);

  useEffect(() => { fetchTimelogs(); }, [fetchTimelogs]);

  const toggleRow = (id) => setExpandedRows(p => ({ ...p, [id]: !p[id] }));

  const weekEnd   = addDays(weekStart, 6);
  const weekLabel = `${fmtDay(weekStart)} – ${fmtDay(weekEnd)}, ${new Date(weekStart).getFullYear()}`;
  const monthLabel = new Date(month + '-15').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const visibleData = selectedEmpId ? data.filter(r => String(r.employee.id) === selectedEmpId) : data;
  const totalHours = visibleData.reduce((s, r) => s + r.totalHours, 0);
  const unlinked = data.filter(r => !r.employee.wrike_user_id);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>Work Timesheets</Typography>
          <ToggleButtonGroup value={viewMode} exclusive size="small"
            onChange={(_, v) => { if (v) setViewMode(v); }}
            sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontSize: '0.78rem', px: 1.5, py: 0.5, borderRadius: '8px !important', border: '1px solid !important', borderColor: 'divider !important', mx: 0.25 } }}>
            <ToggleButton value="weekly"><DateRangeIcon sx={{ fontSize: 15, mr: 0.5 }} />Weekly</ToggleButton>
            <ToggleButton value="monthly"><CalendarViewMonthIcon sx={{ fontSize: 15, mr: 0.5 }} />Monthly</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>All Employees</InputLabel>
            <Select label="All Employees" value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)}
              sx={{ borderRadius: '10px', fontSize: '0.875rem' }}>
              <MenuItem value="">All Employees</MenuItem>
              {employees.map(e => (
                <MenuItem key={e.id} value={String(e.id)}>
                  {e.name}{!e.wrike_user_id ? ' ⚠' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControlLabel
            control={
              <Switch checked={approvedOnly} onChange={e => setApprovedOnly(e.target.checked)} size="small"
                sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#10b981' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#10b981' } }} />
            }
            label={<Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: approvedOnly ? '#10b981' : 'text.secondary' }}>Approved Only</Typography>}
          />
          {viewMode === 'weekly' ? (
            <Button variant="outlined" onClick={() => setWeekStart(getMondayOf(new Date().toISOString().split('T')[0]))}
              sx={{ borderRadius: '10px', textTransform: 'none', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
              This Week
            </Button>
          ) : (
            <Button variant="outlined" onClick={() => setMonth(getMonthOf(new Date().toISOString()))}
              sx={{ borderRadius: '10px', textTransform: 'none', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
              This Month
            </Button>
          )}
          <Tooltip title="Refresh">
            <IconButton onClick={fetchTimelogs} disabled={loading}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '10px', color: 'text.secondary', '&:hover': { color: '#6366f1', borderColor: '#6366f1', bgcolor: 'rgba(99,102,241,0.04)' } }}>
              <RefreshIcon sx={{ fontSize: 18, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Week / Month navigator */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton
          onClick={() => viewMode === 'weekly'
            ? setWeekStart(p => addDays(p, -7))
            : setMonth(p => { const d = new Date(p + '-15'); d.setMonth(d.getMonth() - 1); return d.toISOString().substring(0,7); })
          }
          size="small"
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
        <Box sx={{ textAlign: 'center', flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary' }}>
              {viewMode === 'weekly' ? weekLabel : monthLabel}
            </Typography>
            {approvedOnly && <Chip label="Approved only" size="small" sx={{ bgcolor: '#10b98115', color: '#10b981', fontWeight: 700, fontSize: '0.68rem' }} />}
          </Box>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', mt: 0.25 }}>
            {viewMode === 'weekly' ? `Week of ${weekStart}` : `Monthly view — ${month}`}
          </Typography>
        </Box>
        <IconButton
          onClick={() => viewMode === 'weekly'
            ? setWeekStart(p => addDays(p, 7))
            : setMonth(p => { const d = new Date(p + '-15'); d.setMonth(d.getMonth() + 1); return d.toISOString().substring(0,7); })
          }
          size="small"
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
          <ChevronRightIcon fontSize="small" />
        </IconButton>
        <Chip icon={<AccessTimeIcon />} label={`${totalHours.toFixed(1)}h total`} size="small"
          sx={{ ml: 'auto', bgcolor: '#6366f115', color: '#6366f1', fontWeight: 700, '& .MuiChip-icon': { fontSize: 14, color: '#6366f1' } }} />
      </Paper>

      {/* Warnings */}
      {!loading && unlinked.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 0, '& .MuiAlert-message': { fontSize: '0.875rem' } }}>
          <strong>{unlinked.length} employee{unlinked.length > 1 ? 's' : ''} not linked to Wrike:</strong>{' '}
          {unlinked.map(r => r.employee.name).join(', ')} — Go to <strong>Employees</strong> → Edit → Find in Wrike to link them.
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 0 }}>{error}</Alert>}

      {/* Loading */}
      {loading && (
        <Paper elevation={0} sx={{ p: 6, borderRadius: 0, border: '1px solid', borderColor: 'divider', textAlign: 'center', color: 'text.disabled' }}>
          <CircularProgress size={32} sx={{ color: '#6366f1', mb: 2 }} />
          <Typography sx={{ fontSize: '0.875rem' }}>Fetching timelogs from Wrike…</Typography>
        </Paper>
      )}

      {/* Table — weekly or monthly */}
      {!loading && visibleData.length > 0 && (
        <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  <TableCell sx={{ ...TH, minWidth: 180 }}>Employee</TableCell>
                  {viewMode === 'weekly' ? days.map((d, i) => (
                    <TableCell key={d} sx={{ ...TH, textAlign: 'center', minWidth: 72 }}>
                      <div>{DAY_LABELS[i]}</div>
                      <div style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.68rem' }}>{fmtDay(d)}</div>
                    </TableCell>
                  )) : weeks.map((w, i) => (
                    <TableCell key={w.start} sx={{ ...TH, textAlign: 'center', minWidth: 80 }}>
                      <div>Wk {i + 1}</div>
                      <div style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.68rem' }}>{fmtDay(w.start)}</div>
                    </TableCell>
                  ))}
                  <TableCell sx={{ ...TH, textAlign: 'center', minWidth: 80 }}>Total</TableCell>
                  <TableCell sx={{ ...TH, textAlign: 'right', minWidth: 120 }}>Est. Pay</TableCell>
                  {viewMode === 'weekly' && <TableCell sx={{ ...TH, width: 36 }}></TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleData.map(row => {
                  const emp     = row.employee;
                  const hasLogs = row.totalHours > 0;
                  const expanded = expandedRows[emp.id];
                  const colCount = (viewMode === 'weekly' ? days.length : weeks.length) + (viewMode === 'weekly' ? 4 : 3);
                  return (
                    <React.Fragment key={emp.id}>
                      <TableRow sx={{ opacity: emp.is_active ? 1 : 0.5, '&:hover': { bgcolor: 'action.hover' } }}>
                        <TableCell sx={TD}>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: 'text.primary' }}>{emp.name}</Typography>
                          <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>{emp.department || emp.employee_id}</Typography>
                          {!emp.wrike_user_id && <Typography sx={{ fontSize: '0.65rem', color: '#f59e0b', mt: 0.25 }}>No Wrike ID linked</Typography>}
                        </TableCell>
                        {viewMode === 'weekly' ? days.map(d => {
                          const h = row.dailyHours?.[d] || 0;
                          return (
                            <TableCell key={d} sx={{ ...TD, textAlign: 'center' }}>
                              {h > 0 ? (
                                <Chip label={h.toFixed(1)} size="small" sx={{
                                  height: 24, fontWeight: 700, fontSize: '0.75rem',
                                  bgcolor: h >= 8 ? '#10b98115' : h >= 4 ? '#6366f115' : '#f59e0b15',
                                  color: h >= 8 ? '#10b981' : h >= 4 ? '#6366f1' : '#f59e0b',
                                }} />
                              ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                            </TableCell>
                          );
                        }) : (row.weekHours || []).map((h, i) => (
                          <TableCell key={i} sx={{ ...TD, textAlign: 'center' }}>
                            {h > 0 ? (
                              <Chip label={h.toFixed(1)} size="small" sx={{
                                height: 24, fontWeight: 700, fontSize: '0.75rem',
                                bgcolor: h >= 40 ? '#10b98115' : h >= 20 ? '#6366f115' : '#f59e0b15',
                                color: h >= 40 ? '#10b981' : h >= 20 ? '#6366f1' : '#f59e0b',
                              }} />
                            ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                          </TableCell>
                        ))}
                        <TableCell sx={{ ...TD, textAlign: 'center', fontWeight: 700 }}>
                          {row.totalHours.toFixed(1)}h
                        </TableCell>
                        <TableCell sx={{ ...TD, textAlign: 'right' }}>
                          <Typography sx={{ fontWeight: 700, color: hasLogs ? '#10b981' : 'text.disabled', fontSize: '0.875rem' }}>
                            {hasLogs ? formatCurrency(row.pay, emp.currency) : '—'}
                          </Typography>
                          <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                            {CURRENCY_SYMBOLS[emp.currency] || emp.currency}{emp.hourly_rate}/hr
                          </Typography>
                        </TableCell>
                        {viewMode === 'weekly' && (
                          <TableCell sx={TD}>
                            {row.taskDetails?.length > 0 && (
                              <IconButton size="small" onClick={() => toggleRow(emp.id)} sx={{ color: 'text.disabled' }}>
                                {expanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
                              </IconButton>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                      {viewMode === 'weekly' && expanded && row.taskDetails?.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={colCount} sx={{ p: 0, bgcolor: 'action.hover' }}>
                            <Box sx={{ px: 3, py: 1.5 }}>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    {['Date', 'Task', 'Comment', 'Hours'].map((h, i) => (
                                      <TableCell key={h} sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.disabled', py: 0.75, textAlign: i === 3 ? 'right' : 'left' }}>{h}</TableCell>
                                    ))}
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {row.taskDetails.map((t, i) => (
                                    <TableRow key={i}>
                                      <TableCell sx={{ fontSize: '0.8rem', py: 0.75, whiteSpace: 'nowrap' }}>{fmtDay(t.date)}</TableCell>
                                      <TableCell sx={{ fontSize: '0.8rem', py: 0.75, color: '#6366f1', maxWidth: 200 }}>{t.taskTitle}</TableCell>
                                      <TableCell sx={{ fontSize: '0.8rem', py: 0.75, color: 'text.disabled', maxWidth: 200 }}>{t.comment || '—'}</TableCell>
                                      <TableCell sx={{ fontSize: '0.8rem', py: 0.75, fontWeight: 700, textAlign: 'right' }}>{t.hours.toFixed(2)}h</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </Box>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
              {/* Footer totals */}
              <TableBody>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ ...TD, fontWeight: 700 }}>Totals</TableCell>
                  {viewMode === 'weekly' ? days.map(d => {
                    const dt = visibleData.reduce((s, r) => s + (r.dailyHours?.[d] || 0), 0);
                    return <TableCell key={d} sx={{ ...TD, textAlign: 'center', fontWeight: 700 }}>{dt > 0 ? `${dt.toFixed(1)}h` : '—'}</TableCell>;
                  }) : (weeks || []).map((_, i) => {
                    const wt = visibleData.reduce((s, r) => s + ((r.weekHours || [])[i] || 0), 0);
                    return <TableCell key={i} sx={{ ...TD, textAlign: 'center', fontWeight: 700 }}>{wt > 0 ? `${wt.toFixed(1)}h` : '—'}</TableCell>;
                  })}
                  <TableCell sx={{ ...TD, textAlign: 'center', fontWeight: 700 }}>
                    {visibleData.reduce((s, r) => s + r.totalHours, 0).toFixed(1)}h
                  </TableCell>
                  <TableCell colSpan={viewMode === 'weekly' ? 2 : 1} sx={{ ...TD, textAlign: 'right', color: 'text.disabled', fontSize: '0.8rem' }}>Mixed currencies</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {!loading && !error && visibleData.length === 0 && (
        <Paper elevation={0} sx={{ p: 8, borderRadius: 0, border: '1px solid', borderColor: 'divider', textAlign: 'center', color: 'text.disabled' }}>
          <PeopleIcon sx={{ fontSize: 48, opacity: 0.2, mb: 1.5 }} />
          <Typography sx={{ fontWeight: 600, mb: 0.5, color: 'text.secondary' }}>No timesheet data</Typography>
          <Typography sx={{ fontSize: '0.875rem' }}>
            {selectedEmpId ? 'No hours logged for this employee this week.' : 'No employees have a Wrike user ID linked, or no time was logged this week.'}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
