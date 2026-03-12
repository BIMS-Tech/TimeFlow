import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, Chip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Tooltip, Select, MenuItem, FormControl, InputLabel, Alert
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PeopleIcon from '@mui/icons-material/People';
import { wrikeAPI, employeesAPI } from '../api';

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

const TH = { fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', py: 1.5, px: 1.5 };
const TD = { fontSize: '0.875rem', color: '#1e293b', py: 1.5, px: 1.5 };

export default function WrikeTimesheets() {
  const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date().toISOString().split('T')[0]));
  const [data, setData] = useState([]);
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [error, setError] = useState(null);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    employeesAPI.getAll(false).then(res => setEmployees(res.data || [])).catch(() => {});
  }, []);

  const fetchTimelogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await wrikeAPI.getWeeklyTimelogs(weekStart);
      setData(res.data || []);
      setDays(res.days || []);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      setError(msg);
      toast.error(`Failed to fetch timelogs: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { fetchTimelogs(); }, [fetchTimelogs]);

  const handleImport = async () => {
    setImporting(true);
    try {
      const res = await wrikeAPI.importWeek(weekStart);
      toast.success(res.message);
      fetchTimelogs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const toggleRow = (id) => setExpandedRows(p => ({ ...p, [id]: !p[id] }));

  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${fmtDay(weekStart)} – ${fmtDay(weekEnd)}, ${new Date(weekStart).getFullYear()}`;
  const visibleData = selectedEmpId ? data.filter(r => String(r.employee.id) === selectedEmpId) : data;
  const totalHours = visibleData.reduce((s, r) => s + r.totalHours, 0);
  const unlinked = data.filter(r => !r.employee.wrike_user_id);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Wrike Timesheets</Typography>
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
          <Button variant="outlined" onClick={() => setWeekStart(getMondayOf(new Date().toISOString().split('T')[0]))}
            sx={{ borderRadius: '10px', textTransform: 'none', borderColor: '#e2e8f0', color: '#475569', '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
            This Week
          </Button>
          <Button variant="contained" startIcon={importing ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <DownloadIcon />}
            onClick={handleImport} disabled={importing || loading}
            sx={{ borderRadius: '10px', textTransform: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }}>
            {importing ? 'Importing…' : 'Import to DB'}
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchTimelogs} disabled={loading}
              sx={{ border: '1px solid #e2e8f0', borderRadius: '10px', color: '#64748b', '&:hover': { color: '#6366f1', borderColor: '#6366f1', bgcolor: 'rgba(99,102,241,0.04)' } }}>
              <RefreshIcon sx={{ fontSize: 18, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Week navigator */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: 0, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={() => setWeekStart(p => addDays(p, -7))} size="small"
          sx={{ border: '1px solid #e2e8f0', borderRadius: '8px', '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
        <Box sx={{ textAlign: 'center', flex: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{weekLabel}</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mt: 0.25 }}>Week of {weekStart}</Typography>
        </Box>
        <IconButton onClick={() => setWeekStart(p => addDays(p, 7))} size="small"
          sx={{ border: '1px solid #e2e8f0', borderRadius: '8px', '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
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
        <Paper elevation={0} sx={{ p: 6, borderRadius: 0, border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center', color: '#94a3b8' }}>
          <CircularProgress size={32} sx={{ color: '#6366f1', mb: 2 }} />
          <Typography sx={{ fontSize: '0.875rem' }}>Fetching timelogs from Wrike…</Typography>
        </Paper>
      )}

      {/* Table */}
      {!loading && visibleData.length > 0 && (
        <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ ...TH, minWidth: 180 }}>Employee</TableCell>
                  {days.map((d, i) => (
                    <TableCell key={d} sx={{ ...TH, textAlign: 'center', minWidth: 72 }}>
                      <div>{DAY_LABELS[i]}</div>
                      <div style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.68rem' }}>{fmtDay(d)}</div>
                    </TableCell>
                  ))}
                  <TableCell sx={{ ...TH, textAlign: 'center', minWidth: 80 }}>Total</TableCell>
                  <TableCell sx={{ ...TH, textAlign: 'right', minWidth: 120 }}>Est. Pay</TableCell>
                  <TableCell sx={{ ...TH, width: 36 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleData.map(row => {
                  const emp = row.employee;
                  const hasLogs = row.totalHours > 0;
                  const expanded = expandedRows[emp.id];
                  return (
                    <React.Fragment key={emp.id}>
                      <TableRow sx={{ opacity: emp.is_active ? 1 : 0.5, '&:hover': { bgcolor: '#f8fafc' } }}>
                        <TableCell sx={TD}>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>{emp.name}</Typography>
                          <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>{emp.department || emp.employee_id}</Typography>
                          {!emp.wrike_user_id && <Typography sx={{ fontSize: '0.65rem', color: '#f59e0b', mt: 0.25 }}>No Wrike ID linked</Typography>}
                        </TableCell>
                        {days.map(d => {
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
                        })}
                        <TableCell sx={{ ...TD, textAlign: 'center', fontWeight: 700 }}>
                          {row.totalHours.toFixed(1)}h
                        </TableCell>
                        <TableCell sx={{ ...TD, textAlign: 'right' }}>
                          <Typography sx={{ fontWeight: 700, color: hasLogs ? '#10b981' : '#94a3b8', fontSize: '0.875rem' }}>
                            {hasLogs ? formatCurrency(row.pay, emp.currency) : '—'}
                          </Typography>
                          <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            {CURRENCY_SYMBOLS[emp.currency] || emp.currency}{emp.hourly_rate}/hr
                          </Typography>
                        </TableCell>
                        <TableCell sx={TD}>
                          {row.taskDetails?.length > 0 && (
                            <IconButton size="small" onClick={() => toggleRow(emp.id)} sx={{ color: '#94a3b8' }}>
                              {expanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                      {expanded && row.taskDetails?.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={days.length + 4} sx={{ p: 0, bgcolor: '#f8fafc' }}>
                            <Box sx={{ px: 3, py: 1.5 }}>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    {['Date', 'Task', 'Comment', 'Hours'].map((h, i) => (
                                      <TableCell key={h} sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', py: 0.75, textAlign: i === 3 ? 'right' : 'left' }}>{h}</TableCell>
                                    ))}
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {row.taskDetails.map((t, i) => (
                                    <TableRow key={i}>
                                      <TableCell sx={{ fontSize: '0.8rem', py: 0.75, whiteSpace: 'nowrap' }}>{fmtDay(t.date)}</TableCell>
                                      <TableCell sx={{ fontSize: '0.8rem', py: 0.75, color: '#6366f1', maxWidth: 200 }}>{t.taskTitle}</TableCell>
                                      <TableCell sx={{ fontSize: '0.8rem', py: 0.75, color: '#94a3b8', maxWidth: 200 }}>{t.comment || '—'}</TableCell>
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
                <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                  <TableCell sx={{ ...TD, fontWeight: 700 }}>Totals</TableCell>
                  {days.map(d => {
                    const dt = visibleData.reduce((s, r) => s + (r.dailyHours?.[d] || 0), 0);
                    return <TableCell key={d} sx={{ ...TD, textAlign: 'center', fontWeight: 700 }}>{dt > 0 ? `${dt.toFixed(1)}h` : '—'}</TableCell>;
                  })}
                  <TableCell sx={{ ...TD, textAlign: 'center', fontWeight: 700 }}>{totalHours.toFixed(1)}h</TableCell>
                  <TableCell colSpan={2} sx={{ ...TD, textAlign: 'right', color: '#94a3b8', fontSize: '0.8rem' }}>Mixed currencies</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {!loading && !error && visibleData.length === 0 && (
        <Paper elevation={0} sx={{ p: 8, borderRadius: 0, border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center', color: '#94a3b8' }}>
          <PeopleIcon sx={{ fontSize: 48, opacity: 0.2, mb: 1.5 }} />
          <Typography sx={{ fontWeight: 600, mb: 0.5, color: '#475569' }}>No timesheet data</Typography>
          <Typography sx={{ fontSize: '0.875rem' }}>
            {selectedEmpId ? 'No hours logged for this employee this week.' : 'No employees have a Wrike user ID linked, or no time was logged this week.'}
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
