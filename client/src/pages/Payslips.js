import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, CircularProgress, Grid, Divider, Checkbox, FormControlLabel,
  List, ListItem, ListItemText, Select, MenuItem, InputLabel, FormControl,
  LinearProgress
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DownloadIcon from '@mui/icons-material/Download';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { timesheetAPI, payslipsAPI, employeesAPI, jobsAPI } from '../api';
import { getMissingBankFields } from '../utils/employeeProfile';

function pollJob(jobId, onProgress) {
  return new Promise((resolve, reject) => {
    const id = setInterval(async () => {
      try {
        const res = await jobsAPI.getStatus(jobId);
        const job = res.data;
        if (job.progress && onProgress) onProgress(job.progress);
        if (job.status === 'done') { clearInterval(id); resolve(job.result); }
        else if (job.status === 'failed') { clearInterval(id); reject(new Error(job.error || 'Job failed')); }
      } catch (err) { clearInterval(id); reject(err); }
    }, 1500);
  });
}

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

export default function Payslips() {
  const [periods, setPeriods] = useState([]);
  const [periodTypeFilter, setPeriodTypeFilter] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  // Bulk generation state
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [selectAll, setSelectAll] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(null);
  const [bulkResult, setBulkResult] = useState(null);

  // PDF viewer state
  const [pdfViewerUrl, setPdfViewerUrl] = useState(null);
  const [pdfViewerName, setPdfViewerName] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  // Bank file download dialog state
  const [bankDlOpen, setBankDlOpen] = useState(false);
  const [bankDlType, setBankDlType] = useState('local');
  const [bankDlPeriodId, setBankDlPeriodId] = useState(null);
  const [bankDlEmpIds, setBankDlEmpIds] = useState([]);
  const [bankDlSelectAll, setBankDlSelectAll] = useState(true);
  const [bankDlLoading, setBankDlLoading] = useState(false);

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

  const handleSelectPeriod = (p) => { setSelectedPeriod(p); fetchPayslips(p.id); setBulkResult(null); };

  const handleViewPayslip = async (id) => {
    try {
      const res = await payslipsAPI.getById(id);
      if (res.success) setSelected(res.data);
    } catch { toast.error('Failed to load payslip details'); }
  };

  const handleToggleEmployee = (id) => {
    setSelectedEmployeeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked) => {
    setSelectAll(checked);
    setSelectedEmployeeIds(checked ? [] : []);
  };

  const handleBulkGenerate = async () => {
    if (!selectedPeriod) return toast.error('Select a period first');
    setGenerating(true);
    setGenProgress(null);
    setBulkResult(null);
    try {
      const empIds = selectAll ? null : selectedEmployeeIds;
      const res = await payslipsAPI.generateForPeriod(selectedPeriod.id, empIds);
      let data = res.data;
      if (data?.jobId) {
        data = await pollJob(data.jobId, (p) => setGenProgress(p));
      }
      if (data) {
        setBulkResult(data);
        const { generated, skipped, errors } = data;
        if (generated > 0) toast.success(`Generated ${generated} payslip(s)`);
        else if (skipped > 0) toast(`${skipped} already generated — nothing new to create`, { icon: 'ℹ️' });
        else if (errors?.length) toast.error(`${errors.length} error(s) — check results`);
        fetchPayslips(selectedPeriod.id);
      }
    } catch (e) { toast.error(e.response?.data?.error || e.message || 'Generation failed'); }
    finally { setGenerating(false); setGenProgress(null); }
  };

  const handleViewPDF = async (payslip) => {
    setPdfLoading(true);
    try {
      const res = await payslipsAPI.downloadPDF(payslip.id);
      const blob = new Blob([res], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfViewerUrl(url);
      setPdfViewerName(payslip.payslip_number || 'Payslip');
    } catch { toast.error('Failed to load PDF'); }
    finally { setPdfLoading(false); }
  };

  const closePdfViewer = () => {
    if (pdfViewerUrl) URL.revokeObjectURL(pdfViewerUrl);
    setPdfViewerUrl(null);
  };

  const openBankDl = (type) => {
    setBankDlType(type);
    setBankDlPeriodId(selectedPeriod?.id ?? periods[0]?.id ?? null);
    setBankDlEmpIds([]);
    setBankDlSelectAll(true);
    setBankDlOpen(true);
  };

  const handleBankDlToggleEmp = (id) => {
    setBankDlEmpIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBankDownload = async () => {
    if (!bankDlPeriodId) return toast.error('Select a period');
    setBankDlLoading(true);
    try {
      const empIds = bankDlSelectAll ? null : bankDlEmpIds;
      await payslipsAPI.downloadBankFile(bankDlPeriodId, bankDlType, empIds);
      setBankDlOpen(false);
    } catch (e) {
      toast.error(e.message || 'Download failed');
    } finally {
      setBankDlLoading(false);
    }
  };

  const filtered = payslips.filter(p =>
    p.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.payslip_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>Payslips</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<AutoAwesomeIcon />} onClick={() => setShowBulkPanel(v => !v)}
            sx={{ borderRadius: '10px', textTransform: 'none', borderColor: showBulkPanel ? '#6366f1' : 'divider', color: showBulkPanel ? '#6366f1' : 'text.secondary' }}>
            Generate Payslips
          </Button>
          <>
            <Tooltip title="Download local bank transfer file">
              <Button variant="outlined" startIcon={<AccountBalanceIcon />}
                onClick={() => openBankDl('local')}
                sx={{ borderRadius: '10px', textTransform: 'none', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: '#10b981', color: '#10b981' } }}>
                Local Bank File
              </Button>
            </Tooltip>
            <Tooltip title="Download foreign/SWIFT transfer file">
              <Button variant="outlined" startIcon={<AccountBalanceIcon />}
                onClick={() => openBankDl('foreign')}
                sx={{ borderRadius: '10px', textTransform: 'none', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
                Foreign Bank File
              </Button>
            </Tooltip>
          </>
        </Box>
      </Box>

      {/* Bulk Generate Panel */}
      {showBulkPanel && (
        <Paper elevation={0} sx={{ mb: 2, border: '1px solid', borderColor: '#6366f130', bgcolor: 'rgba(99,102,241,0.02)', borderRadius: 0, overflow: 'hidden' }}>
          <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeIcon sx={{ color: '#6366f1', fontSize: 18 }} />
            <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Bulk Generate Payslips</Typography>
            {selectedPeriod && <Chip label={selectedPeriod.period_name} size="small" sx={{ bgcolor: '#6366f115', color: '#6366f1', fontWeight: 600 }} />}
          </Box>
          <Box sx={{ p: 2.5 }}>
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 2 }}>
              Generates payslips from Wrike-approved timelogs. Select employees or generate for all at once.
            </Typography>
            <FormControlLabel
              control={<Checkbox checked={selectAll} onChange={e => handleSelectAll(e.target.checked)} size="small" sx={{ color: '#6366f1', '&.Mui-checked': { color: '#6366f1' } }} />}
              label={<Typography sx={{ fontSize: '0.875rem', fontWeight: 700 }}>All Employees</Typography>}
              sx={{ mb: selectAll ? 0 : 1 }}
            />
            {!selectAll && (
              <Box sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid', borderColor: 'divider', mt: 1 }}>
                <List dense disablePadding>
                  {employees.map(emp => (
                    <ListItem key={emp.id} disablePadding
                      secondaryAction={
                        <Checkbox checked={selectedEmployeeIds.includes(emp.id)}
                          onChange={() => handleToggleEmployee(emp.id)} size="small"
                          sx={{ color: '#6366f1', '&.Mui-checked': { color: '#6366f1' } }} />
                      }
                      sx={{ borderBottom: '1px solid', borderBottomColor: 'divider' }}>
                      <ListItemText
                        primary={emp.name}
                        secondary={emp.employee_id}
                        sx={{ pl: 1.5, '& .MuiListItemText-primary': { fontSize: '0.875rem' }, '& .MuiListItemText-secondary': { fontSize: '0.72rem' } }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <Button variant="contained" startIcon={generating ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <AutoAwesomeIcon />}
                  onClick={handleBulkGenerate} disabled={generating || !selectedPeriod || (!selectAll && selectedEmployeeIds.length === 0)}
                  sx={{ borderRadius: '10px', textTransform: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
                  {generating
                    ? (genProgress?.total > 0 ? `Generating ${genProgress.done} / ${genProgress.total}…` : 'Generating…')
                    : 'Generate Now'}
                </Button>
                {bulkResult && (
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Chip label={`${bulkResult.generated} generated`} size="small" sx={{ bgcolor: '#10b98115', color: '#10b981', fontWeight: 700 }} />
                    {bulkResult.skipped > 0 && <Chip label={`${bulkResult.skipped} skipped`} size="small" sx={{ bgcolor: '#f59e0b15', color: '#f59e0b', fontWeight: 700 }} />}
                    {bulkResult.errors?.length > 0 && <Chip label={`${bulkResult.errors.length} errors`} size="small" sx={{ bgcolor: '#ef444415', color: '#ef4444', fontWeight: 700 }} />}
                  </Box>
                )}
              </Box>
              {generating && (
                <Box sx={{ mt: 1.5 }}>
                  {genProgress?.total > 0 ? (
                    <>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                          {genProgress.current ? `Processing: ${genProgress.current}` : 'Processing employees…'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#6366f1' }}>
                          {Math.round((genProgress.done / genProgress.total) * 100)}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(genProgress.done / genProgress.total) * 100}
                        sx={{ height: 6, borderRadius: 3, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#6366f1', borderRadius: 3 } }}
                      />
                    </>
                  ) : (
                    <LinearProgress
                      variant="indeterminate"
                      sx={{ height: 6, borderRadius: 3, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#6366f1', borderRadius: 3 } }}
                    />
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </Paper>
      )}

      <Grid container spacing={2}>
        {/* Periods sidebar */}
        <Grid item xs={12} md={3}>
          <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderBottomColor: 'divider' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'text.primary', mb: 1 }}>Periods</Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {[{ label: 'All', value: 'all' }, { label: 'Local', value: 'local' }, { label: 'Intl', value: 'foreign' }].map(opt => (
                  <Chip key={opt.value} label={opt.label} size="small" onClick={() => setPeriodTypeFilter(opt.value)}
                    sx={{ fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', height: 20,
                      bgcolor: periodTypeFilter === opt.value ? '#6366f1' : 'action.hover',
                      color: periodTypeFilter === opt.value ? 'white' : 'text.secondary',
                      '&:hover': { bgcolor: periodTypeFilter === opt.value ? '#6366f1' : 'action.selected' } }} />
                ))}
              </Box>
            </Box>
            <Box sx={{ maxHeight: 480, overflowY: 'auto' }}>
              {loading ? (
                <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress size={24} sx={{ color: '#6366f1' }} /></Box>
              ) : periods.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center', color: 'text.disabled', fontSize: '0.875rem' }}>No periods</Box>
              ) : periods
                  .filter(p => periodTypeFilter === 'all' || (periodTypeFilter === 'local' ? (!p.period_type || p.period_type === 'local') : p.period_type === 'foreign'))
                  .map(p => (
                <Box key={p.id} onClick={() => handleSelectPeriod(p)}
                  sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderBottomColor: 'divider', cursor: 'pointer',
                    bgcolor: selectedPeriod?.id === p.id ? 'rgba(99,102,241,0.06)' : 'transparent',
                    '&:hover': { bgcolor: selectedPeriod?.id === p.id ? 'rgba(99,102,241,0.08)' : 'action.hover' } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                    <Typography sx={{ fontWeight: selectedPeriod?.id === p.id ? 700 : 500, fontSize: '0.8rem', color: selectedPeriod?.id === p.id ? '#6366f1' : 'text.primary', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mr: 0.5 }}>
                      {p.period_name}
                    </Typography>
                    <Chip label={p.period_type === 'foreign' ? 'Intl' : 'Local'} size="small"
                      sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, flexShrink: 0,
                        bgcolor: p.period_type === 'foreign' ? '#0ea5e918' : '#6366f118',
                        color: p.period_type === 'foreign' ? '#0ea5e9' : '#6366f1' }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', textTransform: 'capitalize' }}>{p.status}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Payslips table */}
        <Grid item xs={12} md={9}>
          <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Box sx={{ px: 2, py: 2, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'text.primary' }}>
                {selectedPeriod ? selectedPeriod.period_name : 'Select a Period'}
              </Typography>
              <TextField
                placeholder="Search payslips…" value={search} onChange={e => setSearch(e.target.value)} size="small"
                sx={{ width: 220, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'text.disabled', fontSize: 18 }} /></InputAdornment> } }}
              />
            </Box>

            {!selectedPeriod ? (
              <Box sx={{ py: 12, textAlign: 'center', color: 'text.disabled' }}>
                <CalendarMonthIcon sx={{ fontSize: 48, opacity: 0.2, mb: 1 }} />
                <Typography sx={{ fontSize: '0.875rem' }}>Select a period to view payslips</Typography>
              </Box>
            ) : filtered.length === 0 ? (
              <Box sx={{ py: 12, textAlign: 'center', color: 'text.disabled' }}>
                <ReceiptLongIcon sx={{ fontSize: 48, opacity: 0.2, mb: 1 }} />
                <Typography sx={{ fontSize: '0.875rem' }}>No payslips generated for this period</Typography>
              </Box>
            ) : (
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      {['Payslip No.', 'Employee', 'Hours', 'Gross', 'Net', 'Status', 'Actions'].map(h => <TableCell key={h} sx={TH}>{h}</TableCell>)}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map(p => (
                      <TableRow key={p.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                        <TableCell sx={{ ...TD, fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8rem', color: '#6366f1' }}>{p.payslip_number}</TableCell>
                        <TableCell sx={TD}>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.employee_name}</Typography>
                          <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>{p.employee_id}</Typography>
                        </TableCell>
                        <TableCell sx={TD}>{p.total_hours}h</TableCell>
                        <TableCell sx={TD}>{p.currency || ''} {p.gross_amount?.toLocaleString()}</TableCell>
                        <TableCell sx={{ ...TD, fontWeight: 700, color: '#10b981' }}>{p.currency || ''} {p.net_amount?.toLocaleString()}</TableCell>
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
                            <Tooltip title="View PDF">
                              <IconButton size="small" onClick={() => handleViewPDF(p)} disabled={pdfLoading}
                                sx={{ color: '#10b981', '&:hover': { bgcolor: '#10b98115' } }}>
                                {pdfLoading ? <CircularProgress size={12} /> : <DownloadIcon sx={{ fontSize: 16 }} />}
                              </IconButton>
                            </Tooltip>
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
              <Box sx={{ bgcolor: 'action.hover', borderRadius: 0, p: 2, mb: 2 }}>
                <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', mb: 0.25 }}>Payslip Number</Typography>
                <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.1rem', color: '#6366f1' }}>{selected.payslip_number}</Typography>
              </Box>
              <Divider sx={{ mb: 1.5 }} />
              <InfoRow label="Employee" value={selected.employee_name} />
              <InfoRow label="Period" value={selected.period_name} />
              <InfoRow label="Total Hours" value={`${selected.total_hours}h`} />
              <InfoRow label="Hourly Rate" value={`${selected.currency || ''} ${selected.hourly_rate}`} />
              <InfoRow label="Gross Amount" value={`${selected.currency || ''} ${selected.gross_amount?.toLocaleString()}`} />
              <InfoRow label="Deductions" value={`${selected.currency || ''} ${((selected.tax_deductions || 0) + (selected.other_deductions || 0)).toLocaleString()}`} />
              <Box sx={{ background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', borderRadius: 0, p: 2, mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ color: 'white', fontWeight: 600 }}>Net Amount</Typography>
                <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '1.4rem' }}>
                  {selected.currency || ''} {selected.net_amount?.toLocaleString()}
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSelected(null)} sx={{ borderRadius: '10px', textTransform: 'none', color: 'text.secondary' }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Bank File Download Dialog */}
      <Dialog open={bankDlOpen} onClose={() => setBankDlOpen(false)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { borderRadius: '4px' } } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountBalanceIcon sx={{ color: bankDlType === 'foreign' ? '#6366f1' : '#10b981', fontSize: 20 }} />
          Download {bankDlType === 'foreign' ? 'Foreign / SWIFT' : 'Local'} Bank File
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {(() => {
            const fmt = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
            return (
              <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
                <InputLabel shrink>Period</InputLabel>
                <Select value={bankDlPeriodId ?? ''} label="Period" notched displayEmpty
                  onChange={e => setBankDlPeriodId(Number(e.target.value))}
                  renderValue={selected => {
                    const p = periods.find(x => x.id === selected);
                    return p ? p.period_name + (p.start_date ? `  ·  ${fmt(p.start_date)} – ${fmt(p.end_date)}` : '') : <em style={{ color: '#94a3b8' }}>Select a period</em>;
                  }}>
                  {periods.map(p => (
                    <MenuItem key={p.id} value={p.id}>
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{p.period_name}</span>
                        {p.start_date && <Typography component="span" sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>{fmt(p.start_date)} – {fmt(p.end_date)}</Typography>}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            );
          })()}

          {(() => {
            const incompleteCount = employees.filter(e => e.hire_category === bankDlType && getMissingBankFields(e).length > 0).length;
            return incompleteCount > 0 ? (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, bgcolor: '#f59e0b10', border: '1px solid #f59e0b30', borderRadius: '8px', p: 1.5, mb: 2 }}>
                <WarningAmberIcon sx={{ fontSize: 16, color: '#f59e0b', mt: 0.1, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.8rem', color: '#b45309' }}>
                  {incompleteCount} {bankDlType} employee{incompleteCount > 1 ? 's have' : ' has'} incomplete bank profiles and will be excluded from the file. Edit their profiles to include them.
                </Typography>
              </Box>
            ) : null;
          })()}
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'text.secondary', mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Employees</Typography>
          <FormControlLabel
            control={<Checkbox checked={bankDlSelectAll} onChange={e => { setBankDlSelectAll(e.target.checked); setBankDlEmpIds([]); }} size="small"
              sx={{ color: '#6366f1', '&.Mui-checked': { color: '#6366f1' } }} />}
            label={<Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
              All {bankDlType === 'foreign' ? 'Foreign' : 'Local'} Employees ({employees.filter(e => e.hire_category === bankDlType).length})
            </Typography>}
          />
          {!bankDlSelectAll && (
            <Box sx={{ maxHeight: 220, overflowY: 'auto', border: '1px solid', borderColor: 'divider', mt: 1 }}>
              <List dense disablePadding>
                {employees.filter(emp => emp.hire_category === bankDlType).map(emp => {
                  const missing = getMissingBankFields(emp);
                  const incomplete = missing.length > 0;
                  return (
                    <ListItem key={emp.id} disablePadding
                      secondaryAction={
                        <Checkbox checked={bankDlEmpIds.includes(emp.id)}
                          onChange={() => handleBankDlToggleEmp(emp.id)} size="small"
                          sx={{ color: '#6366f1', '&.Mui-checked': { color: '#6366f1' } }} />
                      }
                      sx={{ borderBottom: '1px solid', borderBottomColor: 'divider', opacity: incomplete ? 0.7 : 1 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <span>{emp.name}</span>
                            {incomplete && (
                              <Tooltip title={`Incomplete profile — Missing: ${missing.join(', ')}`} arrow>
                                <WarningAmberIcon sx={{ fontSize: 14, color: '#f59e0b', cursor: 'help' }} />
                              </Tooltip>
                            )}
                          </Box>
                        }
                        secondary={`${emp.employee_id} · ${emp.hire_category}${incomplete ? ' · profile incomplete' : ''}`}
                        sx={{ pl: 1.5, '& .MuiListItemText-primary': { fontSize: '0.875rem' }, '& .MuiListItemText-secondary': { fontSize: '0.72rem', color: incomplete ? '#f59e0b' : 'text.secondary' } }}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setBankDlOpen(false)} sx={{ borderRadius: '10px', textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button variant="contained" startIcon={bankDlLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <DownloadIcon />}
            onClick={handleBankDownload}
            disabled={bankDlLoading || !bankDlPeriodId || (!bankDlSelectAll && bankDlEmpIds.length === 0)}
            sx={{ borderRadius: '10px', textTransform: 'none', background: bankDlType === 'foreign' ? 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' : 'linear-gradient(135deg, #10b981 0%, #34d399 100%)', boxShadow: '0 4px 12px rgba(99,102,241,0.25)' }}>
            {bankDlLoading ? 'Downloading…' : 'Download'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* PDF Viewer Dialog */}
      <Dialog open={!!pdfViewerUrl} onClose={closePdfViewer} maxWidth="lg" fullWidth
        slotProps={{ paper: { sx: { borderRadius: '4px', height: '90vh' } } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{pdfViewerName}</span>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" variant="outlined" startIcon={<DownloadIcon />}
              component="a" href={pdfViewerUrl} download={`${pdfViewerName}.pdf`}
              sx={{ borderRadius: '8px', textTransform: 'none', borderColor: 'divider', color: 'text.secondary' }}>
              Download
            </Button>
            <Button size="small" onClick={closePdfViewer}
              sx={{ borderRadius: '8px', textTransform: 'none', color: 'text.secondary' }}>
              Close
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
          {pdfViewerUrl && (
            <iframe src={pdfViewerUrl} title={pdfViewerName}
              style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
