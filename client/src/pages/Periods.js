import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, Chip, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  CircularProgress, IconButton, Tooltip, Divider, FormControl, InputLabel, Select, MenuItem
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
import { timesheetAPI } from '../api';

const STATUS_COLORS = { open: '#6366f1', processing: '#f59e0b', approved: '#10b981', paid: '#10b981' };
const STATUS_OPTIONS = ['open', 'processing', 'approved', 'paid'];
const PAYSLIP_CHIP = {
  approved: { label: 'Generated', color: '#10b981', bg: '#10b98118' },
  pending:  { label: 'Not Generated', color: '#f59e0b', bg: '#f59e0b18' },
  rejected: { label: 'Failed', color: '#ef4444', bg: '#ef444418' },
};
const TH = { fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', py: 1.5, px: 2 };
const TD = { fontSize: '0.875rem', color: 'text.primary', py: 1.25, px: 2 };

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function StatusChip({ status }) {
  const color = STATUS_COLORS[status] || '#6366f1';
  return <Chip label={status.replace('_', ' ')} size="small" sx={{ bgcolor: `${color}18`, color, fontWeight: 600, fontSize: '0.72rem', textTransform: 'capitalize' }} />;
}

function MiniStat({ icon, label, value, color }) {
  return (
    <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 0, bgcolor: 'action.hover' }}>
      {React.cloneElement(icon, { sx: { fontSize: 22, color, mb: 0.5 } })}
      <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: 'text.primary', lineHeight: 1 }}>{value}</Typography>
      <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', mt: 0.25 }}>{label}</Typography>
    </Box>
  );
}

