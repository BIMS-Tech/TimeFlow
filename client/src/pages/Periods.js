import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, Chip, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, InputAdornment,
  CircularProgress, IconButton, FormControl, InputLabel, Select, MenuItem, Tabs, Tab, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PublicIcon from '@mui/icons-material/Public';
import HomeIcon from '@mui/icons-material/Home';
import RefreshIcon from '@mui/icons-material/Refresh';
import PeopleIcon from '@mui/icons-material/People';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SearchIcon from '@mui/icons-material/Search';
import LockIcon from '@mui/icons-material/Lock';
import { timesheetAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatHM, formatHoursAsHM } from '../utils/time';

const STATUS_META = {
  open:             { label: 'Open',             color: '#6366f1', bg: '#6366f115' },
  processing:       { label: 'Processing',        color: '#f59e0b', bg: '#f59e0b15' },
  pending_approval: { label: 'Pending Approval',  color: '#f59e0b', bg: '#f59e0b15' },
  approved:         { label: 'Approved',           color: '#10b981', bg: '#10b98115' },
  completed:        { label: 'Completed',          color: '#10b981', bg: '#10b98115' },
  paid:             { label: 'Paid',               color: '#10b981', bg: '#10b98115' },
};
const STATUS_OPTIONS = ['open', 'processing', 'pending_approval', 'approved', 'paid'];
const PAYSLIP_CHIP = {
  approved: { label: 'Generated',     color: '#10b981', bg: '#10b98118' },
  pending:  { label: 'Not Generated', color: '#94a3b8', bg: '#94a3b818' },
  rejected: { label: 'Failed',        color: '#ef4444', bg: '#ef444418' },
};
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const isPeriodLocked = (p) => p && p.status !== 'open';
const TH = { fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', py: 1.5, px: 2 };
const TD = { fontSize: '0.85rem', color: 'text.primary', py: 1.25, px: 2 };

function StatusChip({ status }) {
  const s = STATUS_META[status] || STATUS_META.open;
  return (
    <Chip label={s.label} size="small"
      sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: '0.68rem', height: 20 }} />
  );
}

function StatCard({ icon, label, value, color, bg }) {
  return (
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, p: 2, borderRadius: '14px', bgcolor: bg, border: '1px solid', borderColor: `${color}20` }}>
      <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {React.cloneElement(icon, { sx: { fontSize: 18, color } })}
      </Box>
      <Box>
        <Typography sx={{ fontSize: '1.3rem', fontWeight: 800, color: 'text.primary', lineHeight: 1 }}>{value}</Typography>
        <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', mt: 0.25 }}>{label}</Typography>
      </Box>
    </Box>
  );
}

