import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, CircularProgress, Grid, Checkbox, FormControlLabel,
  List, ListItem, ListItemText,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PeopleIcon from '@mui/icons-material/People';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import { timesheetAPI, payslipsAPI, employeesAPI } from '../api';
import { getMissingBankFields } from '../utils/employeeProfile';

const TH = { fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', py: 1.5, px: 2 };
const TD = { fontSize: '0.85rem', color: 'text.primary', py: 1.5, px: 2 };

function fmt(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function GenerateBankUpload() {
  const [periods, setPeriods]               = useState([]);
  const [periodTypeFilter, setPeriodTypeFilter] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [payslips, setPayslips]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState('');
  const [employees, setEmployees]           = useState([]);

  const [bankDlOpen, setBankDlOpen]         = useState(false);
  const [bankDlType, setBankDlType]         = useState('local');
  const [bankDlEmpIds, setBankDlEmpIds]     = useState([]);
  const [bankDlSelectAll, setBankDlSelectAll] = useState(true);
  const [bankDlLoading, setBankDlLoading]   = useState(false);

  const [markingUploaded, setMarkingUploaded] = useState(false);

  useEffect(() => { fetchPeriods(); fetchEmployees(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const fetchEmployees = async () => {
    try {
      const res = await employeesAPI.getAll(true);
      if (res.success) setEmployees(res.data || []);
    } catch { /* non-critical */ }
  };

  const fetchPayslips = async (periodId) => {
    try {
      const res = await timesheetAPI.getPeriodPayslips(periodId);
      if (res.success) setPayslips(res.data);
    } catch { toast.error('Failed to load payslips'); }
  };

  const handleSelectPeriod = (p) => {
    setSelectedPeriod(p);
    fetchPayslips(p.id);
  };

  const handleMarkUploaded = async () => {
    if (!selectedPeriod) return;
    setMarkingUploaded(true);
    try {
      await timesheetAPI.markBankUploaded(selectedPeriod.id);
      toast.success('Period marked as bank uploaded');
      fetchPeriods();
    } catch (e) {
      toast.error(e.response?.data?.error || e.message || 'Failed to mark as uploaded');
    } finally {
      setMarkingUploaded(false);
    }
  };

  const openBankDl = (type) => {
    setBankDlType(type);
    setBankDlEmpIds([]);
    setBankDlSelectAll(true);
    setBankDlOpen(true);
  };

  const handleBankDownload = async () => {
    if (!selectedPeriod) return toast.error('Select a period');
    setBankDlLoading(true);
    try {
      await payslipsAPI.downloadBankFile(selectedPeriod.id, bankDlType, bankDlSelectAll ? null : bankDlEmpIds);
      setBankDlOpen(false);
    } catch (e) { toast.error(e.message || 'Download failed'); }
    finally { setBankDlLoading(false); }
  };

  const filtered = payslips.filter(p =>
    p.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.payslip_number?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPeriods = periods.filter(p =>
    periodTypeFilter === 'all' ||
    (periodTypeFilter === 'local' ? (!p.period_type || p.period_type === 'local') : p.period_type === 'foreign')
  );

  const totalNet   = filtered.reduce((s, p) => s + (parseFloat(p.net_amount) || 0), 0);
  const totalHours = filtered.reduce((s, p) => s + (parseFloat(p.total_hours) || 0), 0);
  const alreadyUploaded = !!selectedPeriod?.bank_uploaded_at;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #10b981, #34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AccountBalanceIcon sx={{ color: 'white', fontSize: 18 }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Generate Bank Upload</Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>Download bank transfer files and confirm upload status</Typography>
          </Box>
        </Box>
        {selectedPeriod && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="outlined" startIcon={<DownloadIcon sx={{ fontSize: '16px !important' }} />}
              onClick={() => openBankDl('local')}
              sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: '#10b981', color: '#10b981' } }}>
              Local Bank File
            </Button>
            <Button variant="outlined" startIcon={<DownloadIcon sx={{ fontSize: '16px !important' }} />}
              onClick={() => openBankDl('foreign')}
              sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
              Foreign Bank File
            </Button>
            <Button variant="contained"
              startIcon={markingUploaded ? <CircularProgress size={14} sx={{ color: 'white' }} /> : alreadyUploaded ? <CheckCircleIcon sx={{ fontSize: '16px !important' }} /> : <CheckCircleIcon sx={{ fontSize: '16px !important' }} />}
              onClick={handleMarkUploaded}
              disabled={markingUploaded || alreadyUploaded}
              sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem',
                background: alreadyUploaded ? 'linear-gradient(135deg, #10b981, #34d399)' : 'linear-gradient(135deg, #6366f1, #818cf8)',
                boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
              {markingUploaded ? 'Saving…' : alreadyUploaded ? `Uploaded ${fmt(selectedPeriod.bank_uploaded_at)}` : 'Mark as Bank Uploaded'}
            </Button>
          </Box>
        )}
      </Box>

      <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>
        {/* Periods sidebar */}
        <Grid item xs={12} md={3}>
          <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: 2, py: 1.75, borderBottom: '1px solid', borderBottomColor: 'divider' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: 'text.primary', mb: 1 }}>Pay Periods</Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {[{ label: 'All', value: 'all' }, { label: 'Local', value: 'local' }, { label: 'Intl', value: 'foreign' }].map(opt => (
                  <Chip key={opt.value} label={opt.label} size="small" onClick={() => setPeriodTypeFilter(opt.value)}
                    sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                      bgcolor: periodTypeFilter === opt.value ? '#10b981' : 'action.hover',
                      color:   periodTypeFilter === opt.value ? 'white'   : 'text.secondary',
                      '&:hover': { bgcolor: periodTypeFilter === opt.value ? '#059669' : 'action.selected' } }} />
                ))}
              </Box>
            </Box>
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} sx={{ color: '#10b981' }} /></Box>
              ) : filteredPeriods.length === 0 ? (
                <Box sx={{ py: 5, textAlign: 'center', color: 'text.disabled', fontSize: '0.8rem' }}>No periods</Box>
              ) : filteredPeriods.map(p => (
                <Box key={p.id} onClick={() => handleSelectPeriod(p)}
                  sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderBottomColor: 'divider', cursor: 'pointer',
                    bgcolor: selectedPeriod?.id === p.id ? 'rgba(16,185,129,0.06)' : 'transparent',
                    borderLeft: selectedPeriod?.id === p.id ? '3px solid #10b981' : '3px solid transparent',
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: selectedPeriod?.id === p.id ? 'rgba(16,185,129,0.08)' : 'action.hover' } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                    <Typography sx={{ fontWeight: selectedPeriod?.id === p.id ? 700 : 500, fontSize: '0.8rem', color: selectedPeriod?.id === p.id ? '#10b981' : 'text.primary', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mr: 0.5 }}>
                      {p.period_name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0 }}>
                      <Chip label={p.period_type === 'foreign' ? 'Intl' : 'LCL'} size="small"
                        sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700,
                          bgcolor: p.period_type === 'foreign' ? '#0ea5e918' : '#6366f118',
                          color:   p.period_type === 'foreign' ? '#0ea5e9'   : '#6366f1' }} />
                      {p.bank_uploaded_at && (
                        <Tooltip title={`Uploaded ${fmt(p.bank_uploaded_at)}`} arrow>
                          <CheckCircleIcon sx={{ fontSize: 13, color: '#10b981' }} />
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', textTransform: 'capitalize' }}>{p.status}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Main payslips area */}
        <Grid item xs={12} md={9}>
          <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'text.primary' }}>
                  {selectedPeriod ? selectedPeriod.period_name : 'Select a Period'}
                </Typography>
                {filtered.length > 0 && (
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.25 }}>
                    {filtered.length} payslip{filtered.length !== 1 ? 's' : ''} · {totalHours.toFixed(1)}h total · Net {filtered[0]?.currency || ''} {totalNet.toLocaleString()}
                  </Typography>
                )}
              </Box>
              <TextField placeholder="Search by name or number…" value={search} onChange={e => setSearch(e.target.value)} size="small"
                sx={{ width: 240, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'text.disabled', fontSize: 17 }} /></InputAdornment> } }} />
            </Box>

            {alreadyUploaded && (
              <Box sx={{ px: 2.5, py: 1, bgcolor: '#10b98110', borderBottom: '1px solid', borderBottomColor: '#10b98130', display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon sx={{ fontSize: 15, color: '#10b981' }} />
                <Typography sx={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600 }}>
                  Bank file confirmed uploaded on {fmt(selectedPeriod?.bank_uploaded_at)}
                </Typography>
              </Box>
            )}

            {filtered.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0, borderBottom: '1px solid', borderBottomColor: 'divider', bgcolor: 'action.hover' }}>
                {[
                  { icon: <PeopleIcon />, label: 'Employees', value: filtered.length, color: '#6366f1' },
                  { icon: <CalendarMonthIcon />, label: 'Period', value: selectedPeriod?.period_type === 'foreign' ? 'International' : 'Local', color: '#0ea5e9' },
                  { icon: <MonetizationOnIcon />, label: 'Total Net', value: `${filtered[0]?.currency || ''} ${totalNet.toLocaleString()}`, color: '#10b981' },
                ].map((s, i) => (
                  <Box key={i} sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, borderRight: i < 2 ? '1px solid' : 'none', borderColor: 'divider' }}>
                    <Box sx={{ color: s.color, display: 'flex', alignItems: 'center' }}>{s.icon}</Box>
                    <Box>
                      <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{s.label}</Typography>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'text.primary', lineHeight: 1.2 }}>{s.value}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}

            {!selectedPeriod ? (
              <Box sx={{ py: 14, textAlign: 'center', color: 'text.disabled' }}>
                <Box sx={{ width: 60, height: 60, borderRadius: '18px', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                  <CalendarMonthIcon sx={{ fontSize: 28, opacity: 0.3 }} />
                </Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', mb: 0.5 }}>No Period Selected</Typography>
                <Typography sx={{ fontSize: '0.8rem' }}>Select a pay period from the left panel</Typography>
              </Box>
            ) : filtered.length === 0 ? (
              <Box sx={{ py: 14, textAlign: 'center', color: 'text.disabled' }}>
                <Box sx={{ width: 60, height: 60, borderRadius: '18px', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                  <ReceiptLongIcon sx={{ fontSize: 28, opacity: 0.3 }} />
                </Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', mb: 0.5 }}>No Payslips</Typography>
                <Typography sx={{ fontSize: '0.8rem' }}>Run Process Payroll to generate payslips for this period first</Typography>
              </Box>
            ) : (
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      {['Payslip No.', 'Employee', 'Hours', 'Net Pay', 'Status'].map(h => (
                        <TableCell key={h} sx={TH}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map(p => (
                      <TableRow key={p.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                        <TableCell sx={{ ...TD, fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem', color: '#10b981' }}>
                          {p.payslip_number}
                        </TableCell>
                        <TableCell sx={TD}>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.2 }}>{p.employee_name}</Typography>
                          <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>{p.emp_code}</Typography>
                        </TableCell>
                        <TableCell sx={TD}>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.total_hours}h</Typography>
                        </TableCell>
                        <TableCell sx={{ ...TD, fontWeight: 700, color: '#10b981' }}>
                          {p.currency || ''} {p.net_amount?.toLocaleString()}
                        </TableCell>
                        <TableCell sx={TD}>
                          <Chip label={p.status} size="small" sx={{
                            bgcolor: p.status === 'released' ? '#10b98115' : p.status === 'paid' ? '#6366f115' : '#f59e0b15',
                            color:   p.status === 'released' ? '#10b981'   : p.status === 'paid' ? '#6366f1'   : '#f59e0b',
                            fontWeight: 700, fontSize: '0.68rem', textTransform: 'capitalize',
                          }} />
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

      {/* ── Bank File Download Dialog ──────────────────────────────────────── */}
      <Dialog open={bankDlOpen} onClose={() => setBankDlOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountBalanceIcon sx={{ color: bankDlType === 'foreign' ? '#6366f1' : '#10b981', fontSize: 20 }} />
          Download {bankDlType === 'foreign' ? 'Foreign / SWIFT' : 'Local'} Bank File
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2 }}>
            Period: <strong>{selectedPeriod?.period_name}</strong>
          </Typography>
          {(() => {
            const incompleteCount = employees.filter(e => e.hire_category === bankDlType && getMissingBankFields(e).length > 0).length;
            return incompleteCount > 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, bgcolor: '#f59e0b10', border: '1px solid #f59e0b30', borderRadius: '10px', p: 1.5, mb: 2 }}>
                <WarningAmberIcon sx={{ fontSize: 15, color: '#f59e0b', mt: 0.1, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.8rem', color: '#b45309' }}>
                  {incompleteCount} {bankDlType} employee{incompleteCount > 1 ? 's have' : ' has'} incomplete bank profiles and will be excluded.
                </Typography>
              </Box>
            ) : null;
          })()}
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', mb: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Employees</Typography>
          <FormControlLabel
            control={<Checkbox checked={bankDlSelectAll} onChange={e => { setBankDlSelectAll(e.target.checked); setBankDlEmpIds([]); }} size="small" sx={{ color: '#10b981', '&.Mui-checked': { color: '#10b981' } }} />}
            label={<Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>All {bankDlType === 'foreign' ? 'Foreign' : 'Local'} Employees ({employees.filter(e => e.hire_category === bankDlType).length})</Typography>}
          />
          {!bankDlSelectAll && (
            <Box sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid', borderColor: 'divider', mt: 1, borderRadius: '10px', overflow: 'hidden' }}>
              <List dense disablePadding>
                {employees.filter(emp => emp.hire_category === bankDlType).map(emp => {
                  const missing = getMissingBankFields(emp);
                  const incomplete = missing.length > 0;
                  return (
                    <ListItem key={emp.id} disablePadding
                      secondaryAction={<Checkbox checked={bankDlEmpIds.includes(emp.id)} onChange={() => setBankDlEmpIds(prev => prev.includes(emp.id) ? prev.filter(x => x !== emp.id) : [...prev, emp.id])} size="small" sx={{ color: '#10b981', '&.Mui-checked': { color: '#10b981' } }} />}
                      sx={{ borderBottom: '1px solid', borderBottomColor: 'divider', opacity: incomplete ? 0.65 : 1 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <span>{emp.name}</span>
                            {incomplete && <Tooltip title={`Missing: ${missing.join(', ')}`} arrow><WarningAmberIcon sx={{ fontSize: 13, color: '#f59e0b' }} /></Tooltip>}
                          </Box>
                        }
                        secondary={`${emp.employee_id}${incomplete ? ' · profile incomplete' : ''}`}
                        sx={{ pl: 1.5, '& .MuiListItemText-primary': { fontSize: '0.875rem' }, '& .MuiListItemText-secondary': { fontSize: '0.72rem', color: incomplete ? '#f59e0b' : 'text.secondary' } }}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setBankDlOpen(false)} sx={{ borderRadius: '10px', textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button variant="contained"
            startIcon={bankDlLoading ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <DownloadIcon />}
            onClick={handleBankDownload}
            disabled={bankDlLoading || (!bankDlSelectAll && bankDlEmpIds.length === 0)}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600,
              background: bankDlType === 'foreign' ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'linear-gradient(135deg, #10b981, #34d399)',
              boxShadow: '0 4px 12px rgba(99,102,241,0.25)' }}>
            {bankDlLoading ? 'Downloading…' : 'Download'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
