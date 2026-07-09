import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, CircularProgress, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Alert, IconButton, Tooltip, Divider, InputAdornment,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import PendingIcon from '@mui/icons-material/HourglassEmpty';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import VerifiedIcon from '@mui/icons-material/VerifiedUser';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import SyncIcon from '@mui/icons-material/Sync';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import LockIcon from '@mui/icons-material/Lock';
import SearchIcon from '@mui/icons-material/Search';
import { timesheetAPI, verificationsAPI, wrikeAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatHM, parseToMinutes } from '../utils/time';

const rowMinutes = (row) => row.actual_minutes != null ? row.actual_minutes : Math.round((row.actual_hours || 0) * 60);
const verMinutes = (ver) => ver?.verified_minutes != null
  ? ver.verified_minutes
  : (ver?.verified_hours != null ? Math.round(parseFloat(ver.verified_hours) * 60) : null);

const TH = { fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', py: 1.5, px: 2 };
const TD = { fontSize: '0.875rem', color: 'text.primary', py: 1.25, px: 2 };
const CURRENCY_SYMBOLS = { USD: '$', PHP: '₱', BDT: '৳' };
function currSym(currency) { return CURRENCY_SYMBOLS[currency] || currency || '₱'; }

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusChip({ status }) {
  const map = {
    verified: { label: 'Verified',  color: '#10b981', bg: '#10b98115', icon: <CheckCircleIcon sx={{ fontSize: 13 }} /> },
    rejected: { label: 'Rejected',  color: '#ef4444', bg: '#ef444415', icon: <CancelIcon      sx={{ fontSize: 13 }} /> },
    pending:  { label: 'Pending',   color: '#f59e0b', bg: '#f59e0b15', icon: <PendingIcon      sx={{ fontSize: 13 }} /> },
  };
  const s = map[status] || map.pending;
  return (
    <Chip icon={s.icon} label={s.label} size="small"
      sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: '0.72rem', '& .MuiChip-icon': { color: s.color } }} />
  );
}