function PeriodCard({ p, selected, onSelect, onEdit, onDelete, accentColor, isReadOnly }) {
  const locked = isPeriodLocked(p);
  return (
    <Box onClick={() => onSelect(p)}
      sx={{
        mx: 1.5, mb: 1, borderRadius: '12px', cursor: 'pointer', overflow: 'hidden',
        border: '1px solid', borderColor: selected ? `${accentColor}50` : 'divider',
        bgcolor: selected ? `${accentColor}08` : 'background.paper',
        boxShadow: selected ? `0 2px 12px ${accentColor}20` : 'none',
        transition: 'all 0.18s',
        '&:hover': { borderColor: `${accentColor}40`, bgcolor: `${accentColor}05`, boxShadow: `0 2px 8px ${accentColor}15` },
      }}>
      {selected && <Box sx={{ height: 3, background: `linear-gradient(90deg, ${accentColor}, ${accentColor}99)` }} />}
      <Box sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: selected ? 700 : 500, fontSize: '0.82rem', color: selected ? accentColor : 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
              {p.period_name}
            </Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', mt: 0.5 }}>
              {new Date(p.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
              {new Date(p.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
            <StatusChip status={p.status} />
            {locked && (
              <Tooltip title="Payroll processed — period is locked">
                <LockIcon sx={{ fontSize: 11, color: '#94a3b8', ml: 0.25 }} />
              </Tooltip>
            )}
            {!isReadOnly && !locked && (
              <>
                <IconButton size="small" onClick={e => { e.stopPropagation(); onEdit(p); }}
                  sx={{ p: 0.3, color: 'text.disabled', '&:hover': { color: accentColor, bgcolor: `${accentColor}10` } }}>
                  <EditIcon sx={{ fontSize: 12 }} />
                </IconButton>
                <IconButton size="small" onClick={e => { e.stopPropagation(); onDelete(p); }}
                  sx={{ p: 0.3, color: 'text.disabled', '&:hover': { color: '#ef4444', bgcolor: '#ef444410' } }}>
                  <DeleteOutlineIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

const EMPTY_FORM = { period_name: '', start_date: '', end_date: '', status: 'open', period_type: 'local' };
const now = new Date();

export default function Periods() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isReadOnly = user?.role === 'accounting_manager';

  const [allPeriods, setAllPeriods]       = useState([]);
  const [periodSearch, setPeriodSearch]   = useState('');
  const [loading, setLoading]             = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [summaries, setSummaries]         = useState([]);
  const [tab, setTab]                     = useState(0);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm]           = useState(EMPTY_FORM);
  const [createSaving, setCreateSaving]       = useState(false);

  const [showQuickModal, setShowQuickModal] = useState(false);
  const [quickType, setQuickType]           = useState('local');
  const [quickYear, setQuickYear]           = useState(now.getFullYear());
  const [quickMonth, setQuickMonth]         = useState(now.getMonth() + 1);
  const [quickSaving, setQuickSaving]       = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm]           = useState(EMPTY_FORM);
  const [editingId, setEditingId]         = useState(null);
  const [editSaving, setEditSaving]       = useState(false);

  const [deleteTarget, setDeleteTarget]   = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => { fetchPeriods(); }, []);

  const fetchPeriods = async () => {
    try {
      setLoading(true);
      const res = await timesheetAPI.getPeriods(100, 0);
      if (res.success) setAllPeriods(res.data);
    } catch { toast.error('Failed to load periods'); }
    finally { setLoading(false); }
  };

  const searchLower    = periodSearch.toLowerCase();
  const localPeriods   = allPeriods.filter(p => (!p.period_type || p.period_type === 'local') && (!searchLower || p.period_name.toLowerCase().includes(searchLower)));
  const foreignPeriods = allPeriods.filter(p => p.period_type === 'foreign' && (!searchLower || p.period_name.toLowerCase().includes(searchLower)));
  const openCount      = allPeriods.filter(p => p.status === 'open').length;

  const fetchSummaries = async (periodId) => {
    try {
      const res = await timesheetAPI.getPeriodSummaries(periodId);
      if (res.success) setSummaries(res.data);
    } catch { toast.error('Failed to load summaries'); }
  };

  const handleSelectPeriod = (p) => { setSelectedPeriod(p); setSummaries([]); fetchSummaries(p.id); };

  const openCreate = (type) => { setCreateForm({ ...EMPTY_FORM, period_type: type }); setShowCreateModal(true); };
  const openQuick  = (type) => { setQuickType(type); setShowQuickModal(true); };

  const handleCreate = async () => {
    if (!createForm.start_date || !createForm.end_date) return toast.error('Start and end dates required');
    if (createForm.start_date > createForm.end_date) return toast.error('Start date must be before end date');
    try {
      setCreateSaving(true);
      const name = createForm.period_name.trim() || (() => {
        const s = new Date(createForm.start_date), e = new Date(createForm.end_date);
        return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      })();
      const res = await timesheetAPI.createPeriod({ period_name: name, start_date: createForm.start_date, end_date: createForm.end_date, period_type: createForm.period_type });
      if (res.success) { toast.success('Period created'); setShowCreateModal(false); setCreateForm(EMPTY_FORM); setAllPeriods(prev => [res.data, ...prev]); }
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to create period'); }
    finally { setCreateSaving(false); }
  };

  const handleQuickGenerate = async () => {
    try {
      setQuickSaving(true);
      if (quickType === 'local') {
        const res = await timesheetAPI.createMonthlyPeriods(quickYear, quickMonth);
        if (res.success) { toast.success(`Created ${res.data.length} local periods`); setAllPeriods(prev => [...res.data, ...prev]); }
      } else {
        const res = await timesheetAPI.createForeignMonthlyPeriod(quickYear, quickMonth);
        if (res.success) { toast.success('International period created'); setAllPeriods(prev => [res.data, ...prev]); }
      }
      setShowQuickModal(false);
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to generate periods'); }
    finally { setQuickSaving(false); }
  };

  const openEdit = (p) => {
    setEditingId(p.id);
    setEditForm({ period_name: p.period_name, start_date: String(p.start_date).substring(0, 10), end_date: String(p.end_date).substring(0, 10), status: p.status, period_type: p.period_type || 'local' });
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!editForm.start_date || !editForm.end_date) return toast.error('Start and end dates required');
    try {
      setEditSaving(true);
      const res = await timesheetAPI.updatePeriod(editingId, editForm);
      if (res.success) {
        toast.success('Period updated');
        setShowEditModal(false);
        setAllPeriods(prev => prev.map(p => p.id === editingId ? res.data : p));
        if (selectedPeriod?.id === editingId) setSelectedPeriod(res.data);
      }
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to update period'); }
    finally { setEditSaving(false); }
  };

  const handleDelete = async () => {
    try {
      setDeleteLoading(true);
      await timesheetAPI.deletePeriod(deleteTarget.id);
      toast.success('Period deleted');
      if (selectedPeriod?.id === deleteTarget.id) { setSelectedPeriod(null); setSummaries([]); }
      setAllPeriods(prev => prev.filter(p => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to delete period'); }
    finally { setDeleteLoading(false); }
  };

  const handleProcess = () => {
    navigate('/wrike');
  };

  const durDays = (s, e) => s && e && s <= e ? Math.ceil((new Date(e) - new Date(s)) / 86400000) + 1 : null;
  const createDur = durDays(createForm.start_date, createForm.end_date);
  const editDur   = durDays(editForm.start_date, editForm.end_date);

  const activePeriods = tab === 0 ? localPeriods : foreignPeriods;
  const accentColor   = tab === 0 ? '#6366f1' : '#0ea5e9';

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CalendarMonthIcon sx={{ color: 'white', fontSize: 18 }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Pay Periods</Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>Manage local and international payroll periods</Typography>
          </Box>
        </Box>
      </Box>

      {/* Stat cards */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
        <StatCard icon={<CalendarMonthIcon />} label="Total Periods"    value={allPeriods.length}   color="#6366f1" bg="rgba(99,102,241,0.04)"  />
        <StatCard icon={<HomeIcon />}          label="Local"            value={localPeriods.length}  color="#6366f1" bg="rgba(99,102,241,0.04)"  />
        <StatCard icon={<PublicIcon />}        label="International"    value={foreignPeriods.length} color="#0ea5e9" bg="rgba(14,165,233,0.04)" />
        <StatCard icon={<TrendingUpIcon />}    label="Open Periods"     value={openCount}            color="#10b981" bg="rgba(16,185,129,0.04)"  />
      </Box>

      <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>
        {/* Period list panel */}
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Tabs */}
            <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 1 }}>
              <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
                minHeight: 44,
                '& .MuiTab-root': { minHeight: 44, textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', py: 0 },
                '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' },
              }}>
                <Tab label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <HomeIcon sx={{ fontSize: 15 }} />
                    Local
                    <Chip label={localPeriods.length} size="small" sx={{ height: 17, fontSize: '0.62rem', fontWeight: 700, bgcolor: tab === 0 ? '#6366f120' : 'action.hover', color: tab === 0 ? '#6366f1' : 'text.secondary', px: 0.25 }} />
                  </Box>
                } />
                <Tab label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <PublicIcon sx={{ fontSize: 15 }} />
                    International
                    <Chip label={foreignPeriods.length} size="small" sx={{ height: 17, fontSize: '0.62rem', fontWeight: 700, bgcolor: tab === 1 ? '#0ea5e920' : 'action.hover', color: tab === 1 ? '#0ea5e9' : 'text.secondary', px: 0.25 }} />
                  </Box>
                } />
              </Tabs>
            </Box>

            {/* Search */}
            <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <TextField fullWidth size="small" placeholder="Search periods…" value={periodSearch} onChange={e => setPeriodSearch(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '0.82rem' } }}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment> } }} />
            </Box>

            {/* Action bar — hidden for read-only roles */}
            {!isReadOnly && (
              <Box sx={{ px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', gap: 0.75 }}>
                <Button size="small" startIcon={<AutoAwesomeIcon sx={{ fontSize: '13px !important' }} />}
                  onClick={() => openQuick(tab === 0 ? 'local' : 'foreign')}
                  sx={{ flex: 1, textTransform: 'none', fontSize: '0.75rem', fontWeight: 600, color: accentColor, borderRadius: '8px', py: 0.5, border: '1px solid', borderColor: `${accentColor}30`, bgcolor: `${accentColor}05`, '&:hover': { bgcolor: `${accentColor}10` } }}>
                  Quick Month
                </Button>
                <Button size="small" startIcon={<AddIcon sx={{ fontSize: '14px !important' }} />}
                  onClick={() => openCreate(tab === 0 ? 'local' : 'foreign')}
                  sx={{ flex: 1, textTransform: 'none', fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', borderRadius: '8px', py: 0.5, border: '1px solid', borderColor: 'divider', '&:hover': { borderColor: accentColor, color: accentColor } }}>
                  Custom
                </Button>
              </Box>
            )}

            {/* List */}
            <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
              {loading ? (
                <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress size={24} sx={{ color: accentColor }} />
                </Box>
              ) : activePeriods.length === 0 ? (
                <Box sx={{ py: 8, textAlign: 'center', color: 'text.disabled' }}>
                  <CalendarMonthIcon sx={{ fontSize: 36, opacity: 0.2, mb: 1 }} />
                  <Typography sx={{ fontSize: '0.82rem' }}>No {tab === 0 ? 'local' : 'international'} periods yet</Typography>
                  <Typography sx={{ fontSize: '0.72rem', mt: 0.5 }}>Use Quick Month to generate</Typography>
                </Box>
              ) : activePeriods.map(p => (
                <PeriodCard key={p.id} p={p} selected={selectedPeriod?.id === p.id}
                  onSelect={handleSelectPeriod} onEdit={openEdit} onDelete={setDeleteTarget}
                  accentColor={accentColor} isReadOnly={isReadOnly} />
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Detail panel */}
        <Grid item xs={12} md={8}>
          <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {!selectedPeriod ? (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, color: 'text.disabled' }}>
                <Box sx={{ width: 64, height: 64, borderRadius: '20px', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                  <CalendarMonthIcon sx={{ fontSize: 32, opacity: 0.3 }} />
                </Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', mb: 0.5 }}>No Period Selected</Typography>
                <Typography sx={{ fontSize: '0.8rem' }}>Click a period on the left to view details</Typography>
              </Box>
            ) : (
              <>
                {/* Detail header */}
                <Box sx={{
                  px: 3, py: 2.5,
                  background: selectedPeriod.period_type === 'foreign'
                    ? 'linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(56,189,248,0.04) 100%)'
                    : 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(129,140,248,0.04) 100%)',
                  borderBottom: '1px solid', borderColor: 'divider',
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: 'text.primary' }}>{selectedPeriod.period_name}</Typography>
                        <Chip
                          label={selectedPeriod.period_type === 'foreign' ? 'International' : 'Local'} size="small"
                          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700,
                            bgcolor: selectedPeriod.period_type === 'foreign' ? '#0ea5e918' : '#6366f118',
                            color: selectedPeriod.period_type === 'foreign' ? '#0ea5e9' : '#6366f1' }} />
                        <StatusChip status={selectedPeriod.status} />
                      </Box>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        {new Date(selectedPeriod.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })} – {new Date(selectedPeriod.end_date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                      </Typography>
                    </Box>
                    {!isReadOnly && (
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        {isPeriodLocked(selectedPeriod) ? (
                          <>
                            <Chip icon={<LockIcon sx={{ fontSize: '12px !important' }} />} label="Locked" size="small"
                              sx={{ bgcolor: '#94a3b815', color: '#94a3b8', fontWeight: 700, fontSize: '0.68rem' }} />
                            <Button size="small" variant="outlined" startIcon={<ReceiptLongIcon sx={{ fontSize: '14px !important' }} />}
                              onClick={() => navigate('/payslips')}
                              sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.78rem', borderColor: '#6366f1', color: '#6366f1', '&:hover': { bgcolor: '#6366f110' } }}>
                              View Payslips
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="small" variant="outlined" startIcon={<EditIcon sx={{ fontSize: '14px !important' }} />} onClick={() => openEdit(selectedPeriod)}
                              sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.78rem', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
                              Edit
                            </Button>
                            <Button size="small" variant="outlined" startIcon={<RefreshIcon sx={{ fontSize: '14px !important' }} />} onClick={handleProcess}
                              sx={{ borderRadius: '8px', textTransform: 'none', fontSize: '0.78rem', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: '#10b981', color: '#10b981' } }}>
                              Process
                            </Button>
                          </>
                        )}
                      </Box>
                    )}
                  </Box>

                  {/* Mini stats */}
                  <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
                    {[
                      { icon: <PeopleIcon />, label: 'Employees',    value: summaries.length,                                                                                      color: '#6366f1' },
                      { icon: <AccessTimeIcon />, label: 'Total Hours', value: formatHM(summaries.reduce((s, r) => s + (r.total_minutes != null ? parseInt(r.total_minutes,10) : Math.round((parseFloat(r.total_hours)||0)*60)), 0)), color: '#f59e0b' },
                      { icon: <ReceiptLongIcon />, label: 'Payslips',  value: summaries.filter(s => s.approval_status === 'approved').length,                                    color: '#10b981' },
                    ].map(stat => (
                      <Box key={stat.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, bgcolor: 'background.paper', px: 1.5, py: 1, borderRadius: '10px', border: '1px solid', borderColor: 'divider' }}>
                        {React.cloneElement(stat.icon, { sx: { fontSize: 15, color: stat.color } })}
                        <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: 'text.primary', lineHeight: 1 }}>{stat.value}</Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{stat.label}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>

                {/* Summaries table */}
                <Box sx={{ flex: 1, overflowY: 'auto' }}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: 'action.hover' }}>
                        <TableRow>
                          {['Employee', 'Hours', 'Gross', 'Status', 'Payslip'].map(h => (
                            <TableCell key={h} sx={TH}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {summaries.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} sx={{ textAlign: 'center', py: 8, color: 'text.disabled', fontSize: '0.875rem' }}>
                              {isPeriodLocked(selectedPeriod)
                                ? 'This period was processed but has no summaries.'
                                : <>No summaries yet — click <strong>Process</strong> to generate timesheets.</>
                              }
                            </TableCell>
                          </TableRow>
                        ) : summaries.map(s => {
                          const chip = PAYSLIP_CHIP[s.approval_status] || PAYSLIP_CHIP.pending;
                          return (
                            <TableRow key={s.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                              <TableCell sx={TD}>
                                <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.employee_name}</Typography>
                                <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>{s.employee_id}</Typography>
                              </TableCell>
                              <TableCell sx={TD}>{formatHoursAsHM(s.total_hours || 0)}</TableCell>
                              <TableCell sx={TD}>{s.currency || ''} {s.gross_amount?.toLocaleString()}</TableCell>
                              <TableCell sx={TD}>
                                <Chip label={s.approval_status || 'pending'} size="small" sx={{ textTransform: 'capitalize', fontSize: '0.68rem', fontWeight: 600,
                                  bgcolor: s.approval_status === 'approved' ? '#10b98115' : s.approval_status === 'rejected' ? '#ef444415' : '#94a3b815',
                                  color:   s.approval_status === 'approved' ? '#10b981'   : s.approval_status === 'rejected' ? '#ef4444'   : '#94a3b8' }} />
                              </TableCell>
                              <TableCell sx={TD}>
                                <Chip label={chip.label} size="small" sx={{ bgcolor: chip.bg, color: chip.color, fontWeight: 700, fontSize: '0.68rem' }} />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* ── Create Period Dialog ──────────────────────────────────────────── */}
      <Dialog open={showCreateModal} onClose={() => setShowCreateModal(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          New {createForm.period_type === 'foreign' ? 'International' : 'Local'} Period
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <TextField fullWidth label="Period Name" placeholder={createForm.period_type === 'foreign' ? 'e.g. March 2026 (International)' : 'e.g. Mar 1–15, 2026'}
            value={createForm.period_name} onChange={e => setCreateForm(f => ({ ...f, period_name: e.target.value }))}
            helperText="Optional — auto-generated from dates if blank" size="small"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
          <Grid container spacing={1.5}>
            <Grid item xs={6}>
              <TextField fullWidth label="Start Date *" type="date" value={createForm.start_date}
                onChange={e => setCreateForm(f => ({ ...f, start_date: e.target.value }))}
                size="small" slotProps={{ inputLabel: { shrink: true } }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="End Date *" type="date" value={createForm.end_date}
                onChange={e => setCreateForm(f => ({ ...f, end_date: e.target.value }))}
                size="small" slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: createForm.start_date } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
            </Grid>
          </Grid>
          {createDur && (
            <Box sx={{ bgcolor: `${createForm.period_type === 'foreign' ? '#0ea5e9' : '#6366f1'}10`, px: 2, py: 1.25, borderRadius: '10px', border: '1px solid', borderColor: `${createForm.period_type === 'foreign' ? '#0ea5e9' : '#6366f1'}20` }}>
              <Typography sx={{ fontSize: '0.875rem', color: createForm.period_type === 'foreign' ? '#0ea5e9' : '#6366f1', fontWeight: 700 }}>
                {createDur} day{createDur !== 1 ? 's' : ''}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setShowCreateModal(false)} sx={{ borderRadius: '10px', textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained" disabled={createSaving}
            sx={{ borderRadius: '10px', textTransform: 'none', minWidth: 130,
              background: createForm.period_type === 'foreign' ? 'linear-gradient(135deg, #0ea5e9, #38bdf8)' : 'linear-gradient(135deg, #6366f1, #818cf8)' }}>
            {createSaving ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Create Period'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Quick Generate Dialog ─────────────────────────────────────────── */}
      <Dialog open={showQuickModal} onClose={() => setShowQuickModal(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Generate {quickType === 'foreign' ? 'International' : 'Local'} Periods</DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 2 }}>
            {quickType === 'foreign' ? 'Creates one full-month international payroll period.' : 'Creates two 15-day local payroll periods (1st–15th and 16th–end).'}
          </Typography>
          <Grid container spacing={1.5}>
            <Grid item xs={7}>
              <FormControl fullWidth size="small">
                <InputLabel shrink>Month</InputLabel>
                <Select label="Month" value={quickMonth} onChange={e => setQuickMonth(e.target.value)} notched sx={{ borderRadius: '10px' }}>
                  {MONTHS.map((m, i) => <MenuItem key={i + 1} value={i + 1}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={5}>
              <TextField fullWidth label="Year" type="number" value={quickYear}
                onChange={e => setQuickYear(parseInt(e.target.value))}
                size="small" slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: 2020, max: 2099 } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setShowQuickModal(false)} sx={{ borderRadius: '10px', textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleQuickGenerate} variant="contained" disabled={quickSaving}
            sx={{ borderRadius: '10px', textTransform: 'none', minWidth: 120,
              background: quickType === 'foreign' ? 'linear-gradient(135deg, #0ea5e9, #38bdf8)' : 'linear-gradient(135deg, #6366f1, #818cf8)' }}>
            {quickSaving ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={showEditModal} onClose={() => setShowEditModal(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Edit Pay Period</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <TextField fullWidth label="Period Name" value={editForm.period_name}
            onChange={e => setEditForm(f => ({ ...f, period_name: e.target.value }))}
            size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
          <Grid container spacing={1.5}>
            <Grid item xs={6}>
              <TextField fullWidth label="Start Date" type="date" value={editForm.start_date}
                onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))}
                size="small" slotProps={{ inputLabel: { shrink: true } }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="End Date" type="date" value={editForm.end_date}
                onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))}
                size="small" slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: editForm.start_date } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
            </Grid>
          </Grid>
          <Grid container spacing={1.5}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} sx={{ borderRadius: '10px' }}>
                  {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select label="Type" value={editForm.period_type} onChange={e => setEditForm(f => ({ ...f, period_type: e.target.value }))} sx={{ borderRadius: '10px' }}>
                  <MenuItem value="local">Local</MenuItem>
                  <MenuItem value="foreign">International</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          {editDur && (
            <Box sx={{ bgcolor: '#6366f110', px: 2, py: 1.25, borderRadius: '10px', border: '1px solid #6366f120' }}>
              <Typography sx={{ fontSize: '0.875rem', color: '#6366f1', fontWeight: 700 }}>{editDur} day{editDur !== 1 ? 's' : ''}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setShowEditModal(false)} sx={{ borderRadius: '10px', textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleEdit} variant="contained" disabled={editSaving}
            sx={{ borderRadius: '10px', textTransform: 'none', minWidth: 120, background: 'linear-gradient(135deg, #6366f1, #818cf8)' }}>
            {editSaving ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirm ────────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Delete Period?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
            Are you sure you want to delete <strong>{deleteTarget?.period_name}</strong>?
          </Typography>
          <Typography sx={{ color: '#ef4444', fontSize: '0.8rem', mt: 1 }}>
            This permanently deletes the period and all associated timesheet summaries. Payslips are not affected.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ borderRadius: '10px', textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleDelete} variant="contained" disabled={deleteLoading}
            sx={{ borderRadius: '10px', textTransform: 'none', minWidth: 100, bgcolor: '#ef4444', '&:hover': { bgcolor: '#dc2626' } }}>
            {deleteLoading ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
