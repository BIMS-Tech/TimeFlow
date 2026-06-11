import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, CircularProgress, Chip, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tooltip, Checkbox, FormControlLabel, List, ListItem, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PeopleIcon from '@mui/icons-material/People';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { timesheetAPI, payslipsAPI, employeesAPI } from '../api';
import { getMissingBankFields } from '../utils/employeeProfile';

const TH = { fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', py: 1.5, px: 2 };
const TD = { fontSize: '0.85rem', color: 'text.primary', py: 1.5, px: 2 };

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StepDot({ done, label, sublabel, color = '#6366f1' }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
      <Box sx={{ mt: 0.25, flexShrink: 0 }}>
        {done
          ? <CheckCircleIcon sx={{ fontSize: 20, color }} />
          : <RadioButtonUncheckedIcon sx={{ fontSize: 20, color: 'text.disabled' }} />}
      </Box>
      <Box>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: done ? 700 : 500, color: done ? color : 'text.secondary', lineHeight: 1.3 }}>
          {label}
        </Typography>
        {sublabel && (
          <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', mt: 0.25 }}>{sublabel}</Typography>
        )}
      </Box>
    </Box>
  );
}

export default function GenerateBankUpload() {
  const [periods, setPeriods]             = useState([]);
  const [periodTypeFilter, setPeriodTypeFilter] = useState('all');
  const [periodSearch, setPeriodSearch]   = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [payslips, setPayslips]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [employees, setEmployees]         = useState([]);

  const [dlOpen, setDlOpen]               = useState(false);
  const [dlType, setDlType]               = useState('local');
  const [dlEmpIds, setDlEmpIds]           = useState([]);
  const [dlSelectAll, setDlSelectAll]     = useState(true);
  const [dlLoading, setDlLoading]         = useState(false);

  const [markingUploaded, setMarkingUploaded] = useState(false);

  useEffect(() => { fetchPeriods(); fetchEmployees(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPeriods = async () => {
    try {
      setLoading(true);
      const res = await timesheetAPI.getPeriods(100, 0);
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

  const handleSelectPeriod = (p) => { setSelectedPeriod(p); fetchPayslips(p.id); };

  const openDownload = (type) => { setDlType(type); setDlEmpIds([]); setDlSelectAll(true); setDlOpen(true); };

  const handleDownload = async () => {
    if (!selectedPeriod) return;
    setDlLoading(true);
    try {
      await payslipsAPI.downloadBankFile(selectedPeriod.id, dlType, dlSelectAll ? null : dlEmpIds);
      // Record the download against this period
      const updated = await timesheetAPI.markBankDownloaded(selectedPeriod.id, dlType);
      if (updated?.success) {
        setSelectedPeriod(updated.data);
        setPeriods(ps => ps.map(p => p.id === updated.data.id ? updated.data : p));
      }
      setDlOpen(false);
      toast.success(`${dlType === 'foreign' ? 'Foreign' : 'Local'} bank file downloaded for ${selectedPeriod.period_name}`);
    } catch (e) { toast.error(e.message || 'Download failed'); }
    finally { setDlLoading(false); }
  };

  const handleMarkUploaded = async () => {
    if (!selectedPeriod) return;
    setMarkingUploaded(true);
    try {
      const res = await timesheetAPI.markBankUploaded(selectedPeriod.id);
      if (res.success) {
        setSelectedPeriod(res.data);
        setPeriods(ps => ps.map(p => p.id === res.data.id ? res.data : p));
        toast.success(`${selectedPeriod.period_name} marked as bank uploaded`);
      }
    } catch (e) { toast.error(e.response?.data?.error || e.message || 'Failed'); }
    finally { setMarkingUploaded(false); }
  };

  const filteredPeriods = periods.filter(p => {
    const typeMatch = periodTypeFilter === 'all' ||
      (periodTypeFilter === 'local' ? (!p.period_type || p.period_type === 'local') : p.period_type === 'foreign');
    const searchMatch = !periodSearch || p.period_name.toLowerCase().includes(periodSearch.toLowerCase());
    return typeMatch && searchMatch;
  });

  const totalNet   = payslips.reduce((s, p) => s + (parseFloat(p.net_amount) || 0), 0);

  const isLocal   = !selectedPeriod?.period_type || selectedPeriod?.period_type === 'local';
  const localDone  = !!selectedPeriod?.local_bank_downloaded_at;
  const foreignDone = !!selectedPeriod?.foreign_bank_downloaded_at;
  const uploadDone  = !!selectedPeriod?.bank_uploaded_at;

  // Step logic: local period needs local download; foreign needs foreign download
  const relevantDownloadDone = isLocal ? localDone : foreignDone;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #10b981, #34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <AccountBalanceIcon sx={{ color: 'white', fontSize: 18 }} />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Generate Bank Upload</Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>Select a pay period → download the bank file → upload to your bank → confirm here</Typography>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ alignItems: 'stretch' }}>

        {/* Left: period list */}
        <Grid item xs={12} md={3}>
          <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: 2, py: 1.75, borderBottom: '1px solid', borderBottomColor: 'divider' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', mb: 1 }}>Pay Periods</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                {[{ label: 'All', value: 'all' }, { label: 'Local', value: 'local' }, { label: 'Intl', value: 'foreign' }].map(opt => (
                  <Chip key={opt.value} label={opt.label} size="small" onClick={() => setPeriodTypeFilter(opt.value)}
                    sx={{ height: 22, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                      bgcolor: periodTypeFilter === opt.value ? '#10b981' : 'action.hover',
                      color:   periodTypeFilter === opt.value ? 'white'   : 'text.secondary' }} />
                ))}
              </Box>
              <TextField fullWidth size="small" placeholder="Search periods…" value={periodSearch} onChange={e => setPeriodSearch(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '0.82rem' } }}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 15, color: 'text.disabled' }} /></InputAdornment> } }} />
            </Box>
            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}><CircularProgress size={22} sx={{ color: '#10b981' }} /></Box>
              ) : filteredPeriods.map(p => {
                const active = selectedPeriod?.id === p.id;
                const pLocal  = !p.period_type || p.period_type === 'local';
                const pDlDone = pLocal ? !!p.local_bank_downloaded_at : !!p.foreign_bank_downloaded_at;
                const pUploaded = !!p.bank_uploaded_at;
                return (
                  <Box key={p.id} onClick={() => handleSelectPeriod(p)}
                    sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderBottomColor: 'divider', cursor: 'pointer',
                      bgcolor: active ? 'rgba(16,185,129,0.06)' : 'transparent',
                      borderLeft: active ? '3px solid #10b981' : '3px solid transparent',
                      transition: 'all 0.15s', '&:hover': { bgcolor: active ? 'rgba(16,185,129,0.08)' : 'action.hover' } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.25 }}>
                      <Typography sx={{ fontWeight: active ? 700 : 500, fontSize: '0.8rem', color: active ? '#10b981' : 'text.primary', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mr: 0.5 }}>
                        {p.period_name}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0 }}>
                        <Chip label={p.period_type === 'foreign' ? 'Intl' : 'LCL'} size="small"
                          sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700,
                            bgcolor: p.period_type === 'foreign' ? '#0ea5e918' : '#6366f118',
                            color:   p.period_type === 'foreign' ? '#0ea5e9'   : '#6366f1' }} />
                        {pUploaded && <Tooltip title={`Uploaded ${fmtTime(p.bank_uploaded_at)}`} arrow><CheckCircleIcon sx={{ fontSize: 13, color: '#10b981' }} /></Tooltip>}
                        {!pUploaded && pDlDone && <Tooltip title="File downloaded, not yet uploaded" arrow><DownloadIcon sx={{ fontSize: 13, color: '#f59e0b' }} /></Tooltip>}
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
                      {fmtDate(p.start_date)} – {fmtDate(p.end_date)}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        </Grid>

        {/* Right: workflow for selected period */}
        <Grid item xs={12} md={9}>
          {!selectedPeriod ? (
            <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', py: 14, textAlign: 'center', color: 'text.disabled' }}>
              <CalendarMonthIcon sx={{ fontSize: 40, opacity: 0.2, mb: 1.5 }} />
              <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', mb: 0.5 }}>Select a Pay Period</Typography>
              <Typography sx={{ fontSize: '0.8rem' }}>Choose a period from the left to begin the bank upload process</Typography>
            </Paper>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

              {/* Step tracker */}
              <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: uploadDone ? '#10b98140' : 'divider', p: 2.5, bgcolor: uploadDone ? '#10b98108' : 'background.paper' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary' }}>
                      {selectedPeriod.period_name}
                    </Typography>
                    <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                      {fmtDate(selectedPeriod.start_date)} – {fmtDate(selectedPeriod.end_date)} · {payslips.length} payslip{payslips.length !== 1 ? 's' : ''} · {selectedPeriod.period_type === 'foreign' ? 'International' : 'Local'}
                    </Typography>
                  </Box>
                  {uploadDone && (
                    <Chip icon={<CheckCircleIcon />} label="Bank Upload Complete" size="small"
                      sx={{ bgcolor: '#10b98115', color: '#10b981', fontWeight: 700, '& .MuiChip-icon': { color: '#10b981', fontSize: 14 } }} />
                  )}
                </Box>

                {/* Step checklist */}
                <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  <StepDot
                    done={payslips.length > 0}
                    label="Step 1 — Payslips generated"
                    sublabel={payslips.length > 0 ? `${payslips.length} payslip${payslips.length !== 1 ? 's' : ''} ready` : 'Run Process Payroll first'}
                    color="#6366f1"
                  />
                  <StepDot
                    done={relevantDownloadDone}
                    label={`Step 2 — ${isLocal ? 'Local' : 'Foreign'} bank file downloaded`}
                    sublabel={relevantDownloadDone ? `Downloaded ${fmtTime(isLocal ? selectedPeriod.local_bank_downloaded_at : selectedPeriod.foreign_bank_downloaded_at)}` : 'Click download button below'}
                    color="#f59e0b"
                  />
                  <StepDot
                    done={uploadDone}
                    label="Step 3 — Uploaded to bank & confirmed"
                    sublabel={uploadDone ? `Confirmed ${fmtTime(selectedPeriod.bank_uploaded_at)}` : 'Click "Confirm Bank Upload" after uploading'}
                    color="#10b981"
                  />
                </Box>

                {/* Action buttons */}
                <Box sx={{ display: 'flex', gap: 1.5, mt: 2.5, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Button variant="outlined" startIcon={<DownloadIcon />}
                    onClick={() => openDownload('local')}
                    disabled={payslips.length === 0}
                    sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem',
                      borderColor: localDone ? '#10b981' : 'divider',
                      color: localDone ? '#10b981' : 'text.secondary',
                      '&:hover': { borderColor: '#10b981', color: '#10b981' } }}>
                    {localDone ? 'Re-download Local File' : 'Download Local Bank File'}
                  </Button>
                  <Button variant="outlined" startIcon={<DownloadIcon />}
                    onClick={() => openDownload('foreign')}
                    disabled={payslips.length === 0}
                    sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem',
                      borderColor: foreignDone ? '#10b981' : 'divider',
                      color: foreignDone ? '#10b981' : 'text.secondary',
                      '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
                    {foreignDone ? 'Re-download Foreign File' : 'Download Foreign Bank File'}
                  </Button>
                  <Button variant="contained"
                    startIcon={markingUploaded ? <CircularProgress size={14} sx={{ color: 'white' }} /> : uploadDone ? <CheckCircleIcon /> : <CheckCircleIcon />}
                    onClick={handleMarkUploaded}
                    disabled={markingUploaded || uploadDone || !relevantDownloadDone}
                    sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600, fontSize: '0.82rem',
                      background: uploadDone ? 'linear-gradient(135deg, #10b981, #34d399)' : 'linear-gradient(135deg, #6366f1, #818cf8)',
                      boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
                    {markingUploaded ? 'Saving…' : uploadDone ? `Confirmed ${fmtDate(selectedPeriod.bank_uploaded_at)}` : 'Confirm Bank Upload'}
                  </Button>
                  {!relevantDownloadDone && !uploadDone && (
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', fontStyle: 'italic' }}>
                      Download the bank file first to enable confirmation
                    </Typography>
                  )}
                </Box>
              </Paper>

              {/* Payslips table */}
              {payslips.length > 0 && (
                <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                  <Box sx={{ px: 2.5, py: 1.75, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', gap: 3, alignItems: 'center', bgcolor: 'action.hover' }}>
                    {[
                      { icon: <PeopleIcon sx={{ fontSize: 15 }} />, label: 'Employees', value: payslips.length, color: '#6366f1' },
                      { icon: <MonetizationOnIcon sx={{ fontSize: 15 }} />, label: 'Total Net', value: `${payslips[0]?.currency || ''} ${totalNet.toLocaleString()}`, color: '#10b981' },
                    ].map((s, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Box sx={{ color: s.color }}>{s.icon}</Box>
                        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{s.label}:</Typography>
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'text.primary' }}>{s.value}</Typography>
                      </Box>
                    ))}
                  </Box>
                  <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {['Payslip No.', 'Employee', 'Hours', 'Net Pay', 'Status'].map(h => (
                            <TableCell key={h} sx={TH}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {payslips.map(p => (
                          <TableRow key={p.id} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                            <TableCell sx={{ ...TD, fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem', color: '#10b981' }}>
                              {p.payslip_number}
                            </TableCell>
                            <TableCell sx={TD}>
                              <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.2 }}>{p.employee_name}</Typography>
                              <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>{p.emp_code || p.employee_id}</Typography>
                            </TableCell>
                            <TableCell sx={TD}>{p.total_hours}h</TableCell>
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
                </Paper>
              )}

              {payslips.length === 0 && (
                <Paper elevation={0} sx={{ borderRadius: '16px', border: '1px solid', borderColor: 'divider', py: 8, textAlign: 'center', color: 'text.disabled' }}>
                  <ReceiptLongIcon sx={{ fontSize: 36, opacity: 0.2, mb: 1.5 }} />
                  <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', mb: 0.5 }}>No Payslips Yet</Typography>
                  <Typography sx={{ fontSize: '0.8rem' }}>Run <strong>Process Payroll</strong> for this period first</Typography>
                </Paper>
              )}
            </Box>
          )}
        </Grid>
      </Grid>

      {/* Download dialog */}
      <Dialog open={dlOpen} onClose={() => setDlOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountBalanceIcon sx={{ color: dlType === 'foreign' ? '#6366f1' : '#10b981', fontSize: 20 }} />
          Download {dlType === 'foreign' ? 'Foreign / SWIFT' : 'Local'} Bank File
          <Typography component="span" sx={{ fontSize: '0.8rem', color: 'text.secondary', fontWeight: 400, ml: 0.5 }}>
            — {selectedPeriod?.period_name}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {(() => {
            const incompleteCount = employees.filter(e => e.hire_category === dlType && getMissingBankFields(e).length > 0).length;
            return incompleteCount > 0 ? (
              <Box sx={{ display: 'flex', gap: 1, bgcolor: '#f59e0b10', border: '1px solid #f59e0b30', borderRadius: '10px', p: 1.5, mb: 2 }}>
                <WarningAmberIcon sx={{ fontSize: 15, color: '#f59e0b', mt: 0.1, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.8rem', color: '#b45309' }}>
                  {incompleteCount} employee{incompleteCount > 1 ? 's have' : ' has'} incomplete bank profiles and will be excluded.
                </Typography>
              </Box>
            ) : null;
          })()}
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', mb: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Include Employees</Typography>
          <FormControlLabel
            control={<Checkbox checked={dlSelectAll} onChange={e => { setDlSelectAll(e.target.checked); setDlEmpIds([]); }} size="small" sx={{ color: '#10b981', '&.Mui-checked': { color: '#10b981' } }} />}
            label={<Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>All {dlType === 'foreign' ? 'Foreign' : 'Local'} Employees ({employees.filter(e => e.hire_category === dlType).length})</Typography>}
          />
          {!dlSelectAll && (
            <Box sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid', borderColor: 'divider', mt: 1, borderRadius: '10px', overflow: 'hidden' }}>
              <List dense disablePadding>
                {employees.filter(e => e.hire_category === dlType).map(emp => {
                  const missing = getMissingBankFields(emp);
                  const incomplete = missing.length > 0;
                  return (
                    <ListItem key={emp.id} disablePadding
                      secondaryAction={<Checkbox checked={dlEmpIds.includes(emp.id)} onChange={() => setDlEmpIds(prev => prev.includes(emp.id) ? prev.filter(x => x !== emp.id) : [...prev, emp.id])} size="small" sx={{ color: '#10b981', '&.Mui-checked': { color: '#10b981' } }} />}
                      sx={{ borderBottom: '1px solid', borderBottomColor: 'divider', opacity: incomplete ? 0.65 : 1 }}>
                      <ListItemText
                        primary={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><span>{emp.name}</span>{incomplete && <Tooltip title={`Missing: ${missing.join(', ')}`} arrow><WarningAmberIcon sx={{ fontSize: 13, color: '#f59e0b' }} /></Tooltip>}</Box>}
                        secondary={`${emp.employee_id}${incomplete ? ' · profile incomplete' : ''}`}
                        sx={{ pl: 1.5, '& .MuiListItemText-primary': { fontSize: '0.875rem' }, '& .MuiListItemText-secondary': { fontSize: '0.72rem' } }}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDlOpen(false)} sx={{ borderRadius: '10px', textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button variant="contained"
            startIcon={dlLoading ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <DownloadIcon />}
            onClick={handleDownload}
            disabled={dlLoading || (!dlSelectAll && dlEmpIds.length === 0)}
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600,
              background: dlType === 'foreign' ? 'linear-gradient(135deg, #6366f1, #818cf8)' : 'linear-gradient(135deg, #10b981, #34d399)',
              boxShadow: '0 4px 12px rgba(99,102,241,0.25)' }}>
            {dlLoading ? 'Downloading…' : 'Download File'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