function EditRow({ row, periodId, onSaved }) {
  const sym = currSym(row.employee?.currency);
  const initialMinutes = verMinutes(row.verification) ?? rowMinutes(row);
  const [hours, setHours] = useState(initialMinutes ? formatHM(initialMinutes) : '');
  const [cash,  setCash]  = useState(row.verification?.cash_advance ?? 0);
  const [notes, setNotes] = useState(row.verification?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const save = async (status) => {
    setSaving(true);
    try {
      await verificationsAPI.upsert({
        employee_id:      row.employee.id,
        period_id:        periodId,
        verified_minutes: hours !== '' ? parseToMinutes(hours) : null,
        cash_advance:   parseFloat(cash) || 0,
        status,
        notes,
      });
      toast.success(`${row.employee.name} marked as ${status}`);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
      <TextField label="Hours (e.g. 8h 30m)" size="small" value={hours}
        onChange={e => setHours(e.target.value)}
        placeholder="8h 30m" sx={{ width: 130 }} />
      <TextField label="Cash Advance" type="number" size="small" value={cash}
        onChange={e => setCash(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start">{sym}</InputAdornment> }}
        inputProps={{ step: 100, min: 0 }} sx={{ width: 145 }} />
      <TextField label="Notes" size="small" value={notes}
        onChange={e => setNotes(e.target.value)} sx={{ width: 180 }} />
      <Button size="small" variant="contained" disabled={saving} onClick={() => save('verified')}
        startIcon={saving ? <CircularProgress size={13} sx={{ color: 'white' }} /> : <CheckCircleIcon />}
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

const TYPE_TABS = [
  { value: 'local',   label: 'Local',         badge: '2× / month', color: '#6366f1' },
  { value: 'foreign', label: 'International',  badge: '1× / month', color: '#0ea5e9' },
];

export default function GenerateTimesheets() {
  const { user } = useAuth();
  const isReadOnly = user?.role === 'accounting_manager';
  const [tab,           setTab]           = useState('local');
  const [periods,       setPeriods]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [data,          setData]          = useState([]);
  const [dataLoading,   setDataLoading]   = useState(false);
  const [editingId,     setEditingId]     = useState(null);
  const [bulking,       setBulking]       = useState(false);
  const [syncing,       setSyncing]       = useState(false);
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [periodSearch,  setPeriodSearch]  = useState('');

  useEffect(() => {
    setLoading(true);
    timesheetAPI.getPeriods(100, 0)
      .then(res => setPeriods(res.data || []))
      .catch(() => toast.error('Failed to load periods'))
      .finally(() => setLoading(false));
  }, []);

  const fetchData = useCallback(async (periodId) => {
    if (!periodId) return;
    setDataLoading(true);
    setEditingId(null);
    setSearch('');
    setStatusFilter('all');
    try {
      const res = await verificationsAPI.getForPeriod(periodId);
      setData(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load timesheet data');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPeriod) fetchData(selectedPeriod.id);
    else setData([]);
  }, [selectedPeriod, fetchData]);

  const handleSyncWrike = async () => {
    if (!selectedPeriod) return;
    setSyncing(true);
    try {
      const res = await wrikeAPI.importPeriod(selectedPeriod.id);
      const { imported, skipped } = res.data || res;
      toast.success(`Synced: ${imported} new entries, ${skipped} already up to date`);
      fetchData(selectedPeriod.id);
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
      toast.success(`Verified ${eligible.length} employee(s)`);
      fetchData(selectedPeriod.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Bulk verify failed');
    } finally {
      setBulking(false);
    }
  };

  // Periods filtered by tab type + search term
  const pq = periodSearch.trim().toLowerCase();
  const filteredPeriods = periods.filter(p => {
    const matchesType = tab === 'local'
      ? (!p.period_type || p.period_type === 'local')
      : p.period_type === 'foreign';
    if (!matchesType) return false;
    if (!pq) return true;
    return (p.period_name || '').toLowerCase().includes(pq);
  });

  const verifiedCount  = data.filter(r => r.status === 'verified').length;
  const pendingCount   = data.filter(r => r.status === 'pending').length;
  const rejectedCount  = data.filter(r => r.status === 'rejected').length;
  const withHours      = data.filter(r => r.actual_hours > 0).length;
  const totalMinutes   = data.reduce((s, r) => s + rowMinutes(r), 0);
  const allVerified    = withHours > 0 && verifiedCount === withHours;
  const periodLocked   = selectedPeriod?.status !== 'open';

  const tabColor = TYPE_TABS.find(t => t.value === tab)?.color || '#6366f1';

  // Filter the employee rows by search term + status
  const q = search.trim().toLowerCase();
  const filteredData = data.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (!q) return true;
    const emp = r.employee || {};
    return (
      (emp.name || '').toLowerCase().includes(q) ||
      (emp.employee_id || '').toLowerCase().includes(q) ||
      (emp.department || '').toLowerCase().includes(q)
    );
  });

  const STATUS_FILTERS = [
    { value: 'all',      label: 'All',      count: data.length,    color: tabColor },
    { value: 'verified', label: 'Verified', count: verifiedCount,  color: '#10b981' },
    { value: 'pending',  label: 'Pending',  count: pendingCount,   color: '#f59e0b' },
    { value: 'rejected', label: 'Rejected', count: rejectedCount,  color: '#ef4444' },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IntegrationInstructionsIcon sx={{ color: 'white', fontSize: 18 }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Generate Timesheets</Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>Review and confirm employee hours per pay period before processing payroll</Typography>
          </Box>
        </Box>
        {selectedPeriod && !isReadOnly && !periodLocked && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="outlined" onClick={handleSyncWrike} disabled={syncing}
              startIcon={syncing ? <CircularProgress size={14} /> : <SyncIcon />}
              sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', borderColor: '#6366f1', color: '#6366f1', '&:hover': { bgcolor: '#6366f110' } }}>
              {syncing ? 'Syncing…' : 'Sync from Wrike'}
            </Button>
            {!allVerified && (
              <Button variant="outlined" onClick={handleBulkVerify} disabled={bulking || !data.length}
                startIcon={bulking ? <CircularProgress size={14} /> : <VerifiedIcon />}
                sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', borderColor: '#10b981', color: '#10b981', '&:hover': { bgcolor: '#10b98110' } }}>
                {bulking ? 'Verifying…' : `Verify All with Hours (${withHours})`}
              </Button>
            )}
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'stretch' }}>

        {/* Left: period list with type tabs */}
        <Box sx={{ width: 260, flexShrink: 0 }}>
          <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Tab switcher */}
            <Box sx={{ display: 'flex', borderBottom: '1px solid', borderBottomColor: 'divider' }}>
              {TYPE_TABS.map(t => (
                <Box key={t.value} onClick={() => { setTab(t.value); setSelectedPeriod(null); }}
                  sx={{ flex: 1, py: 1.25, px: 1, cursor: 'pointer', textAlign: 'center',
                    borderBottom: tab === t.value ? `3px solid ${t.color}` : '3px solid transparent',
                    bgcolor: tab === t.value ? `${t.color}08` : 'transparent',
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: `${t.color}10` } }}>
                  <Typography sx={{ fontWeight: tab === t.value ? 700 : 500, fontSize: '0.78rem', color: tab === t.value ? t.color : 'text.secondary' }}>
                    {t.label}
                  </Typography>
                  <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled', mt: 0.25 }}>{t.badge}</Typography>
                </Box>
              ))}
            </Box>

            {/* Period search */}
            <Box sx={{ px: 1.25, py: 1, borderBottom: '1px solid', borderBottomColor: 'divider' }}>
              <TextField
                size="small" fullWidth placeholder="Search period…"
                value={periodSearch} onChange={e => setPeriodSearch(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment>,
                  endAdornment: periodSearch ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setPeriodSearch('')}><CloseIcon sx={{ fontSize: 14 }} /></IconButton>
                    </InputAdornment>
                  ) : null,
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.76rem' } }}
              />
            </Box>

            {/* Period list */}
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}><CircularProgress size={22} sx={{ color: '#6366f1' }} /></Box>
              ) : filteredPeriods.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <CalendarMonthIcon sx={{ fontSize: 32, color: 'text.disabled', opacity: 0.3, mb: 1 }} />
                  <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled' }}>No {tab} periods</Typography>
                </Box>
              ) : filteredPeriods.map(p => {
                const active = selectedPeriod?.id === p.id;
                return (
                  <Box key={p.id} onClick={() => setSelectedPeriod(p)}
                    sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderBottomColor: 'divider', cursor: 'pointer',
                      bgcolor: active ? `${tabColor}08` : 'transparent',
                      borderLeft: active ? `3px solid ${tabColor}` : '3px solid transparent',
                      transition: 'all 0.15s',
                      '&:hover': { bgcolor: active ? `${tabColor}10` : 'action.hover' } }}>
                    <Typography sx={{ fontWeight: active ? 700 : 500, fontSize: '0.8rem', color: active ? tabColor : 'text.primary', lineHeight: 1.3 }}>
                      {p.period_name}
                    </Typography>
                    <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', mt: 0.25 }}>
                      {fmtDate(p.start_date)} – {fmtDate(p.end_date)}
                    </Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', textTransform: 'capitalize' }}>{p.status}</Typography>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        </Box>

        {/* Right: employee hours table */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {!selectedPeriod ? (
            <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', py: 14, textAlign: 'center', color: 'text.disabled' }}>
              <CalendarMonthIcon sx={{ fontSize: 40, opacity: 0.2, mb: 1.5 }} />
              <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', mb: 0.5 }}>Select a Pay Period</Typography>
              <Typography sx={{ fontSize: '0.8rem' }}>Choose a period from the left to review employee hours</Typography>
            </Paper>
          ) : dataLoading ? (
            <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', py: 10, textAlign: 'center' }}>
              <CircularProgress size={30} sx={{ color: tabColor, mb: 2 }} />
              <Typography sx={{ fontSize: '0.875rem', color: 'text.disabled' }}>Loading timesheet data…</Typography>
            </Paper>
          ) : (
            <>
              {/* Period info bar */}
              <Paper elevation={0} sx={{ borderRadius: '16px 16px 0 0', border: '1px solid', borderColor: 'divider', borderBottom: 'none', px: 2.5, py: 1.75, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', bgcolor: `${tabColor}06` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarMonthIcon sx={{ fontSize: 17, color: tabColor }} />
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: tabColor }}>{selectedPeriod.period_name}</Typography>
                </Box>
                <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                  {fmtDate(selectedPeriod.start_date)} – {fmtDate(selectedPeriod.end_date)}
                </Typography>
                {data.length > 0 && (
                  <>
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                    <Chip icon={<AccessTimeIcon sx={{ fontSize: '13px !important' }} />} label={`${formatHM(totalMinutes)} total`} size="small"
                      sx={{ bgcolor: `${tabColor}15`, color: tabColor, fontWeight: 700, fontSize: '0.68rem', '& .MuiChip-icon': { color: tabColor } }} />
                    {[{ label: `${verifiedCount} Verified`, color: '#10b981' }, { label: `${pendingCount} Pending`, color: '#f59e0b' }, ...(rejectedCount > 0 ? [{ label: `${rejectedCount} Rejected`, color: '#ef4444' }] : [])].map(s => (
                      <Chip key={s.label} label={s.label} size="small"
                        sx={{ bgcolor: `${s.color}15`, color: s.color, fontWeight: 700, fontSize: '0.68rem' }} />
                    ))}
                    {allVerified && !periodLocked && (
                      <Chip icon={<CheckCircleIcon />} label="All verified — ready for payroll" size="small"
                        sx={{ bgcolor: '#10b98115', color: '#10b981', fontWeight: 700, fontSize: '0.68rem', '& .MuiChip-icon': { fontSize: 13, color: '#10b981' } }} />
                    )}
                    {periodLocked && (
                      <Chip icon={<LockIcon sx={{ fontSize: '13px !important' }} />} label="Period locked — payroll processed" size="small"
                        sx={{ bgcolor: '#94a3b815', color: '#64748b', fontWeight: 700, fontSize: '0.68rem', '& .MuiChip-icon': { color: '#64748b' } }} />
                    )}
                  </>
                )}
              </Paper>

              {data.length === 0 ? (
                <Paper elevation={0} sx={{ borderRadius: '0 0 16px 16px', border: '1px solid', borderColor: 'divider', borderTop: 'none', py: 10, textAlign: 'center', color: 'text.disabled' }}>
                  <AccessTimeIcon sx={{ fontSize: 36, opacity: 0.2, mb: 1.5 }} />
                  <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', mb: 0.5 }}>No Timesheet Data</Typography>
                  <Typography sx={{ fontSize: '0.8rem' }}>Use <strong>Sync from Wrike</strong> to import hours for this period</Typography>
                </Paper>
              ) : (
                <>
                  {periodLocked ? (
                    <Alert severity="warning" icon={<LockIcon fontSize="inherit" />}
                      sx={{ borderRadius: 0, fontSize: '0.78rem', border: '1px solid', borderTop: 'none', borderBottom: 'none', borderColor: 'divider', py: 0.75, px: 2.5 }}>
                      This period has been processed into payroll. Timesheet data is <strong>read-only</strong> and cannot be edited.
                    </Alert>
                  ) : (
                    <Alert severity="info" icon={false}
                      sx={{ borderRadius: 0, fontSize: '0.78rem', border: '1px solid', borderTop: 'none', borderBottom: 'none', borderColor: 'divider',
                        bgcolor: 'rgba(99,102,241,0.04)', color: 'text.secondary', py: 0.75, px: 2.5 }}>
                      Review hours below. Override if needed, add cash advances/deductions, then <strong>Verify</strong> each employee. Only verified employees proceed to payroll.
                    </Alert>
                  )}
                  {/* Filter toolbar */}
                  <Box sx={{ border: '1px solid', borderTop: 'none', borderColor: 'divider', px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', bgcolor: 'background.paper' }}>
                    <TextField
                      size="small" placeholder="Search employee, ID or department…"
                      value={search} onChange={e => setSearch(e.target.value)}
                      InputProps={{
                        startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} /></InputAdornment>,
                        endAdornment: search ? (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setSearch('')}><CloseIcon sx={{ fontSize: 15 }} /></IconButton>
                          </InputAdornment>
                        ) : null,
                      }}
                      sx={{ width: 300, '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '0.82rem' } }}
                    />
                    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                      {STATUS_FILTERS.map(f => {
                        const active = statusFilter === f.value;
                        return (
                          <Chip key={f.value} label={`${f.label} (${f.count})`} size="small"
                            onClick={() => setStatusFilter(f.value)}
                            sx={{ fontWeight: 700, fontSize: '0.72rem', cursor: 'pointer', borderRadius: '8px',
                              border: '1px solid', borderColor: active ? f.color : 'divider',
                              bgcolor: active ? `${f.color}15` : 'transparent',
                              color: active ? f.color : 'text.secondary',
                              '&:hover': { bgcolor: `${f.color}12` } }} />
                        );
                      })}
                    </Box>
                    <Box sx={{ flex: 1 }} />
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>
                      Showing {filteredData.length} of {data.length}
                    </Typography>
                  </Box>
                  <Paper elevation={0} sx={{ borderRadius: '0 0 16px 16px', border: '1px solid', borderColor: 'divider', borderTop: 'none', overflow: 'hidden' }}>
                    <TableContainer sx={{ overflowX: 'auto' }}>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: 'action.hover' }}>
                          <TableRow>
                            <TableCell sx={{ ...TH, minWidth: 180 }}>Employee</TableCell>
                            <TableCell sx={{ ...TH, textAlign: 'center', minWidth: 110 }}>Hours (Wrike)</TableCell>
                            <TableCell sx={{ ...TH, textAlign: 'center', minWidth: 110 }}>Verified Hours</TableCell>
                            <TableCell sx={{ ...TH, textAlign: 'center', minWidth: 120 }}>Deductions</TableCell>
                            <TableCell sx={{ ...TH, textAlign: 'center', minWidth: 100 }}>Status</TableCell>
                            {!isReadOnly && !periodLocked && <TableCell sx={{ ...TH, minWidth: 320 }}>Actions</TableCell>}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredData.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={isReadOnly || periodLocked ? 5 : 6} sx={{ ...TD, textAlign: 'center', py: 5, color: 'text.disabled' }}>
                                <SearchIcon sx={{ fontSize: 28, opacity: 0.3, mb: 0.5, display: 'block', mx: 'auto' }} />
                                No employees match the current filter
                              </TableCell>
                            </TableRow>
                          )}
                          {filteredData.map(row => {
                            const emp      = row.employee;
                            const ver      = row.verification;
                            const isEdit   = editingId === emp.id;
                            const hasHours = row.actual_hours > 0;
                            const overridden = verMinutes(ver) != null && verMinutes(ver) !== rowMinutes(row);

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
                                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                        <AccessTimeIcon sx={{ fontSize: 14, color: tabColor }} />
                                        <Typography sx={{ fontWeight: 700, color: tabColor }}>{formatHM(rowMinutes(row))}</Typography>
                                      </Box>
                                    ) : (
                                      <Typography sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>No data</Typography>
                                    )}
                                  </TableCell>
                                  <TableCell sx={{ ...TD, textAlign: 'center' }}>
                                    {verMinutes(ver) != null ? (
                                      <Box>
                                        <Typography sx={{ fontWeight: 700, color: overridden ? '#f59e0b' : 'text.primary' }}>
                                          {formatHM(verMinutes(ver))}
                                        </Typography>
                                        {overridden && <Typography sx={{ fontSize: '0.62rem', color: '#f59e0b' }}>overridden</Typography>}
                                      </Box>
                                    ) : (
                                      <Typography sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>—</Typography>
                                    )}
                                  </TableCell>
                                  <TableCell sx={{ ...TD, textAlign: 'center' }}>
                                    {ver?.cash_advance > 0 ? (
                                      <Typography sx={{ fontWeight: 700, color: '#ef4444', fontSize: '0.875rem' }}>
                                        {currSym(row.employee?.currency)}{Number(ver.cash_advance).toLocaleString()}
                                      </Typography>
                                    ) : (
                                      <Typography sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>—</Typography>
                                    )}
                                  </TableCell>
                                  <TableCell sx={{ ...TD, textAlign: 'center' }}>
                                    <StatusChip status={row.status} />
                                  </TableCell>
                                  {!isReadOnly && !periodLocked && (
                                    <TableCell sx={TD}>
                                      {isEdit ? (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                          <EditRow row={row} periodId={selectedPeriod.id}
                                            onSaved={() => { setEditingId(null); fetchData(selectedPeriod.id); }} />
                                          <Tooltip title="Cancel">
                                            <IconButton size="small" onClick={() => setEditingId(null)}>
                                              <CloseIcon sx={{ fontSize: 16 }} />
                                            </IconButton>
                                          </Tooltip>
                                        </Box>
                                      ) : row.status === 'verified' ? null : (
                                        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                                          <Tooltip title={hasHours ? 'Edit & Verify' : 'No imported hours for this period'}>
                                            <span>
                                              <Button size="small" variant="outlined" disabled={!hasHours}
                                                startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                                                onClick={() => setEditingId(emp.id)}
                                                sx={{ textTransform: 'none', borderRadius: '8px', fontSize: '0.75rem',
                                                  borderColor: '#6366f1', color: '#6366f1', '&:hover': { borderColor: '#4f46e5', bgcolor: '#6366f110' } }}>
                                                Edit & Verify
                                              </Button>
                                            </span>
                                          </Tooltip>
                                          {row.status === 'verified' && (
                                            <Button size="small" variant="text"
                                              onClick={async () => {
                                                try {
                                                  await verificationsAPI.upsert({ employee_id: emp.id, period_id: selectedPeriod.id, status: 'pending' });
                                                  fetchData(selectedPeriod.id);
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
                  </Paper>
                </>
              )}
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