function PeriodListItem({ p, selected, onSelect, onEdit, onDelete }) {
  return (
    <Box onClick={() => onSelect(p)}
      sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderBottomColor: 'divider', cursor: 'pointer',
        bgcolor: selected ? 'rgba(99,102,241,0.06)' : 'transparent', transition: 'background 0.15s',
        '&:hover': { bgcolor: selected ? 'rgba(99,102,241,0.08)' : 'action.hover' } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
          <Typography sx={{ fontWeight: selected ? 700 : 500, fontSize: '0.8rem',
            color: selected ? '#6366f1' : 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.period_name}
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', mt: 0.25 }}>
            {new Date(p.start_date).toLocaleDateString()} – {new Date(p.end_date).toLocaleDateString()}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
          <StatusChip status={p.status} />
          <Tooltip title="Edit">
            <IconButton size="small" onClick={e => { e.stopPropagation(); onEdit(p, e); }}
              sx={{ color: 'text.disabled', '&:hover': { color: '#6366f1', bgcolor: '#6366f108' }, p: 0.4 }}>
              <EditIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" onClick={e => { e.stopPropagation(); onDelete(p); }}
              sx={{ color: 'text.disabled', '&:hover': { color: '#ef4444', bgcolor: '#ef444408' }, p: 0.4 }}>
              <DeleteOutlineIcon sx={{ fontSize: 13 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}

const EMPTY_FORM = { period_name: '', start_date: '', end_date: '', status: 'open', period_type: 'local' };
const now = new Date();

export default function Periods() {
  const [allPeriods, setAllPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [summaries, setSummaries] = useState([]);

  // Create dialog
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [createSaving, setCreateSaving] = useState(false);

  // Quick-generate dialog (shared for local and foreign)
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [quickType, setQuickType] = useState('local');
  const [quickYear, setQuickYear] = useState(now.getFullYear());
  const [quickMonth, setQuickMonth] = useState(now.getMonth() + 1);
  const [quickSaving, setQuickSaving] = useState(false);

  // Edit dialog
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState(null);
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

  const localPeriods   = allPeriods.filter(p => !p.period_type || p.period_type === 'local');
  const foreignPeriods = allPeriods.filter(p => p.period_type === 'foreign');

  const fetchSummaries = async (periodId) => {
    try {
      const res = await timesheetAPI.getPeriodSummaries(periodId);
      if (res.success) setSummaries(res.data);
    } catch { toast.error('Failed to load summaries'); }
  };

  const handleSelectPeriod = (p) => { setSelectedPeriod(p); fetchSummaries(p.id); };

  // ── Create ──────────────────────────────────────────────────────────────────
  const openCreate = (type) => {
    setCreateForm({ ...EMPTY_FORM, period_type: type });
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!createForm.start_date || !createForm.end_date) return toast.error('Start and end dates are required');
    if (createForm.start_date > createForm.end_date) return toast.error('Start date must be before end date');
    try {
      setCreateSaving(true);
      const name = createForm.period_name.trim() || (() => {
        const s = new Date(createForm.start_date), e = new Date(createForm.end_date);
        return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      })();
      const res = await timesheetAPI.createPeriod({ period_name: name, start_date: createForm.start_date, end_date: createForm.end_date, period_type: createForm.period_type });
      if (res.success) {
        toast.success('Period created');
        setShowCreateModal(false);
        setCreateForm(EMPTY_FORM);
        fetchPeriods();
      }
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to create period'); }
    finally { setCreateSaving(false); }
  };

  // ── Quick Generate ───────────────────────────────────────────────────────────
  const openQuick = (type) => { setQuickType(type); setShowQuickModal(true); };

  const handleQuickGenerate = async () => {
    try {
      setQuickSaving(true);
      if (quickType === 'local') {
        const res = await timesheetAPI.createMonthlyPeriods(quickYear, quickMonth);
        if (res.success) toast.success(`Created ${res.data.length} local periods`);
      } else {
        const res = await timesheetAPI.createForeignMonthlyPeriod(quickYear, quickMonth);
        if (res.success) toast.success('International period created');
      }
      setShowQuickModal(false);
      fetchPeriods();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to generate periods'); }
    finally { setQuickSaving(false); }
  };

  // ── Edit ─────────────────────────────────────────────────────────────────────
  const openEdit = (p, e) => {
    if (e) e.stopPropagation();
    setEditingId(p.id);
    setEditForm({ period_name: p.period_name, start_date: String(p.start_date).substring(0, 10), end_date: String(p.end_date).substring(0, 10), status: p.status, period_type: p.period_type || 'local' });
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!editForm.start_date || !editForm.end_date) return toast.error('Start and end dates are required');
    if (editForm.start_date > editForm.end_date) return toast.error('Start date must be before end date');
    try {
      setEditSaving(true);
      const res = await timesheetAPI.updatePeriod(editingId, editForm);
      if (res.success) {
        toast.success('Period updated');
        setShowEditModal(false);
        fetchPeriods();
        if (selectedPeriod?.id === editingId) setSelectedPeriod(res.data);
      }
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to update period'); }
    finally { setEditSaving(false); }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    try {
      setDeleteLoading(true);
      await timesheetAPI.deletePeriod(deleteTarget.id);
      toast.success('Period deleted');
      if (selectedPeriod?.id === deleteTarget.id) { setSelectedPeriod(null); setSummaries([]); }
      setDeleteTarget(null);
      fetchPeriods();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to delete period'); }
    finally { setDeleteLoading(false); }
  };

  // ── Process ──────────────────────────────────────────────────────────────────
  const handleProcess = async (periodId) => {
    try {
      toast.loading('Processing…');
      const res = await timesheetAPI.process(periodId);
      toast.dismiss();
      if (res.success) {
        toast.success(`Processed ${res.data.processed} timesheets`);
        fetchPeriods();
        if (selectedPeriod?.id === periodId) fetchSummaries(periodId);
      }
    } catch { toast.dismiss(); toast.error('Failed to process period'); }
  };

  const createDuration = createForm.start_date && createForm.end_date && createForm.start_date <= createForm.end_date
    ? Math.ceil((new Date(createForm.end_date) - new Date(createForm.start_date)) / 86400000) + 1 : null;
  const editDuration = editForm.start_date && editForm.end_date && editForm.start_date <= editForm.end_date
    ? Math.ceil((new Date(editForm.end_date) - new Date(editForm.start_date)) / 86400000) + 1 : null;

  const PeriodPanel = ({ title, icon, color, periods: list, accentBg, periodType }) => (
    <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden', height: '100%' }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderBottomColor: 'divider', bgcolor: accentBg, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          {React.cloneElement(icon, { sx: { fontSize: 16, color } })}
          <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: 'text.primary' }}>{title}</Typography>
          <Chip label={list.length} size="small" sx={{ height: 18, fontSize: '0.68rem', fontWeight: 700, bgcolor: `${color}18`, color }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Quick generate for a month">
            <Button size="small" startIcon={<AutoAwesomeIcon sx={{ fontSize: '14px !important' }} />}
              onClick={() => openQuick(periodType)}
              sx={{ textTransform: 'none', fontSize: '0.72rem', color, borderRadius: '6px', py: 0.3, px: 1, minWidth: 0,
                '&:hover': { bgcolor: `${color}12` } }}>
              Month
            </Button>
          </Tooltip>
          <Tooltip title="Create custom period">
            <IconButton size="small" onClick={() => openCreate(periodType)}
              sx={{ color, bgcolor: `${color}12`, '&:hover': { bgcolor: `${color}20` }, p: 0.5, borderRadius: '6px' }}>
              <AddIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} sx={{ color }} /></Box>
        ) : list.length === 0 ? (
          <Box sx={{ py: 5, textAlign: 'center', color: 'text.disabled' }}>
            <CalendarMonthIcon sx={{ fontSize: 32, opacity: 0.25, mb: 0.75 }} />
            <Typography sx={{ fontSize: '0.8rem' }}>No periods yet</Typography>
          </Box>
        ) : list.map(p => (
          <PeriodListItem key={p.id} p={p} selected={selectedPeriod?.id === p.id}
            onSelect={handleSelectPeriod} onEdit={openEdit} onDelete={setDeleteTarget} />
        ))}
      </Box>
    </Paper>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>Pay Periods</Typography>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 0.25 }}>
          Manage local (15-day) and international (monthly) payroll periods
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {/* Local periods */}
        <Grid item xs={12} md={3}>
          <PeriodPanel
            title="Local Payroll"
            icon={<HomeIcon />}
            color="#6366f1"
            accentBg="rgba(99,102,241,0.03)"
            periods={localPeriods}
            periodType="local"
          />
        </Grid>

        {/* Foreign periods */}
        <Grid item xs={12} md={3}>
          <PeriodPanel
            title="International"
            icon={<PublicIcon />}
            color="#0ea5e9"
            accentBg="rgba(14,165,233,0.03)"
            periods={foreignPeriods}
            periodType="foreign"
          />
        </Grid>

        {/* Period detail */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden', height: '100%' }}>
            {!selectedPeriod ? (
              <Box sx={{ py: 12, textAlign: 'center', color: 'text.disabled' }}>
                <CalendarMonthIcon sx={{ fontSize: 48, opacity: 0.18, mb: 1.5 }} />
                <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Select a Period</Typography>
                <Typography sx={{ fontSize: '0.8rem' }}>Click any period to view its details</Typography>
              </Box>
            ) : (
              <>
                {/* Detail header */}
                <Box sx={{ px: 2, py: 2, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'text.primary' }}>{selectedPeriod.period_name}</Typography>
                      <Chip
                        label={selectedPeriod.period_type === 'foreign' ? 'International' : 'Local'}
                        size="small"
                        sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700,
                          bgcolor: selectedPeriod.period_type === 'foreign' ? '#0ea5e918' : '#6366f118',
                          color: selectedPeriod.period_type === 'foreign' ? '#0ea5e9' : '#6366f1' }} />
                    </Box>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>
                      {new Date(selectedPeriod.start_date).toLocaleDateString()} – {new Date(selectedPeriod.end_date).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={() => openEdit(selectedPeriod)}
                      sx={{ borderRadius: '6px', textTransform: 'none', fontSize: '0.8rem', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
                      Edit
                    </Button>
                    <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={() => handleProcess(selectedPeriod.id)}
                      sx={{ borderRadius: '6px', textTransform: 'none', fontSize: '0.8rem', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
                      Process
                    </Button>
                  </Box>
                </Box>

                {/* Mini stats */}
                <Grid container spacing={1.5} sx={{ p: 2 }}>
                  <Grid item xs={4}><MiniStat icon={<PeopleIcon />} label="Employees" value={summaries.length} color="#6366f1" /></Grid>
                  <Grid item xs={4}><MiniStat icon={<AccessTimeIcon />} label="Total Hours" value={`${summaries.reduce((sum, s) => sum + (parseFloat(s.total_hours) || 0), 0)}h`} color="#f59e0b" /></Grid>
                  <Grid item xs={4}><MiniStat icon={<ReceiptLongIcon />} label="Payslips" value={summaries.filter(s => s.approval_status === 'approved').length} color="#10b981" /></Grid>
                </Grid>

                <Divider />

                {/* Summaries table */}
                <TableContainer>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        {['Employee', 'Hours', 'Gross', 'Payslip'].map(h => <TableCell key={h} sx={TH}>{h}</TableCell>)}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {summaries.length === 0 ? (
                        <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 5, color: 'text.disabled', fontSize: '0.875rem' }}>
                          No summaries yet. Process the period to generate timesheets.
                        </TableCell></TableRow>
                      ) : summaries.map(s => (
                        <TableRow key={s.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                          <TableCell sx={TD}>
                            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.employee_name}</Typography>
                            <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>{s.employee_id}</Typography>
                          </TableCell>
                          <TableCell sx={TD}>{s.total_hours}h</TableCell>
                          <TableCell sx={TD}>{s.currency || ''} {s.gross_amount?.toLocaleString()}</TableCell>
                          <TableCell sx={TD}>{(() => {
                            const c = PAYSLIP_CHIP[s.approval_status] || PAYSLIP_CHIP.pending;
                            return <Chip label={c.label} size="small" sx={{ bgcolor: c.bg, color: c.color, fontWeight: 600, fontSize: '0.72rem' }} />;
                          })()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* ── Create Period Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showCreateModal} onClose={() => setShowCreateModal(false)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { borderRadius: '4px' } } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          New {createForm.period_type === 'foreign' ? 'International' : 'Local'} Period
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField fullWidth label="Period Name" placeholder={createForm.period_type === 'foreign' ? 'e.g. March 2026 (International)' : 'e.g. Mar 1–15, 2026'}
              value={createForm.period_name} onChange={e => setCreateForm(f => ({ ...f, period_name: e.target.value }))}
              helperText="Optional — auto-generated from dates if blank" size="small"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
            <Grid container spacing={1.5}>
              <Grid item xs={6}>
                <TextField fullWidth label="Start Date *" type="date" value={createForm.start_date}
                  onChange={e => setCreateForm(f => ({ ...f, start_date: e.target.value }))}
                  size="small" slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="End Date *" type="date" value={createForm.end_date}
                  onChange={e => setCreateForm(f => ({ ...f, end_date: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: createForm.start_date } }}
                  size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
              </Grid>
            </Grid>
            {createDuration && (
              <Box sx={{ bgcolor: 'action.hover', px: 2, py: 1.25, borderRadius: '8px' }}>
                <Typography sx={{ fontSize: '0.875rem', color: createForm.period_type === 'foreign' ? '#0ea5e9' : '#6366f1', fontWeight: 600 }}>
                  Duration: {createDuration} day{createDuration !== 1 ? 's' : ''}
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowCreateModal(false)} sx={{ borderRadius: '10px', textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained" disabled={createSaving}
            sx={{ borderRadius: '10px', textTransform: 'none', minWidth: 130,
              background: createForm.period_type === 'foreign'
                ? 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)'
                : 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' }}>
            {createSaving ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Create Period'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Quick Generate Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showQuickModal} onClose={() => setShowQuickModal(false)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { borderRadius: '4px' } } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          Generate {quickType === 'foreign' ? 'International' : 'Local'} Periods
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 2 }}>
            {quickType === 'foreign'
              ? 'Creates one full-month international payroll period.'
              : 'Creates two 15-day local payroll periods (1st–15th and 16th–end).'}
          </Typography>
          <Grid container spacing={1.5}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel shrink>Month</InputLabel>
                <Select label="Month" value={quickMonth} onChange={e => setQuickMonth(e.target.value)}
                  notched sx={{ borderRadius: '10px' }}>
                  {MONTHS.map((m, i) => <MenuItem key={i + 1} value={i + 1}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField fullWidth label="Year" type="number" value={quickYear}
                onChange={e => setQuickYear(parseInt(e.target.value))}
                size="small" slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: 2020, max: 2099 } }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowQuickModal(false)} sx={{ borderRadius: '10px', textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleQuickGenerate} variant="contained" disabled={quickSaving}
            sx={{ borderRadius: '10px', textTransform: 'none', minWidth: 130,
              background: quickType === 'foreign'
                ? 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)'
                : 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' }}>
            {quickSaving ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Generate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Edit Period Dialog ────────────────────────────────────────────────── */}
      <Dialog open={showEditModal} onClose={() => setShowEditModal(false)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { borderRadius: '4px' } } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Edit Pay Period</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField fullWidth label="Period Name" value={editForm.period_name}
              onChange={e => setEditForm(f => ({ ...f, period_name: e.target.value }))}
              size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
            <Grid container spacing={1.5}>
              <Grid item xs={6}>
                <TextField fullWidth label="Start Date" type="date" value={editForm.start_date}
                  onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))}
                  size="small" slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="End Date" type="date" value={editForm.end_date}
                  onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: editForm.start_date } }}
                  size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
              </Grid>
            </Grid>
            <Grid container spacing={1.5}>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select label="Status" value={editForm.status}
                    onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                    sx={{ borderRadius: '10px' }}>
                    {STATUS_OPTIONS.map(s => (
                      <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Type</InputLabel>
                  <Select label="Type" value={editForm.period_type}
                    onChange={e => setEditForm(f => ({ ...f, period_type: e.target.value }))}
                    sx={{ borderRadius: '10px' }}>
                    <MenuItem value="local">Local</MenuItem>
                    <MenuItem value="foreign">International</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            {editDuration && (
              <Box sx={{ bgcolor: 'action.hover', px: 2, py: 1.25, borderRadius: '8px' }}>
                <Typography sx={{ fontSize: '0.875rem', color: '#6366f1', fontWeight: 600 }}>Duration: {editDuration} day{editDuration !== 1 ? 's' : ''}</Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowEditModal(false)} sx={{ borderRadius: '10px', textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleEdit} variant="contained" disabled={editSaving}
            sx={{ borderRadius: '10px', textTransform: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', minWidth: 110 }}>
            {editSaving ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirm Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth
        slotProps={{ paper: { sx: { borderRadius: '4px' } } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Delete Period?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
            Are you sure you want to delete <strong>{deleteTarget?.period_name}</strong>?
          </Typography>
          <Typography sx={{ color: '#ef4444', fontSize: '0.8rem', mt: 1 }}>
            This will permanently delete the period and all associated timesheet summaries. Payslips are not affected.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ borderRadius: '10px', textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleDelete} variant="contained" disabled={deleteLoading}
            sx={{ borderRadius: '10px', textTransform: 'none', bgcolor: '#ef4444', '&:hover': { bgcolor: '#dc2626' }, minWidth: 100 }}>
            {deleteLoading ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
