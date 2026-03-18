import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, Chip, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tab, Tabs, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Tooltip, Alert, Grid
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SendIcon from '@mui/icons-material/Send';
import ReplayIcon from '@mui/icons-material/Replay';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { timesheetAPI } from '../api';

const TH = { fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', py: 1.5, px: 2 };
const TD = { fontSize: '0.875rem', color: 'text.primary', py: 1.25, px: 2 };

function InfoRow({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1.25, borderBottom: '1px solid', borderBottomColor: 'divider' }}>
      <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>{value}</Typography>
    </Box>
  );
}

export default function PendingApprovals() {
  const [tab, setTab] = useState(0);
  const [pending, setPending] = useState([]);
  const [rejected, setRejected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [showRejectionDetail, setShowRejectionDetail] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id && pending.length > 0) {
      const found = pending.find(s => String(s.id) === id);
      if (found) setSelectedSummary(found);
    }
  }, [pending]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [pendingRes, rejectedRes] = await Promise.all([
        timesheetAPI.getPending(),
        timesheetAPI.getRejected()
      ]);
      if (pendingRes.success) setPending(pendingRes.data);
      if (rejectedRes.success) setRejected(rejectedRes.data);
    } catch { toast.error('Failed to load timesheets'); }
    finally { setLoading(false); }
  };

  const handleResend = async (id) => {
    try {
      setProcessingId(id);
      const res = await timesheetAPI.resendApproval(id);
      if (res.success) { toast.success('Resubmitted for approval'); fetchAll(); }
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to resubmit'); }
    finally { setProcessingId(null); }
  };


  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: '#6366f1' }} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>Approvals</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', mt: 0.25 }}>
            {pending.length} pending · {rejected.length} rejected by employee
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchAll}
          sx={{ borderRadius: '10px', textTransform: 'none', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: '#6366f1', color: '#6366f1', bgcolor: 'rgba(99,102,241,0.04)' } }}>
          Refresh
        </Button>
      </Box>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, '& .MuiTabs-indicator': { bgcolor: '#6366f1' }, '& .Mui-selected': { color: '#6366f1 !important' } }}>
        <Tab label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HourglassEmptyIcon sx={{ fontSize: 18 }} /> Pending
            {pending.length > 0 && <Chip label={pending.length} size="small" sx={{ bgcolor: '#f59e0b', color: 'white', fontWeight: 700, height: 20, fontSize: '0.72rem' }} />}
          </Box>
        } sx={{ textTransform: 'none', fontWeight: 600 }} />
        <Tab label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningAmberIcon sx={{ fontSize: 18 }} /> Rejected by Employee
            {rejected.length > 0 && <Chip label={rejected.length} size="small" sx={{ bgcolor: '#ef4444', color: 'white', fontWeight: 700, height: 20, fontSize: '0.72rem' }} />}
          </Box>
        } sx={{ textTransform: 'none', fontWeight: 600 }} />
      </Tabs>

      {/* PENDING TAB */}
      {tab === 0 && (
        pending.length === 0 ? (
          <Paper elevation={0} sx={{ p: 8, borderRadius: 0, border: '1px solid', borderColor: 'divider', textAlign: 'center', color: 'text.disabled' }}>
            <CheckCircleIcon sx={{ fontSize: 56, color: '#10b981', opacity: 0.4, mb: 1.5 }} />
            <Typography sx={{ fontWeight: 700, color: 'text.secondary', mb: 0.5 }}>All Caught Up!</Typography>
            <Typography sx={{ fontSize: '0.875rem' }}>No pending approvals at the moment</Typography>
          </Paper>
        ) : (
          <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'action.hover' }}>
                  <TableRow>
                    {['Employee', 'Period', 'Hours', 'Gross', 'Days Pending', 'Wrike Task', 'Actions'].map(h => <TableCell key={h} sx={TH}>{h}</TableCell>)}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pending.map(s => (
                    <TableRow key={s.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                      <TableCell sx={TD}>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.employee_name}</Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>{s.email}</Typography>
                      </TableCell>
                      <TableCell sx={TD}>{s.period_name}</TableCell>
                      <TableCell sx={TD}>{s.total_hours}h</TableCell>
                      <TableCell sx={TD}>{s.currency || ''} {s.gross_amount?.toLocaleString()}</TableCell>
                      <TableCell sx={TD}>
                        <Chip label={`${s.days_since_updated || 0} days`} size="small"
                          sx={{ bgcolor: (s.days_since_updated || 0) > 3 ? '#ef444415' : '#f59e0b15', color: (s.days_since_updated || 0) > 3 ? '#ef4444' : '#f59e0b', fontWeight: 600, fontSize: '0.72rem' }} />
                      </TableCell>
                      <TableCell sx={TD}>
                        {s.approval_task_id && (
                          <Tooltip title="View in Wrike">
                            <IconButton size="small" component="a" href={`https://www.wrike.com/workspace.htm#task=${s.approval_task_id}`} target="_blank" rel="noopener noreferrer"
                              sx={{ color: '#0ea5e9', '&:hover': { bgcolor: '#0ea5e915' } }}>
                              <OpenInNewIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell sx={TD}>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="View Details"><IconButton size="small" onClick={() => setSelectedSummary(s)} sx={{ color: '#6366f1', '&:hover': { bgcolor: '#6366f115' } }}><VisibilityIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                          <Tooltip title="Resend"><IconButton size="small" onClick={() => handleResend(s.id)} disabled={processingId === s.id} sx={{ color: 'text.secondary', '&:hover': { bgcolor: '#64748b15' } }}><SendIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )
      )}

      {/* REJECTED TAB */}
      {tab === 1 && (
        rejected.length === 0 ? (
          <Paper elevation={0} sx={{ p: 8, borderRadius: 0, border: '1px solid', borderColor: 'divider', textAlign: 'center', color: 'text.disabled' }}>
            <CheckCircleIcon sx={{ fontSize: 56, color: '#10b981', opacity: 0.4, mb: 1.5 }} />
            <Typography sx={{ fontWeight: 700, color: 'text.secondary', mb: 0.5 }}>No Rejected Timesheets</Typography>
            <Typography sx={{ fontSize: '0.875rem' }}>Employees haven't raised any disputes</Typography>
          </Paper>
        ) : (
          <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderBottomColor: 'divider' }}>
              <Alert severity="warning" sx={{ borderRadius: 0 }}>
                These timesheets were <strong>rejected by employees</strong> who found discrepancies. Review the reason, make corrections if needed, then resubmit.
              </Alert>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'action.hover' }}>
                  <TableRow>
                    {['Employee', 'Period', 'Hours', 'Gross', 'Since Rejection', 'Reason', 'Actions'].map(h => <TableCell key={h} sx={TH}>{h}</TableCell>)}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rejected.map(s => {
                    const files = (() => { try { return s.rejection_files ? JSON.parse(s.rejection_files) : []; } catch { return []; } })();
                    return (
                      <TableRow key={s.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                        <TableCell sx={TD}>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.employee_name}</Typography>
                          <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>{s.email}</Typography>
                        </TableCell>
                        <TableCell sx={TD}>{s.period_name}</TableCell>
                        <TableCell sx={TD}>{s.total_hours}h</TableCell>
                        <TableCell sx={TD}>{s.currency || ''} {s.gross_amount?.toLocaleString()}</TableCell>
                        <TableCell sx={TD}>
                          <Chip label={`${s.days_since_updated || 0} days`} size="small" sx={{ bgcolor: '#ef444415', color: '#ef4444', fontWeight: 600, fontSize: '0.72rem' }} />
                        </TableCell>
                        <TableCell sx={{ ...TD, maxWidth: 180 }}>
                          <Typography sx={{ fontSize: '0.8rem', color: '#ef4444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.rejection_reason || '—'}
                          </Typography>
                          {files.length > 0 && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                              <AttachFileIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                              <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>{files.length} file{files.length > 1 ? 's' : ''}</Typography>
                            </Box>
                          )}
                        </TableCell>
                        <TableCell sx={TD}>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="View Details"><IconButton size="small" onClick={() => setShowRejectionDetail({ ...s, parsedFiles: files })} sx={{ color: '#6366f1', '&:hover': { bgcolor: '#6366f115' } }}><VisibilityIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                            <Tooltip title="Resubmit"><IconButton size="small" onClick={() => handleResend(s.id)} disabled={processingId === s.id} sx={{ color: '#6366f1', '&:hover': { bgcolor: '#6366f115' } }}><ReplayIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )
      )}

      {/* Pending detail dialog */}
      <Dialog open={!!selectedSummary} onClose={() => setSelectedSummary(null)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { borderRadius: '4px' } } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Timesheet Details</DialogTitle>
        <DialogContent>
          {selectedSummary && (
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid item xs={6}><InfoRow label="Employee" value={selectedSummary.employee_name} /></Grid>
              <Grid item xs={6}><InfoRow label="Period" value={selectedSummary.period_name} /></Grid>
              <Grid item xs={6}><InfoRow label="Total Hours" value={`${selectedSummary.total_hours}h`} /></Grid>
              <Grid item xs={6}><InfoRow label="Gross Amount" value={`${selectedSummary.currency || ''} ${selectedSummary.gross_amount?.toLocaleString()}`} /></Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setSelectedSummary(null)} sx={{ borderRadius: '10px', textTransform: 'none', color: 'text.secondary' }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Rejection detail dialog */}
      <Dialog open={!!showRejectionDetail} onClose={() => setShowRejectionDetail(null)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { borderRadius: '4px' } } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Rejection Details</DialogTitle>
        <DialogContent>
          {showRejectionDetail && (
            <>
              <Grid container spacing={2} sx={{ mt: 0, mb: 2 }}>
                <Grid item xs={6}><InfoRow label="Employee" value={showRejectionDetail.employee_name} /></Grid>
                <Grid item xs={6}><InfoRow label="Period" value={showRejectionDetail.period_name} /></Grid>
                <Grid item xs={6}><InfoRow label="Total Hours" value={`${showRejectionDetail.total_hours}h`} /></Grid>
                <Grid item xs={6}><InfoRow label="Gross Amount" value={`${showRejectionDetail.currency || ''} ${showRejectionDetail.gross_amount?.toLocaleString()}`} /></Grid>
              </Grid>
              <Box sx={{ bgcolor: '#fff8e1', borderRadius: 0, p: 2, mb: 2 }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#92400e', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Employee's Rejection Reason
                </Typography>
                <Typography sx={{ color: '#92400e', fontSize: '0.875rem' }}>
                  {showRejectionDetail.rejection_reason || 'No reason provided'}
                </Typography>
              </Box>
              {showRejectionDetail.parsedFiles?.length > 0 && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                    <AttachFileIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>Attached Files</Typography>
                  </Box>
                  {showRejectionDetail.parsedFiles.map((f, i) => (
                    <Box key={i} sx={{ px: 1.5, py: 1, bgcolor: 'action.hover', borderRadius: 1, mb: 0.5, fontSize: '0.875rem', color: 'text.secondary' }}>
                      {f.name} ({Math.round(f.size / 1024)} KB)
                    </Box>
                  ))}
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setShowRejectionDetail(null)} sx={{ borderRadius: '10px', textTransform: 'none', color: 'text.secondary' }}>Close</Button>
          <Button variant="outlined" startIcon={<ReplayIcon />}
            onClick={() => { handleResend(showRejectionDetail.id); setShowRejectionDetail(null); }}
            disabled={processingId === showRejectionDetail?.id}
            sx={{ borderRadius: '10px', textTransform: 'none', borderColor: '#6366f1', color: '#6366f1' }}>
            Resubmit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
