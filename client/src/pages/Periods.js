import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, Chip, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  CircularProgress, IconButton, Tooltip, Divider, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import RefreshIcon from '@mui/icons-material/Refresh';
import PeopleIcon from '@mui/icons-material/People';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { timesheetAPI } from '../api';

const STATUS_COLORS = { open: '#6366f1', processing: '#f59e0b', pending_approval: '#f59e0b', approved: '#10b981', rejected: '#ef4444', paid: '#10b981' };
const STATUS_OPTIONS = ['open', 'processing', 'pending_approval', 'approved', 'rejected', 'paid'];
const TH = { fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', py: 1.5, px: 2 };
const TD = { fontSize: '0.875rem', color: 'text.primary', py: 1.25, px: 2 };

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

const EMPTY_FORM = { period_name: '', start_date: '', end_date: '', status: 'open' };

export default function Periods() {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [summaries, setSummaries] = useState([]);

  // Create dialog
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [createSaving, setCreateSaving] = useState(false);

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
      const res = await timesheetAPI.getPeriods();
      if (res.success) setPeriods(res.data);
    } catch { toast.error('Failed to load periods'); }
    finally { setLoading(false); }
  };

  const fetchSummaries = async (periodId) => {
    try {
      const res = await timesheetAPI.getPeriodSummaries(periodId);
      if (res.success) setSummaries(res.data);
    } catch { toast.error('Failed to load summaries'); }
  };

  const handleSelectPeriod = (p) => { setSelectedPeriod(p); fetchSummaries(p.id); };

  // ── Create ──────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!createForm.start_date || !createForm.end_date) return toast.error('Start and end dates are required');
    if (createForm.start_date > createForm.end_date) return toast.error('Start date must be before end date');
    try {
      setCreateSaving(true);
      const name = createForm.period_name.trim() || (() => {
        const s = new Date(createForm.start_date), e = new Date(createForm.end_date);
        return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      })();
      const res = await timesheetAPI.createPeriod({ period_name: name, start_date: createForm.start_date, end_date: createForm.end_date });
      if (res.success) {
        toast.success('Period created');
        setShowCreateModal(false);
        setCreateForm(EMPTY_FORM);
        fetchPeriods();
      }
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to create period'); }
    finally { setCreateSaving(false); }
  };

  // ── Edit ─────────────────────────────────────────────────────────────────────
  const openEdit = (p, e) => {
    e.stopPropagation();
    setEditingId(p.id);
    setEditForm({ period_name: p.period_name, start_date: String(p.start_date).substring(0, 10), end_date: String(p.end_date).substring(0, 10), status: p.status });
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
  const openDelete = (p, e) => { e.stopPropagation(); setDeleteTarget(p); };

  const handleDelete = async () => {
    try {
      setDeleteLoading(true);
      await timesheetAPI.deletePeriod(deleteTarget.id);
      toast.success('Period deleted');
      setDeleteTarget(null);
      if (selectedPeriod?.id === deleteTarget.id) { setSelectedPeriod(null); setSummaries([]); }
      fetchPeriods();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to delete period'); }
    finally { setDeleteLoading(false); }
  };

  // ── Other actions ────────────────────────────────────────────────────────────
  const handleGeneratePayslip = async (summaryId) => {
    try {
      toast.loading('Generating payslip…');
      const res = await timesheetAPI.generatePayslip(summaryId);
      toast.dismiss();
      if (res.success) { toast.success('Payslip generated'); fetchSummaries(selectedPeriod.id); }
    } catch (e) { toast.dismiss(); toast.error(e.response?.data?.error || 'Failed'); }
  };

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

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>Pay Periods</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowCreateModal(true)}
          sx={{ borderRadius: '10px', textTransform: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }}>
          New Period
        </Button>
      </Box>

      <Grid container spacing={2}>
        {/* Periods list */}
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 2, borderBottom: '1px solid #f1f5f9' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'text.primary' }}>All Periods</Typography>
            </Box>
            <Box sx={{ maxHeight: 520, overflowY: 'auto' }}>
              {loading ? (
                <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}><CircularProgress size={28} sx={{ color: '#6366f1' }} /></Box>
              ) : periods.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center', color: 'text.disabled' }}>
                  <CalendarMonthIcon sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
                  <Typography sx={{ fontSize: '0.875rem' }}>No periods yet</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={() => setShowCreateModal(true)}
                    sx={{ mt: 1.5, textTransform: 'none', color: '#6366f1' }}>
                    Create First Period
                  </Button>
                </Box>
              ) : periods.map(p => (
                <Box key={p.id} onClick={() => handleSelectPeriod(p)}
                  sx={{ px: 2, py: 1.5, borderBottom: '1px solid #f1f5f9', cursor: 'pointer', bgcolor: selectedPeriod?.id === p.id ? 'rgba(99,102,241,0.06)' : 'transparent', transition: 'background 0.15s', '&:hover': { bgcolor: selectedPeriod?.id === p.id ? 'rgba(99,102,241,0.08)' : '#f8fafc' } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                      <Typography sx={{ fontWeight: selectedPeriod?.id === p.id ? 700 : 500, fontSize: '0.875rem', color: selectedPeriod?.id === p.id ? '#6366f1' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.period_name}
                      </Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', mt: 0.25 }}>
                        {new Date(p.start_date).toLocaleDateString()} – {new Date(p.end_date).toLocaleDateString()}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
                      <StatusChip status={p.status} />
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={(e) => openEdit(p, e)} sx={{ color: 'text.disabled', '&:hover': { color: '#6366f1', bgcolor: '#6366f108' }, p: 0.4 }}>
                          <EditIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={(e) => openDelete(p, e)} sx={{ color: 'text.disabled', '&:hover': { color: '#ef4444', bgcolor: '#ef444408' }, p: 0.4 }}>
                          <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Period detail */}
        <Grid item xs={12} md={8}>
          <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            {!selectedPeriod ? (
              <Box sx={{ py: 12, textAlign: 'center', color: 'text.disabled' }}>
                <CalendarMonthIcon sx={{ fontSize: 56, opacity: 0.2, mb: 1.5 }} />
                <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Select a Period</Typography>
                <Typography sx={{ fontSize: '0.875rem' }}>Choose a period from the list to view details</Typography>
              </Box>
            ) : (
              <>
                {/* Detail header */}
                <Box sx={{ px: 2, py: 2, borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'text.primary' }}>{selectedPeriod.period_name}</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>
                      {new Date(selectedPeriod.start_date).toLocaleDateString()} – {new Date(selectedPeriod.end_date).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={(e) => openEdit(selectedPeriod, e)}
                      sx={{ borderRadius: '2px', textTransform: 'none', fontSize: '0.8rem', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
                      Edit
                    </Button>
                    <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={() => handleProcess(selectedPeriod.id)}
                      sx={{ borderRadius: '2px', textTransform: 'none', fontSize: '0.8rem', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
                      Process
                    </Button>
                  </Box>
                </Box>

                {/* Mini stats */}
                <Grid container spacing={1.5} sx={{ p: 2 }}>
                  <Grid item xs={3}><MiniStat icon={<PeopleIcon />} label="Employees" value={summaries.length} color="#6366f1" /></Grid>
                  <Grid item xs={3}><MiniStat icon={<HourglassEmptyIcon />} label="Pending" value={summaries.filter(s => s.approval_status === 'pending').length} color="#f59e0b" /></Grid>
                  <Grid item xs={3}><MiniStat icon={<CheckCircleOutlineIcon />} label="Approved" value={summaries.filter(s => s.approval_status === 'approved').length} color="#10b981" /></Grid>
                  <Grid item xs={3}><MiniStat icon={<CancelOutlinedIcon />} label="Rejected" value={summaries.filter(s => s.approval_status === 'rejected').length} color="#ef4444" /></Grid>
                </Grid>

                <Divider />

                {/* Summaries table */}
                <TableContainer>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: 'action.hover' }}>
                      <TableRow>
                        {['Employee', 'Hours', 'Gross', 'Status', 'Actions'].map(h => <TableCell key={h} sx={TH}>{h}</TableCell>)}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {summaries.length === 0 ? (
                        <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 5, color: 'text.disabled', fontSize: '0.875rem' }}>
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
                          <TableCell sx={TD}><StatusChip status={s.approval_status} /></TableCell>
                          <TableCell sx={TD}>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <Tooltip title="View Details">
                                <IconButton size="small" component={Link} to={`/pending?id=${s.id}`}
                                  sx={{ color: '#6366f1', '&:hover': { bgcolor: '#6366f115' } }}>
                                  <VisibilityIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                              {s.approval_status === 'approved' && (
                                <Tooltip title="Generate Payslip">
                                  <IconButton size="small" onClick={() => handleGeneratePayslip(s.id)}
                                    sx={{ color: '#10b981', '&:hover': { bgcolor: '#10b98115' } }}>
                                    <ReceiptLongIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
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
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>New Pay Period</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField fullWidth label="Period Name" placeholder="e.g. Mar 1–15, 2026" value={createForm.period_name}
              onChange={e => setCreateForm(f => ({ ...f, period_name: e.target.value }))}
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
              <Box sx={{ bgcolor: 'action.hover', px: 2, py: 1.25 }}>
                <Typography sx={{ fontSize: '0.875rem', color: '#6366f1', fontWeight: 600 }}>Duration: {createDuration} day{createDuration !== 1 ? 's' : ''}</Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowCreateModal(false)} sx={{ borderRadius: '10px', textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained" disabled={createSaving}
            sx={{ borderRadius: '10px', textTransform: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', minWidth: 120 }}>
            {createSaving ? <CircularProgress size={18} sx={{ color: 'white' }} /> : 'Create Period'}
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
            {editDuration && (
              <Box sx={{ bgcolor: 'action.hover', px: 2, py: 1.25 }}>
                <Typography sx={{ fontSize: '0.875rem', color: '#6366f1', fontWeight: 600 }}>Duration: {editDuration} day{editDuration !== 1 ? 's' : ''}</Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setShowEditModal(false)} sx={{ borderRadius: '10px', textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleEdit} variant="contained" disabled={editSaving}
            sx={{ borderRadius: '10px', textTransform: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', minWidth: 100 }}>
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
