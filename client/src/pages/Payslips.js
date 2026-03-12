import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, CircularProgress, Grid, Divider
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DownloadIcon from '@mui/icons-material/Download';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { timesheetAPI } from '../api';

const TH = { fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', py: 1.5, px: 2 };
const TD = { fontSize: '0.875rem', color: '#1e293b', py: 1.25, px: 2 };

function InfoRow({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1.25, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <Typography sx={{ fontSize: '0.875rem', color: '#64748b' }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>{value}</Typography>
    </Box>
  );
}

export default function Payslips() {
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => { fetchPeriods(); }, []);

  const fetchPeriods = async () => {
    try {
      setLoading(true);
      const res = await timesheetAPI.getPeriods();
      if (res.success) {
        setPeriods(res.data);
        if (res.data.length > 0) handleSelectPeriod(res.data[0]);
      }
    } catch { toast.error('Failed to load periods'); }
    finally { setLoading(false); }
  };

  const fetchPayslips = async (periodId) => {
    try {
      const res = await timesheetAPI.getPeriodPayslips(periodId);
      if (res.success) setPayslips(res.data);
    } catch { toast.error('Failed to load payslips'); }
  };

  const handleSelectPeriod = (p) => { setSelectedPeriod(p); fetchPayslips(p.id); };

  const handleViewPayslip = async (id) => {
    try {
      const res = await timesheetAPI.getPayslip(id);
      if (res.success) setSelected(res.data);
    } catch { toast.error('Failed to load payslip details'); }
  };

  const filtered = payslips.filter(p =>
    p.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.payslip_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Payslips</Typography>
      </Box>

      <Grid container spacing={2}>
        {/* Periods sidebar */}
        <Grid item xs={12} md={3}>
          <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 2, borderBottom: '1px solid #f1f5f9' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>Periods</Typography>
            </Box>
            <Box sx={{ maxHeight: 480, overflowY: 'auto' }}>
              {loading ? (
                <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} sx={{ color: '#6366f1' }} /></Box>
              ) : periods.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>No periods</Box>
              ) : periods.map(p => (
                <Box key={p.id} onClick={() => handleSelectPeriod(p)}
                  sx={{ px: 2, py: 1.5, borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                    bgcolor: selectedPeriod?.id === p.id ? 'rgba(99,102,241,0.06)' : 'transparent',
                    '&:hover': { bgcolor: selectedPeriod?.id === p.id ? 'rgba(99,102,241,0.08)' : '#f8fafc' } }}>
                  <Typography sx={{ fontWeight: selectedPeriod?.id === p.id ? 700 : 500, fontSize: '0.875rem', color: selectedPeriod?.id === p.id ? '#6366f1' : '#0f172a' }}>
                    {p.period_name}
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', mt: 0.25, textTransform: 'capitalize' }}>{p.status}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Payslips table */}
        <Grid item xs={12} md={9}>
          <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 2, borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                {selectedPeriod ? selectedPeriod.period_name : 'Select a Period'}
              </Typography>
              <TextField
                placeholder="Search payslips…" value={search} onChange={e => setSearch(e.target.value)} size="small"
                sx={{ width: 220, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#94a3b8', fontSize: 18 }} /></InputAdornment> } }}
              />
            </Box>

            {!selectedPeriod ? (
              <Box sx={{ py: 12, textAlign: 'center', color: '#94a3b8' }}>
                <CalendarMonthIcon sx={{ fontSize: 48, opacity: 0.2, mb: 1 }} />
                <Typography sx={{ fontSize: '0.875rem' }}>Select a period to view payslips</Typography>
              </Box>
            ) : filtered.length === 0 ? (
              <Box sx={{ py: 12, textAlign: 'center', color: '#94a3b8' }}>
                <ReceiptLongIcon sx={{ fontSize: 48, opacity: 0.2, mb: 1 }} />
                <Typography sx={{ fontSize: '0.875rem' }}>No payslips generated for this period</Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      {['Payslip No.', 'Employee', 'Hours', 'Gross', 'Net', 'Status', 'Actions'].map(h => <TableCell key={h} sx={TH}>{h}</TableCell>)}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map(p => (
                      <TableRow key={p.id} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                        <TableCell sx={{ ...TD, fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8rem', color: '#6366f1' }}>{p.payslip_number}</TableCell>
                        <TableCell sx={TD}>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.employee_name}</Typography>
                          <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8' }}>{p.employee_id}</Typography>
                        </TableCell>
                        <TableCell sx={TD}>{p.total_hours}h</TableCell>
                        <TableCell sx={TD}>{p.currency || 'BDT'} {p.gross_amount?.toLocaleString()}</TableCell>
                        <TableCell sx={{ ...TD, fontWeight: 700, color: '#10b981' }}>{p.currency || 'BDT'} {p.net_amount?.toLocaleString()}</TableCell>
                        <TableCell sx={TD}>
                          <Chip label={p.status} size="small" sx={{
                            bgcolor: p.status === 'paid' ? '#10b98115' : '#6366f115',
                            color: p.status === 'paid' ? '#10b981' : '#6366f1',
                            fontWeight: 600, fontSize: '0.72rem', textTransform: 'capitalize'
                          }} />
                        </TableCell>
                        <TableCell sx={TD}>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="View Details">
                              <IconButton size="small" onClick={() => handleViewPayslip(p.id)} sx={{ color: '#6366f1', '&:hover': { bgcolor: '#6366f115' } }}>
                                <VisibilityIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                            {p.drive_file_url && (
                              <Tooltip title="View in Drive">
                                <IconButton size="small" component="a" href={p.drive_file_url} target="_blank" rel="noopener noreferrer"
                                  sx={{ color: '#0ea5e9', '&:hover': { bgcolor: '#0ea5e915' } }}>
                                  <OpenInNewIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                            {p.pdf_path && (
                              <Tooltip title="Download PDF">
                                <IconButton size="small" component="a" href={`/uploads/${p.pdf_path.split('/').pop()}`} target="_blank" rel="noopener noreferrer"
                                  sx={{ color: '#10b981', '&:hover': { bgcolor: '#10b98115' } }}>
                                  <DownloadIcon sx={{ fontSize: 16 }} />
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
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Detail dialog */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { borderRadius: '4px' } } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Payslip Details</DialogTitle>
        <DialogContent>
          {selected && (
            <>
              <Box sx={{ bgcolor: '#f8fafc', borderRadius: 0, p: 2, mb: 2 }}>
                <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', mb: 0.25 }}>Payslip Number</Typography>
                <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.1rem', color: '#6366f1' }}>{selected.payslip_number}</Typography>
              </Box>
              <Divider sx={{ mb: 1.5 }} />
              <InfoRow label="Employee" value={selected.employee_name} />
              <InfoRow label="Period" value={selected.period_name} />
              <InfoRow label="Total Hours" value={`${selected.total_hours}h`} />
              <InfoRow label="Hourly Rate" value={`${selected.currency || 'BDT'} ${selected.hourly_rate}`} />
              <InfoRow label="Gross Amount" value={`${selected.currency || 'BDT'} ${selected.gross_amount?.toLocaleString()}`} />
              <InfoRow label="Deductions" value={`${selected.currency || 'BDT'} ${((selected.tax_deductions || 0) + (selected.other_deductions || 0)).toLocaleString()}`} />
              <Box sx={{ background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', borderRadius: 0, p: 2, mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ color: 'white', fontWeight: 600 }}>Net Amount</Typography>
                <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '1.4rem' }}>
                  {selected.currency || 'BDT'} {selected.net_amount?.toLocaleString()}
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSelected(null)} sx={{ borderRadius: '10px', textTransform: 'none', color: '#64748b' }}>Close</Button>
          {selected?.drive_file_url && (
            <Button variant="contained" startIcon={<OpenInNewIcon />} component="a" href={selected.drive_file_url} target="_blank" rel="noopener noreferrer"
              sx={{ borderRadius: '10px', textTransform: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' }}>
              View in Drive
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
