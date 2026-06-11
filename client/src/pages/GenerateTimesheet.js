import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, CircularProgress, Chip, Grid, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Alert, IconButton, Tooltip, InputAdornment,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PendingIcon from '@mui/icons-material/HourglassEmpty';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import VerifiedIcon from '@mui/icons-material/VerifiedUser';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import SyncIcon from '@mui/icons-material/Sync';
import SearchIcon from '@mui/icons-material/Search';
import HomeIcon from '@mui/icons-material/Home';
import PublicIcon from '@mui/icons-material/Public';
import { timesheetAPI, verificationsAPI, wrikeAPI } from '../api';
import { useAuth } from '../context/AuthContext';

const TH = { fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', py: 1.5, px: 2 };
const TD = { fontSize: '0.875rem', color: 'text.primary', py: 1.25, px: 2 };

const CURRENCY_SYMBOLS = { USD: '$', PHP: '₱', BDT: '৳' };
function fmt(n, currency = 'PHP') {
  const sym = CURRENCY_SYMBOLS[currency] || currency;
  return `${sym}${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusChip({ status }) {
  const map = {
    verified: { label: 'Verified', color: '#10b981', bg: '#10b98115', icon: <CheckCircleIcon sx={{ fontSize: 13 }} /> },
    rejected: { label: 'Rejected', color: '#ef4444', bg: '#ef444415', icon: <CancelIcon      sx={{ fontSize: 13 }} /> },
    pending:  { label: 'Pending',  color: '#f59e0b', bg: '#f59e0b15', icon: <PendingIcon      sx={{ fontSize: 13 }} /> },
  };
  const s = map[status] || map.pending;
  return (
    <Chip icon={s.icon} label={s.label} size="small"
      sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: '0.72rem', '& .MuiChip-icon': { color: s.color } }} />
  );
}

function EditRow({ row, periodId, onSaved }) {
  const sym = CURRENCY_SYMBOLS[row.employee?.currency] || row.employee?.currency || '₱';
  const [hours, setHours]   = useState(row.verification?.verified_hours ?? row.actual_hours ?? '');
  const [cash,  setCash]    = useState(row.verification?.cash_advance ?? 0);
  const [notes, setNotes]   = useState(row.verification?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const save = async (newStatus) => {
    setSaving(true);
    try {
      await verificationsAPI.upsert({
        employee_id:    row.employee.id,
        period_id:      periodId,
        verified_hours: hours !== '' ? parseFloat(hours) : null,
        cash_advance:   parseFloat(cash) || 0,
        status:         newStatus,
        notes,
      });
      toast.success(`${row.employee.name} marked as ${newStatus}`);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
      <TextField label="Hours" type="number" size="small" value={hours} onChange={e => setHours(e.target.value)}
        inputProps={{ step: 0.5, min: 0 }} sx={{ width: 100 }} />
      <TextField label="Cash Advance" type="number" size="small" value={cash} onChange={e => setCash(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start">{sym}</InputAdornment> }}
        inputProps={{ step: 100, min: 0 }} sx={{ width: 150 }} />
      <TextField label="Notes" size="small" value={notes} onChange={e => setNotes(e.target.value)} sx={{ width: 200 }} />
      <Button size="small" variant="contained" disabled={saving} onClick={() => save('verified')}
        startIcon={saving ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <CheckCircleIcon />}
        sx={{ textTransform: 'none', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, borderRadius: '8px', fontSize: '0.78rem' }}>
        Verify
      </Button>
      <Button size="small" variant="outlined" disabled={saving} onClick={() => save('rejected')}
        startIcon={<CancelIcon />}
        sx={{ textTransform: 'none', borderColor: '#ef4444', color: '#ef4444', borderRadius: '8px', fontSize: '0.78rem',
          '&:hover': { borderColor: '#dc2626', bgcolor: '#ef444410' } }}>
        Reject
      </Button>
    </Box>
  );
}

export default function GenerateTimesheet() {
  const { user } = useAuth();
  const isReadOnly = user?.role === 'accounting_manager';

  const [periods,        setPeriods]        = useState([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [periodTab,      setPeriodTab]      = useState(0); // 0=local, 1=foreign
  const [periodSearch,   setPeriodSearch]   = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [bulking,   setBulking]   = useState(false);
  const [syncing,   setSyncing]   = useState(false);
  const [empSearch, setEmpSearch] = useState('');

  useEffect(() => {
    timesheetAPI.getPeriods(200, 0)
      .then(res => setPeriods(res.data || []))
      .catch(() => toast.error('Failed to load periods'))
      .finally(() => setPeriodsLoading(false));
  }, []);

  const fetchVerifications = useCallback(async (periodId) => {
    if (!periodId) return;
    setLoading(true);
    setEditingId(null);
    try {
      const res = await verificationsAPI.getForPeriod(periodId);
      setData(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load verification data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVerifications(selectedPeriod?.id);
    setEmpSearch('');
  }, [selectedPeriod, fetchVerifications]);

  const handleSyncWrike = async () => {
    setSyncing(true);
    try {
      const res = await wrikeAPI.importPeriod(selectedPeriod.id);
      const { imported, skipped } = res.data || res;
      toast.success(`Synced from Wrike: ${imported} new entries imported, ${skipped} already up to date`);
      fetchVerifications(selectedPeriod.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Wrike sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleBulkVerify = async () => {
    const eligible = data.filter(r => r.actual_hours > 0 && r.status !== 'verified');
    if (!eligible.length) { toast('All employees with hours are already verified.', { icon: 'ℹ️' }); return; }
    setBulking(true);
    try {
      await verificationsAPI.bulk(selectedPeriod.id, eligible.map(r => r.employee.id), 'verified');
      toast.success(`Verified ${eligible.length} employees`);
      fetchVerifications(selectedPeriod.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Bulk verify failed');
    } finally {
      setBulking(false);
    }
  };

  // Period list filtering
  const localPeriods   = periods.filter(p => !p.period_type || p.period_type === 'local');
  const foreignPeriods = periods.filter(p => p.period_type === 'foreign');
  const tabPeriods     = periodTab === 0 ? localPeriods : foreignPeriods;
  const filteredPeriods = periodSearch
    ? tabPeriods.filter(p => p.period_name.toLowerCase().includes(periodSearch.toLowerCase()))
    : tabPeriods;

  // Employee table
  const verifiedCount = data.filter(r => r.status === 'verified').length;
  const pendingCount  = data.filter(r => r.status === 'pending').length;
  const rejectedCount = data.filter(r => r.status === 'rejected').length;
  const withHours     = data.filter(r => r.actual_hours > 0).length;
  const visibleData   = empSearch
    ? data.filter(r => r.employee?.name?.toLowerCase().includes(empSearch.toLowerCase()))
    : data;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <VerifiedIcon sx={{ color: 'white', fontSize: 18 }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              Verify Timesheet
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
              Review and confirm employee hours before processing payroll
            </Typography>
          </Box>
        </Box>
        {selectedPeriod && !isReadOnly && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" onClick={handleSyncWrike} disabled={syncing}
              startIcon={syncing ? <CircularProgress size={14} /> : <SyncIcon />}
              sx={{ textTransform: 'none', borderRadius: '10px', fontSize: '0.82rem', borderColor: '#6366f1', color: '#6366f1',
                '&:hover': { borderColor: '#4f46e5', bgcolor: '#6366f110' } }}>
              {syncing ? 'Syncing…' : 'Sync Wrike'}
            </Button>
            <Button variant="outlined" onClick={handleBulkVerify} disabled={bulking || !data.length}
              startIcon={bulking ? <CircularProgress size={14} /> : <VerifiedIcon />}
              sx={{ textTransform: 'none', borderRadius: '10px', fontSize: '0.82rem', borderColor: '#10b981', color: '#10b981',
                '&:hover': { borderColor: '#059669', bgcolor: '#10b98110' } }}>
              {bulking ? 'Verifying…' : `Verify All with Hours (${withHours})`}
            </Button>
          </Box>
        )}
      </Box>

      <Grid container spacing={2} sx={{ alignItems: 'start' }}>

        {/* ── Left: Period list ──────────────────────────────────────────── */}
        <Grid item xs={12} md={3}>
          <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            {/* Tabs */}
            <Tabs value={periodTab} onChange={(_, v) => { setPeriodTab(v); setSelectedPeriod(null); setPeriodSearch(''); }}
              sx={{ borderBottom: '1px solid', borderColor: 'divider', minHeight: 44,
                '& .MuiTabs-indicator': { bgcolor: '#6366f1', height: 3 },
                '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, fontSize: '0.8rem', minHeight: 44, py: 0 } }}>
              <Tab label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <HomeIcon sx={{ fontSize: 14 }} />
                  <Box>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, lineHeight: 1 }}>Local</Typography>
                    <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', lineHeight: 1 }}>2× / month</Typography>
                  </Box>
                  <Chip label={localPeriods.length} size="small"
                    sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, bgcolor: periodTab === 0 ? '#6366f115' : 'action.hover', color: periodTab === 0 ? '#6366f1' : 'text.secondary' }} />
                </Box>
              } />
              <Tab label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <PublicIcon sx={{ fontSize: 14 }} />
                  <Box>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, lineHeight: 1 }}>International</Typography>
                    <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', lineHeight: 1 }}>1× / month</Typography>
                  </Box>
                  <Chip label={foreignPeriods.length} size="small"
                    sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, bgcolor: periodTab === 1 ? '#6366f115' : 'action.hover', color: periodTab === 1 ? '#6366f1' : 'text.secondary' }} />
                </Box>
              } />
            </Tabs>

            {/* Search */}
            <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderBottomColor: 'divider' }}>
              <TextField fullWidth size="small" placeholder="Search periods…" value={periodSearch} onChange={e => setPeriodSearch(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '0.82rem' } }}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 15, color: 'text.disabled' }} /></InputAdornment> } }} />
            </Box>

            {/* Period list */}
            <Box sx={{ maxHeight: 520, overflowY: 'auto' }}>
              {periodsLoading ? (
                <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}><CircularProgress size={22} sx={{ color: '#6366f1' }} /></Box>
              ) : filteredPeriods.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center', color: 'text.disabled', fontSize: '0.8rem' }}>
                  {periodSearch ? 'No periods match your search' : 'No periods'}
                </Box>
              ) : filteredPeriods.map(p => {
                const active = selectedPeriod?.id === p.id;
                const statusLabel = { open: 'Open', pending_approval: 'Pending Approval', approved: 'Approved', completed: 'Completed', paid: 'Paid' }[p.status] || p.status;
                const statusColor = { open: '#6366f1', pending_approval: '#f59e0b', approved: '#10b981', completed: '#10b981', paid: '#10b981' }[p.status] || '#6366f1';
                return (
                  <Box key={p.id} onClick={() => setSelectedPeriod(p)}
                    sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderBottomColor: 'divider', cursor: 'pointer',
                      bgcolor: active ? 'rgba(99,102,241,0.06)' : 'transparent',
                      borderLeft: active ? '3px solid #6366f1' : '3px solid transparent',
                      transition: 'all 0.15s', '&:hover': { bgcolor: active ? 'rgba(99,102,241,0.08)' : 'action.hover' } }}>
                    <Typography sx={{ fontWeight: active ? 700 : 500, fontSize: '0.8rem', color: active ? '#6366f1' : 'text.primary',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mb: 0.25 }}>
                      {p.period_name}
                    </Typography>
                    <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', mb: 0.4 }}>
                      {fmtDate(p.start_date)} – {fmtDate(p.end_date)}
                    </Typography>
                    <Chip label={statusLabel} size="small"
                      sx={{ height: 16, fontSize: '0.58rem', fontWeight: 700, bgcolor: `${statusColor}18`, color: statusColor }} />
                  </Box>
                );
              })}
            </Box>
          </Paper>
        </Grid>

        {/* ── Right: Employee table ──────────────────────────────────────── */}
        <Grid item xs={12} md={9}>
          {!selectedPeriod ? (
            <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', py: 14, textAlign: 'center', color: 'text.disabled' }}>
              <CalendarMonthIcon sx={{ fontSize: 40, opacity: 0.2, mb: 1.5 }} />
              <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', mb: 0.5 }}>Select a Pay Period</Typography>
              <Typography sx={{ fontSize: '0.8rem' }}>Choose a period from the left to review employee hours</Typography>
            </Paper>
          ) : loading ? (
            <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', py: 10, textAlign: 'center' }}>
              <CircularProgress size={32} sx={{ color: '#6366f1', mb: 2 }} />
              <Typography sx={{ fontSize: '0.875rem', color: 'text.disabled' }}>Loading employee data…</Typography>
            </Paper>
          ) : (
            <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>

              {/* Period header */}
              <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'text.primary' }}>{selectedPeriod.period_name}</Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                    {fmtDate(selectedPeriod.start_date)} – {fmtDate(selectedPeriod.end_date)}
                  </Typography>
                </Box>
                {data.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {[
                      { label: `${verifiedCount} Verified`, color: '#10b981' },
                      { label: `${pendingCount} Pending`,   color: '#f59e0b' },
                      { label: `${rejectedCount} Rejected`, color: '#ef4444' },
                    ].filter(s => {
                      const count = parseInt(s.label);
                      return count > 0;
                    }).map(s => (
                      <Chip key={s.label} label={s.label} size="small"
                        sx={{ bgcolor: `${s.color}15`, color: s.color, fontWeight: 700, fontSize: '0.72rem' }} />
                    ))}
                  </Box>
                )}
              </Box>

              {data.length === 0 ? (
                <Box sx={{ py: 10, textAlign: 'center', color: 'text.disabled' }}>
                  <VerifiedIcon sx={{ fontSize: 36, opacity: 0.2, mb: 1.5 }} />
                  <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', mb: 0.5 }}>No Employees Found</Typography>
                  <Typography sx={{ fontSize: '0.8rem' }}>No employee timesheet data for this period. Try syncing from Wrike.</Typography>
                </Box>
              ) : (
                <>
                  <Alert severity="info" sx={{ m: 2, borderRadius: '10px', fontSize: '0.78rem', py: 0.75 }}>
                    Review each employee's hours. Override if needed, add cash advance, then <strong>Verify</strong>. Only verified employees appear in Process Payroll.
                  </Alert>

                  {/* Employee search */}
                  <Box sx={{ px: 2, pb: 1.5 }}>
                    <TextField fullWidth size="small" placeholder="Search employees…" value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                      sx={{ maxWidth: 320, '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '0.82rem' } }}
                      slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment> } }} />
                  </Box>

                  <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                          <TableCell sx={{ ...TH, minWidth: 180 }}>Employee</TableCell>
                          <TableCell sx={{ ...TH, textAlign: 'center', minWidth: 100 }}>Actual Hours</TableCell>
                          <TableCell sx={{ ...TH, textAlign: 'center', minWidth: 110 }}>Verified Hours</TableCell>
                          <TableCell sx={{ ...TH, textAlign: 'center', minWidth: 120 }}>Cash Advance</TableCell>
                          <TableCell sx={{ ...TH, textAlign: 'center', minWidth: 100 }}>Status</TableCell>
                          {!isReadOnly && <TableCell sx={{ ...TH, minWidth: 320 }}>Actions</TableCell>}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {visibleData.map(row => {
                          const emp    = row.employee;
                          const ver    = row.verification;
                          const isEdit = editingId === emp.id;
                          const hasHours = row.actual_hours > 0;
                          return (
                            <React.Fragment key={emp.id}>
                              <TableRow sx={{
                                bgcolor: row.status === 'verified' ? '#10b98105' : row.status === 'rejected' ? '#ef444405' : 'transparent',
                                opacity: hasHours ? 1 : 0.55,
                                '&:hover': { bgcolor: 'action.hover' },
                              }}>
                                <TableCell sx={TD}>
                                  <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{emp.name}</Typography>
                                  <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                                    {emp.employee_id}{emp.department ? ` · ${emp.department}` : ''}
                                  </Typography>
                                </TableCell>
                                <TableCell sx={{ ...TD, textAlign: 'center' }}>
                                  {hasHours
                                    ? <Typography sx={{ fontWeight: 700, color: '#6366f1' }}>{row.actual_hours.toFixed(1)}h</Typography>
                                    : <Typography sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>No data</Typography>}
                                </TableCell>
                                <TableCell sx={{ ...TD, textAlign: 'center' }}>
                                  {ver?.verified_hours != null ? (
                                    <Typography sx={{ fontWeight: 700, color: parseFloat(ver.verified_hours) !== row.actual_hours ? '#f59e0b' : 'text.primary' }}>
                                      {parseFloat(ver.verified_hours).toFixed(1)}h
                                      {parseFloat(ver.verified_hours) !== row.actual_hours && (
                                        <Typography component="span" sx={{ fontSize: '0.65rem', color: '#f59e0b', ml: 0.5 }}>override</Typography>
                                      )}
                                    </Typography>
                                  ) : <Typography sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>—</Typography>}
                                </TableCell>
                                <TableCell sx={{ ...TD, textAlign: 'center' }}>
                                  {ver?.cash_advance > 0
                                    ? <Typography sx={{ fontWeight: 700, color: '#ef4444' }}>{fmt(ver.cash_advance, emp.currency)}</Typography>
                                    : <Typography sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>—</Typography>}
                                </TableCell>
                                <TableCell sx={{ ...TD, textAlign: 'center' }}>
                                  <StatusChip status={row.status} />
                                </TableCell>
                                {!isReadOnly && (
                                  <TableCell sx={TD}>
                                    {isEdit ? (
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <EditRow row={row} periodId={selectedPeriod.id}
                                          onSaved={() => { setEditingId(null); fetchVerifications(selectedPeriod.id); }} />
                                        <Tooltip title="Cancel">
                                          <IconButton size="small" onClick={() => setEditingId(null)}>
                                            <CloseIcon sx={{ fontSize: 16 }} />
                                          </IconButton>
                                        </Tooltip>
                                      </Box>
                                    ) : (
                                      <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                                        <Tooltip title={hasHours ? 'Edit / Verify' : 'No imported hours for this period'}>
                                          <span>
                                            <Button size="small" variant="outlined" disabled={!hasHours}
                                              startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                                              onClick={() => setEditingId(emp.id)}
                                              sx={{ textTransform: 'none', borderRadius: '8px', fontSize: '0.75rem',
                                                borderColor: '#6366f1', color: '#6366f1',
                                                '&:hover': { borderColor: '#4f46e5', bgcolor: '#6366f110' } }}>
                                              Edit & Verify
                                            </Button>
                                          </span>
                                        </Tooltip>
                                        {row.status === 'verified' && !isEdit && (
                                          <Button size="small" variant="text"
                                            onClick={async () => {
                                              try {
                                                await verificationsAPI.upsert({ employee_id: emp.id, period_id: selectedPeriod.id, status: 'pending' });
                                                fetchVerifications(selectedPeriod.id);
                                              } catch { toast.error('Failed to reset'); }
                                            }}
                                            sx={{ textTransform: 'none', fontSize: '0.72rem', color: 'text.disabled', '&:hover': { color: '#f59e0b' } }}>
                                            Reset
                                          </Button>
                                        )}
                                      </Box>
                                    )}
                                  </TableCell>
                                )}
                              </TableRow>
                            </React.Fragment>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Summary footer */}
                  <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid', borderTopColor: 'divider', bgcolor: 'action.hover', display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                      <strong style={{ color: '#10b981' }}>{verifiedCount}</strong> of {data.length} employees verified
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                      <strong>{data.filter(r => r.actual_hours > 0).reduce((s, r) => s + (r.verification?.verified_hours != null ? parseFloat(r.verification.verified_hours) : r.actual_hours), 0).toFixed(1)}h</strong> total hours
                    </Typography>
                    {verifiedCount === withHours && withHours > 0 && (
                      <Chip label="All ready — go to Process Payroll" size="small" icon={<CheckCircleIcon />}
                        sx={{ bgcolor: '#10b98115', color: '#10b981', fontWeight: 700, fontSize: '0.72rem', '& .MuiChip-icon': { color: '#10b981' } }} />
                    )}
                  </Box>
                </>
              )}
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
