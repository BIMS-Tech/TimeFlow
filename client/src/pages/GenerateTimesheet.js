import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, CircularProgress, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Select, MenuItem, FormControl, InputLabel, Alert,
  IconButton, Tooltip, Divider, InputAdornment,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PendingIcon from '@mui/icons-material/HourglassEmpty';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import VerifiedIcon from '@mui/icons-material/VerifiedUser';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import SyncIcon from '@mui/icons-material/Sync';
import { timesheetAPI, verificationsAPI, wrikeAPI } from '../api';

const TH = { fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', py: 1.5, px: 2 };
const TD = { fontSize: '0.875rem', color: 'text.primary', py: 1.25, px: 2 };

const CURRENCY_SYMBOLS = { USD: '$', PHP: '₱', BDT: '৳' };
function fmt(n, currency = 'PHP') {
  const sym = CURRENCY_SYMBOLS[currency] || currency;
  return `${sym}${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusChip({ status }) {
  const map = {
    verified:  { label: 'Verified',  color: '#10b981', bg: '#10b98115', icon: <CheckCircleIcon sx={{ fontSize: 13 }} /> },
    rejected:  { label: 'Rejected',  color: '#ef4444', bg: '#ef444415', icon: <CancelIcon      sx={{ fontSize: 13 }} /> },
    pending:   { label: 'Pending',   color: '#f59e0b', bg: '#f59e0b15', icon: <PendingIcon      sx={{ fontSize: 13 }} /> },
  };
  const s = map[status] || map.pending;
  return (
    <Chip
      icon={s.icon}
      label={s.label}
      size="small"
      sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: '0.72rem',
        '& .MuiChip-icon': { color: s.color } }}
    />
  );
}

function EditRow({ row, periodId, onSaved }) {
  const [hours, setHours]   = useState(row.verification?.verified_hours ?? row.actual_hours ?? '');
  const [cash,  setCash]    = useState(row.verification?.cash_advance ?? 0);
  const [notes, setNotes]   = useState(row.verification?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const save = async (newStatus) => {
    setSaving(true);
    try {
      await verificationsAPI.upsert({
        employee_id:   row.employee.id,
        period_id:     periodId,
        verified_hours: hours !== '' ? parseFloat(hours) : null,
        cash_advance:  parseFloat(cash) || 0,
        status:        newStatus,
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
      <TextField
        label="Hours"
        type="number"
        size="small"
        value={hours}
        onChange={e => setHours(e.target.value)}
        inputProps={{ step: 0.5, min: 0 }}
        sx={{ width: 100 }}
      />
      <TextField
        label="Cash Advance"
        type="number"
        size="small"
        value={cash}
        onChange={e => setCash(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
        inputProps={{ step: 100, min: 0 }}
        sx={{ width: 150 }}
      />
      <TextField
        label="Notes"
        size="small"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        sx={{ width: 200 }}
      />
      <Button size="small" variant="contained" disabled={saving}
        onClick={() => save('verified')}
        startIcon={saving ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <CheckCircleIcon />}
        sx={{ textTransform: 'none', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' }, borderRadius: '8px', fontSize: '0.78rem' }}>
        Verify
      </Button>
      <Button size="small" variant="outlined" disabled={saving}
        onClick={() => save('rejected')}
        startIcon={<CancelIcon />}
        sx={{ textTransform: 'none', borderColor: '#ef4444', color: '#ef4444', borderRadius: '8px', fontSize: '0.78rem',
          '&:hover': { borderColor: '#dc2626', bgcolor: '#ef444410' } }}>
        Reject
      </Button>
    </Box>
  );
}

export default function GenerateTimesheet() {
  const [periods,       setPeriods]       = useState([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('');

  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [bulking,   setBulking]   = useState(false);
  const [syncing,   setSyncing]   = useState(false);

  useEffect(() => {
    timesheetAPI.getPeriods(100, 0)
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

  useEffect(() => { fetchVerifications(selectedPeriod); }, [selectedPeriod, fetchVerifications]);

  const handleSyncWrike = async () => {
    setSyncing(true);
    try {
      const res = await wrikeAPI.importPeriod(selectedPeriod);
      const { imported, skipped } = res.data || res;
      toast.success(`Synced from Wrike: ${imported} new entries imported, ${skipped} already up to date`);
      fetchVerifications(selectedPeriod);
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
      await verificationsAPI.bulk(selectedPeriod, eligible.map(r => r.employee.id), 'verified');
      toast.success(`Verified ${eligible.length} employees`);
      fetchVerifications(selectedPeriod);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Bulk verify failed');
    } finally {
      setBulking(false);
    }
  };

  const verifiedCount  = data.filter(r => r.status === 'verified').length;
  const pendingCount   = data.filter(r => r.status === 'pending').length;
  const rejectedCount  = data.filter(r => r.status === 'rejected').length;
  const withHours      = data.filter(r => r.actual_hours > 0).length;
  const selectedPeriodObj = periods.find(p => String(p.id) === String(selectedPeriod));

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>
            Generate Timesheet
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled', mt: 0.25 }}>
            Verify employee hours before generating payslips
          </Typography>
        </Box>
        {selectedPeriod && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" onClick={handleSyncWrike} disabled={syncing}
              startIcon={syncing ? <CircularProgress size={14} /> : <SyncIcon />}
              sx={{ textTransform: 'none', borderRadius: '10px', borderColor: '#6366f1', color: '#6366f1',
                '&:hover': { borderColor: '#4f46e5', bgcolor: '#6366f110' } }}>
              {syncing ? 'Syncing…' : 'Sync from Wrike'}
            </Button>
            <Button variant="outlined" onClick={handleBulkVerify} disabled={bulking || !data.length}
              startIcon={bulking ? <CircularProgress size={14} /> : <VerifiedIcon />}
              sx={{ textTransform: 'none', borderRadius: '10px', borderColor: '#10b981', color: '#10b981',
                '&:hover': { borderColor: '#059669', bgcolor: '#10b98110' } }}>
              {bulking ? 'Verifying…' : `Verify All with Hours (${withHours})`}
            </Button>
          </Box>
        )}
      </Box>

      {/* Period selector */}
      <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 0, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#6366f1' }}>
          <CalendarMonthIcon />
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Select Pay Period</Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 280 }}>
          <InputLabel>Choose period…</InputLabel>
          <Select
            label="Choose period…"
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
            sx={{ borderRadius: '10px' }}
          >
            {periodsLoading ? (
              <MenuItem disabled><CircularProgress size={16} /></MenuItem>
            ) : periods.map(p => (
              <MenuItem key={p.id} value={String(p.id)}>
                {p.period_name} — {new Date(p.start_date).toLocaleDateString()} to {new Date(p.end_date).toLocaleDateString()}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {selectedPeriod && data.length > 0 && (
          <>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            {[
              { label: `${verifiedCount} Verified`,  color: '#10b981' },
              { label: `${pendingCount} Pending`,    color: '#f59e0b' },
              { label: `${rejectedCount} Rejected`,  color: '#ef4444' },
            ].map(s => (
              <Chip key={s.label} label={s.label} size="small"
                sx={{ bgcolor: `${s.color}15`, color: s.color, fontWeight: 700, fontSize: '0.72rem' }} />
            ))}
          </>
        )}
      </Paper>

      {!selectedPeriod && (
        <Paper elevation={0} sx={{ p: 8, borderRadius: 0, border: '1px solid', borderColor: 'divider', textAlign: 'center', color: 'text.disabled' }}>
          <CalendarMonthIcon sx={{ fontSize: 48, opacity: 0.2, mb: 1.5 }} />
          <Typography sx={{ fontWeight: 600, mb: 0.5, color: 'text.secondary' }}>Select a Pay Period</Typography>
          <Typography sx={{ fontSize: '0.875rem' }}>Choose a pay period above to review and verify employee hours.</Typography>
        </Paper>
      )}

      {selectedPeriod && loading && (
        <Paper elevation={0} sx={{ p: 6, borderRadius: 0, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
          <CircularProgress size={32} sx={{ color: '#6366f1', mb: 2 }} />
          <Typography sx={{ fontSize: '0.875rem', color: 'text.disabled' }}>Loading employee data…</Typography>
        </Paper>
      )}

      {selectedPeriod && !loading && data.length > 0 && (
        <>
          <Alert severity="info" sx={{ mb: 2, borderRadius: 0, fontSize: '0.8rem' }}>
            <strong>How it works:</strong> Review each employee's actual imported hours. Override hours if needed, add cash advance deductions, then click <strong>Verify</strong>. Only verified employees can have payslips generated in <em>Generate Payslips</em>.
          </Alert>

          <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'action.hover' }}>
                  <TableRow>
                    <TableCell sx={{ ...TH, minWidth: 180 }}>Employee</TableCell>
                    <TableCell sx={{ ...TH, textAlign: 'center', minWidth: 100 }}>Actual Hours</TableCell>
                    <TableCell sx={{ ...TH, textAlign: 'center', minWidth: 110 }}>Verified Hours</TableCell>
                    <TableCell sx={{ ...TH, textAlign: 'center', minWidth: 120 }}>Cash Advance</TableCell>
                    <TableCell sx={{ ...TH, textAlign: 'center', minWidth: 100 }}>Status</TableCell>
                    <TableCell sx={{ ...TH, minWidth: 320 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.map(row => {
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
                            {hasHours ? (
                              <Typography sx={{ fontWeight: 700, color: '#6366f1' }}>{row.actual_hours.toFixed(1)}h</Typography>
                            ) : (
                              <Typography sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>No data</Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ ...TD, textAlign: 'center' }}>
                            {ver?.verified_hours != null ? (
                              <Typography sx={{ fontWeight: 700, color: parseFloat(ver.verified_hours) !== row.actual_hours ? '#f59e0b' : 'text.primary' }}>
                                {parseFloat(ver.verified_hours).toFixed(1)}h
                                {parseFloat(ver.verified_hours) !== row.actual_hours && <Typography component="span" sx={{ fontSize: '0.65rem', color: '#f59e0b', ml: 0.5 }}>override</Typography>}
                              </Typography>
                            ) : (
                              <Typography sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>—</Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ ...TD, textAlign: 'center' }}>
                            {ver?.cash_advance > 0 ? (
                              <Typography sx={{ fontWeight: 700, color: '#ef4444' }}>
                                {fmt(ver.cash_advance, emp.currency)}
                              </Typography>
                            ) : (
                              <Typography sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>—</Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ ...TD, textAlign: 'center' }}>
                            <StatusChip status={row.status} />
                          </TableCell>
                          <TableCell sx={TD}>
                            {isEdit ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <EditRow
                                  row={row}
                                  periodId={selectedPeriod}
                                  onSaved={() => { setEditingId(null); fetchVerifications(selectedPeriod); }}
                                />
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
                                        await verificationsAPI.upsert({ employee_id: emp.id, period_id: selectedPeriod, status: 'pending' });
                                        fetchVerifications(selectedPeriod);
                                      } catch { toast.error('Failed to reset'); }
                                    }}
                                    sx={{ textTransform: 'none', fontSize: '0.72rem', color: 'text.disabled',
                                      '&:hover': { color: '#f59e0b' } }}>
                                    Reset
                                  </Button>
                                )}
                              </Box>
                            )}
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Summary footer */}
          <Paper elevation={0} sx={{ mt: 2, p: 2, borderRadius: 0, border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover', display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>Period Summary</Typography>
            {selectedPeriodObj && (
              <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                {new Date(selectedPeriodObj.start_date).toLocaleDateString()} – {new Date(selectedPeriodObj.end_date).toLocaleDateString()}
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                <strong style={{ color: '#10b981' }}>{verifiedCount}</strong> of {data.length} verified
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                <strong>{data.filter(r => r.actual_hours > 0).reduce((s, r) => s + (r.verification?.verified_hours != null ? parseFloat(r.verification.verified_hours) : r.actual_hours), 0).toFixed(1)}h</strong> total hours
              </Typography>
            </Box>
            {verifiedCount === withHours && withHours > 0 && (
              <Chip label="All ready — go to Generate Payslips" size="small"
                sx={{ bgcolor: '#10b98115', color: '#10b981', fontWeight: 700, fontSize: '0.72rem',
                  '& .MuiChip-icon': { color: '#10b981' } }}
                icon={<CheckCircleIcon />} />
            )}
          </Paper>
        </>
      )}
    </Box>
  );
}
