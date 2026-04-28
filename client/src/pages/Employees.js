import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, MenuItem, Select, FormControl, InputLabel, CircularProgress, Avatar
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import PersonIcon from '@mui/icons-material/Person';
import ShieldIcon from '@mui/icons-material/Shield';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import KeyIcon from '@mui/icons-material/Key';
import LinkIcon from '@mui/icons-material/Link';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { employeesAPI, wrikeAPI } from '../api';
import { getMissingBankFields } from '../utils/employeeProfile';

const TH = { fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', py: 1.5, px: 2 };
const TD = { fontSize: '0.875rem', color: 'text.primary', py: 1.5, px: 2 };

const EMPLOYEE_TYPES = [
  { value: 'FTE-LCL',  label: 'FTE-LCL — Full-Time Employee (Local)',           category: 'local'   },
  { value: 'FTE-INTL', label: 'FTE-INTL — Full-Time Employee (International)',   category: 'foreign' },
  { value: 'PTE-WB',   label: 'PTE-WB — Part-Time with Benefits',               category: 'local'   },
  { value: 'PTE-WOB',  label: 'PTE-WOB — Part-Time without Benefits',           category: 'local'   },
  { value: 'PTE-INTL', label: 'PTE-INTL — Part-Time (International)',           category: 'foreign' },
  { value: 'PB-LCL',   label: 'PB-LCL — Project-Based (Local)',                 category: 'local'   },
  { value: 'PB-INTL',  label: 'PB-INTL — Project-Based (International)',        category: 'foreign' },
];

function deriveHireCategory(employeeType) {
  const found = EMPLOYEE_TYPES.find(t => t.value === employeeType);
  return found ? found.category : 'local';
}

const EMPTY_FORM = {
  employee_id: '', name: '', email: '', department: '', position: '',
  hourly_rate: 500, currency: 'PHP', employee_type: '', employment_type: 'full_time', hire_category: 'local',
  wrike_user_id: '', hire_date: '',
  // Government IDs (PH)
  sss_number: '', philhealth_number: '', pagibig_number: '', payee_tin: '',
  // Name parts (XCS local bank file)
  first_name: '', last_name: '', middle_name: '',
  // Bank details
  bank_name: '', bank_account_number: '', bank_account_name: '', bank_branch: '', bank_swift_code: '',
  // DFT international fields
  remittance_type: '', beneficiary_code: '', beneficiary_address: '', bank_address: '',
  country_of_destination: '', purpose_nature: '',
  intermediary_bank_name: '', intermediary_bank_address: '', intermediary_bank_swift: '',
  payee_zip_code: '', payee_foreign_address: '', payee_foreign_zip_code: '',
  tax_code: '',
};

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [portalCreds, setPortalCreds] = useState(null);
  const [wrikeContacts, setWrikeContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [portalOverrides, setPortalOverrides] = useState({});

  useEffect(() => { fetchEmployees(); }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await employeesAPI.getAll(false);
      if (res.success) setEmployees(res.data || []);
    } catch { toast.error('Failed to load employees'); }
    finally { setLoading(false); }
  };

  const openModal = (emp = null) => {
    setEditing(emp);
    setForm(emp ? {
      employee_id: emp.employee_id, name: emp.name, email: emp.email,
      department: emp.department || '', position: emp.position || '',
      hourly_rate: emp.hourly_rate, currency: emp.currency || 'PHP',
      employee_type: emp.employee_type || '',
      employment_type: emp.employment_type || 'full_time',
      hire_category: emp.hire_category || 'local',
      wrike_user_id: emp.wrike_user_id || '',
      hire_date: emp.hire_date ? emp.hire_date.split('T')[0] : '',
      sss_number: emp.sss_number || '',
      philhealth_number: emp.philhealth_number || '',
      pagibig_number: emp.pagibig_number || '',
      payee_tin: emp.payee_tin || '',
      first_name: emp.first_name || '', last_name: emp.last_name || '', middle_name: emp.middle_name || '',
      bank_name: emp.bank_name || '', bank_account_number: emp.bank_account_number || '',
      bank_account_name: emp.bank_account_name || '', bank_branch: emp.bank_branch || '',
      bank_swift_code: emp.bank_swift_code || '',
      remittance_type: emp.remittance_type || '', beneficiary_code: emp.beneficiary_code || '',
      beneficiary_address: emp.beneficiary_address || '', bank_address: emp.bank_address || '',
      country_of_destination: emp.country_of_destination || '', purpose_nature: emp.purpose_nature || '',
      intermediary_bank_name: emp.intermediary_bank_name || '',
      intermediary_bank_address: emp.intermediary_bank_address || '',
      intermediary_bank_swift: emp.intermediary_bank_swift || '',
      payee_zip_code: emp.payee_zip_code || '',
      payee_foreign_address: emp.payee_foreign_address || '',
      payee_foreign_zip_code: emp.payee_foreign_zip_code || '',
      tax_code: emp.tax_code || '',
    } : EMPTY_FORM);
    setShowModal(true);
    setShowContactPicker(false);
  };

  const closeModal = () => { setShowModal(false); setEditing(null); setForm(EMPTY_FORM); setShowContactPicker(false); };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      if (editing) {
        const res = await employeesAPI.update(editing.id, form);
        if (res.success) { toast.success('Employee updated'); fetchEmployees(); closeModal(); }
      } else {
        const res = await employeesAPI.create(form);
        if (res.success) {
          fetchEmployees(); closeModal();
          if (res.portalAccount) setPortalCreds(res.portalAccount);
          else toast.success('Employee created');
        }
      }
    } catch (e) { toast.error(e.response?.data?.error || 'Operation failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (emp) => {
    if (!window.confirm(`Delete ${emp.name}?`)) return;
    try {
      const res = await employeesAPI.delete(emp.id);
      if (res.success) { toast.success('Employee deleted'); fetchEmployees(); }
    } catch { toast.error('Failed to delete employee'); }
  };

  const handleToggleActive = async (emp) => {
    try {
      const res = emp.is_active ? await employeesAPI.deactivate(emp.id) : await employeesAPI.activate(emp.id);
      if (res.success) { toast.success(`Employee ${emp.is_active ? 'deactivated' : 'activated'}`); fetchEmployees(); }
    } catch { toast.error('Operation failed'); }
  };

  const handleCreatePortal = async (emp) => {
    if (!window.confirm(`Create portal account for ${emp.name}?`)) return;
    try {
      const res = await employeesAPI.createPortalAccount(emp.id);
      if (res.success) { setPortalCreds(res.data); fetchEmployees(); }
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handleRevokeAccess = async (emp) => {
    if (!window.confirm(`Revoke portal access for ${emp.name}?`)) return;
    try {
      await employeesAPI.revokeAccess(emp.id);
      toast.success('Access revoked');
      setPortalOverrides(p => ({ ...p, [emp.id]: false }));
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handleRestoreAccess = async (emp) => {
    try {
      await employeesAPI.restoreAccess(emp.id);
      toast.success('Access restored');
      setPortalOverrides(p => ({ ...p, [emp.id]: true }));
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handleResetPassword = async (emp) => {
    if (!window.confirm(`Reset portal password for ${emp.name}?`)) return;
    try {
      const res = await employeesAPI.resetPassword(emp.id);
      if (res.success) setPortalCreds({ ...res.data, isReset: true });
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handleLookupWrike = async () => {
    setLoadingContacts(true);
    setShowContactPicker(true);
    setContactSearch('');
    try {
      const res = await wrikeAPI.getContacts();
      setWrikeContacts(res.data || []);
      if (!res.data?.length) toast('No Wrike contacts found.', { icon: '⚠️' });
    } catch { toast.error('Failed to load Wrike contacts'); setShowContactPicker(false); }
    finally { setLoadingContacts(false); }
  };

  const filtered = employees.filter(emp =>
    emp.name.toLowerCase().includes(search.toLowerCase()) ||
    emp.email.toLowerCase().includes(search.toLowerCase()) ||
    emp.employee_id.toLowerCase().includes(search.toLowerCase())
  );

  const filteredContacts = wrikeContacts.filter(c => {
    const q = contactSearch.toLowerCase();
    return !q || `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || (c.profiles?.[0]?.email || '').toLowerCase().includes(q);
  });

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>Employees</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => openModal()}
          sx={{ borderRadius: '10px', textTransform: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }}>
          Add Employee
        </Button>
      </Box>

      {/* Search */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: 0, border: '1px solid', borderColor: 'divider', mb: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <TextField
          placeholder="Search by name, email or ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          size="small"
          sx={{ width: 340, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'text.disabled', fontSize: 20 }} /></InputAdornment> } }}
        />
      </Paper>

      {/* Table */}
      <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                {['Employee', 'Contact', 'Department', 'Rate', 'Gov IDs', 'Bank Profile', 'Wrike', 'Portal', 'Status', 'Actions'].map(h => (
                  <TableCell key={h} sx={TH}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={32} sx={{ color: '#6366f1' }} /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>No employees found</TableCell></TableRow>
              ) : filtered.map(emp => {
                const hasPortal = !!emp.portal_user_id;
                const portalActive = emp.id in portalOverrides ? portalOverrides[emp.id] : !!emp.portal_active;
                return (
                  <TableRow key={emp.id} sx={{ '&:hover': { bgcolor: 'action.hover' }, opacity: emp.is_active ? 1 : 0.6 }}>
                    <TableCell sx={TD}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 34, height: 34, fontSize: '0.8rem', fontWeight: 700, bgcolor: '#6366f115', color: '#6366f1' }}>
                          {emp.name.slice(0, 2).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: 'text.primary' }}>{emp.name}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                            <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>{emp.employee_id}</Typography>
                            {emp.employee_type && (
                              <Chip
                                label={emp.employee_type}
                                size="small"
                                sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700,
                                  bgcolor: emp.hire_category === 'foreign' ? '#0ea5e918' : '#6366f118',
                                  color: emp.hire_category === 'foreign' ? '#0ea5e9' : '#6366f1' }}
                              />
                            )}
                          </Box>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={TD}>{emp.email}</TableCell>
                    <TableCell sx={TD}>{emp.department || <span style={{ color: '#94a3b8' }}>—</span>}</TableCell>
                    <TableCell sx={TD}>{emp.currency} {emp.hourly_rate}/hr</TableCell>
                    <TableCell sx={{ ...TD, textAlign: 'center' }}>
                      {emp.hire_category === 'local' ? (() => {
                        const hasSSS       = !!emp.sss_number;
                        const hasPhil      = !!emp.philhealth_number;
                        const hasPagibig   = !!emp.pagibig_number;
                        const hasTIN       = !!emp.payee_tin;
                        const filled = [hasSSS, hasPhil, hasPagibig, hasTIN].filter(Boolean).length;
                        const missingIds = [
                          !hasSSS     && 'SSS',
                          !hasPhil    && 'PhilHealth',
                          !hasPagibig && 'Pag-IBIG',
                          !hasTIN     && 'TIN',
                        ].filter(Boolean);
                        return filled === 4
                          ? <Chip label="Complete" size="small" icon={<CheckCircleIcon />}
                              sx={{ bgcolor: '#10b98115', color: '#10b981', fontWeight: 600, fontSize: '0.72rem', '& .MuiChip-icon': { fontSize: 14, color: '#10b981' } }} />
                          : <Tooltip title={`Missing: ${missingIds.join(', ')}`} arrow>
                              <Chip label={`${filled}/4`} size="small" icon={<WarningAmberIcon />}
                                sx={{ bgcolor: '#f59e0b15', color: '#f59e0b', fontWeight: 600, fontSize: '0.72rem', cursor: 'help', '& .MuiChip-icon': { fontSize: 14, color: '#f59e0b' } }} />
                            </Tooltip>;
                      })()
                      : <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>N/A</Typography>}
                    </TableCell>
                    <TableCell sx={{ ...TD, textAlign: 'center' }}>
                      {(() => {
                        const missing = getMissingBankFields(emp);
                        return missing.length === 0
                          ? <Chip label="Complete" size="small" icon={<CheckCircleIcon />}
                              sx={{ bgcolor: '#10b98115', color: '#10b981', fontWeight: 600, fontSize: '0.72rem', '& .MuiChip-icon': { fontSize: 14, color: '#10b981' } }} />
                          : <Tooltip title={`Missing: ${missing.join(', ')}`} arrow>
                              <Chip label={`${missing.length} missing`} size="small" icon={<WarningAmberIcon />}
                                sx={{ bgcolor: '#f59e0b15', color: '#f59e0b', fontWeight: 600, fontSize: '0.72rem', cursor: 'help', '& .MuiChip-icon': { fontSize: 14, color: '#f59e0b' } }} />
                            </Tooltip>;
                      })()}
                    </TableCell>
                    <TableCell sx={{ ...TD, textAlign: 'center' }}>
                      {emp.wrike_user_id
                        ? <Chip label="Linked" size="small" icon={<CheckCircleIcon />} sx={{ bgcolor: '#10b98115', color: '#10b981', fontWeight: 600, fontSize: '0.72rem', '& .MuiChip-icon': { fontSize: 14, color: '#10b981' } }} />
                        : <Chip label="Not set" size="small" icon={<WarningAmberIcon />} sx={{ bgcolor: '#f59e0b15', color: '#f59e0b', fontWeight: 600, fontSize: '0.72rem', '& .MuiChip-icon': { fontSize: 14, color: '#f59e0b' } }} />}
                    </TableCell>
                    <TableCell sx={{ ...TD, textAlign: 'center' }}>
                      {hasPortal
                        ? <Chip label={portalActive ? emp.portal_username : 'Revoked'} size="small"
                            sx={{ bgcolor: portalActive ? '#10b98115' : '#ef444415', color: portalActive ? '#10b981' : '#ef4444', fontWeight: 600, fontSize: '0.72rem' }} />
                        : <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>No account</Typography>}
                    </TableCell>
                    <TableCell sx={TD}>
                      <Chip label={emp.is_active ? 'Active' : 'Inactive'} size="small"
                        sx={{ bgcolor: emp.is_active ? '#10b98115' : '#64748b15', color: emp.is_active ? '#10b981' : '#64748b', fontWeight: 600, fontSize: '0.72rem' }} />
                    </TableCell>
                    <TableCell sx={TD}>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        <Tooltip title="Edit"><IconButton size="small" onClick={() => openModal(emp)} sx={{ color: '#6366f1', '&:hover': { bgcolor: '#6366f115' } }}><EditIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                        <Tooltip title={emp.is_active ? 'Deactivate' : 'Activate'}><IconButton size="small" onClick={() => handleToggleActive(emp)} sx={{ color: emp.is_active ? '#f59e0b' : '#10b981', '&:hover': { bgcolor: emp.is_active ? '#f59e0b15' : '#10b98115' } }}>{emp.is_active ? <PersonOffIcon sx={{ fontSize: 16 }} /> : <PersonIcon sx={{ fontSize: 16 }} />}</IconButton></Tooltip>
                        {!hasPortal && <Tooltip title="Create portal account"><IconButton size="small" onClick={() => handleCreatePortal(emp)} sx={{ color: '#6366f1', '&:hover': { bgcolor: '#6366f115' } }}><ShieldIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>}
                        {hasPortal && <>
                          <Tooltip title="Reset password"><IconButton size="small" onClick={() => handleResetPassword(emp)} sx={{ color: 'text.secondary', '&:hover': { bgcolor: '#64748b15' } }}><KeyIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                          {portalActive
                            ? <Tooltip title="Revoke access"><IconButton size="small" onClick={() => handleRevokeAccess(emp)} sx={{ color: '#ef4444', '&:hover': { bgcolor: '#ef444415' } }}><ShieldOutlinedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                            : <Tooltip title="Restore access"><IconButton size="small" onClick={() => handleRestoreAccess(emp)} sx={{ color: '#10b981', '&:hover': { bgcolor: '#10b98115' } }}><ShieldIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>}
                        </>}
                        <Tooltip title="Delete"><IconButton size="small" onClick={() => handleDelete(emp)} sx={{ color: '#ef4444', '&:hover': { bgcolor: '#ef444415' } }}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={showModal} onClose={closeModal} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '4px' } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.1rem', pb: 1 }}>
          {editing ? 'Edit Employee' : 'Add Employee'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {/* Row 1: ID · Name · Email */}
            <Grid item xs={3}>
              <TextField fullWidth label="Employee ID *" value={form.employee_id} disabled={!!editing}
                onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
            </Grid>
            <Grid item xs={4}><TextField fullWidth label="Full Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
            <Grid item xs={5}><TextField fullWidth label="Email *" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
            {/* Row 2: Dept · Position · Hire Date */}
            <Grid item xs={4}><TextField fullWidth label="Department" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
            <Grid item xs={5}><TextField fullWidth label="Position" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
            <Grid item xs={3}><TextField fullWidth label="Hire Date" type="date" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))} size="small" slotProps={{ inputLabel: { shrink: true } }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
            {/* Row 3: Rate · Currency · Employee Type */}
            <Grid item xs={3}><TextField fullWidth label="Hourly Rate" type="number" value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: parseFloat(e.target.value) }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
            <Grid item xs={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Currency</InputLabel>
                <Select label="Currency" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} sx={{ borderRadius: '10px' }}>
                  <MenuItem value="PHP">PHP ₱</MenuItem>
                  <MenuItem value="USD">USD $</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={7}>
              <FormControl fullWidth size="small">
                <InputLabel>Employee Type</InputLabel>
                <Select
                  label="Employee Type"
                  value={form.employee_type}
                  onChange={e => {
                    const et = e.target.value;
                    setForm(f => ({ ...f, employee_type: et, hire_category: deriveHireCategory(et) }));
                  }}
                  sx={{ borderRadius: '10px' }}
                >
                  <MenuItem value=""><em>— Select type —</em></MenuItem>
                  {EMPLOYEE_TYPES.map(t => (
                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Government IDs — shown for local types */}
            {form.hire_category === 'local' && (
              <Grid item xs={12}>
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2 }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>Government IDs</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={3}><TextField fullWidth label="SSS No." placeholder="XX-XXXXXXX-X" value={form.sss_number} onChange={e => setForm(f => ({ ...f, sss_number: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                    <Grid item xs={3}><TextField fullWidth label="PhilHealth No." placeholder="XX-XXXXXXXXX-X" value={form.philhealth_number} onChange={e => setForm(f => ({ ...f, philhealth_number: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                    <Grid item xs={3}><TextField fullWidth label="Pag-IBIG No." placeholder="XXXX-XXXX-XXXX" value={form.pagibig_number} onChange={e => setForm(f => ({ ...f, pagibig_number: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                    <Grid item xs={3}><TextField fullWidth label="TIN (BIR)" placeholder="XXX-XXX-XXX-XXXX" value={form.payee_tin} onChange={e => setForm(f => ({ ...f, payee_tin: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                  </Grid>
                </Box>
              </Grid>
            )}

            {/* Name for payroll file */}
            <Grid item xs={12}>
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2 }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>Name (for payroll file)</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={4}><TextField fullWidth label="Last Name" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                  <Grid item xs={4}><TextField fullWidth label="First Name" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                  <Grid item xs={4}><TextField fullWidth label="Middle Name" value={form.middle_name} onChange={e => setForm(f => ({ ...f, middle_name: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                </Grid>
              </Box>
            </Grid>

            {/* Bank Details */}
            <Grid item xs={12}>
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2 }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>Bank Details</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}><TextField fullWidth label="Bank Name" value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                  <Grid item xs={6}><TextField fullWidth label="Account Name" value={form.bank_account_name} onChange={e => setForm(f => ({ ...f, bank_account_name: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                  <Grid item xs={form.hire_category === 'foreign' ? 6 : 6}><TextField fullWidth label="Account Number" value={form.bank_account_number} onChange={e => setForm(f => ({ ...f, bank_account_number: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                  <Grid item xs={form.hire_category === 'foreign' ? 3 : 6}><TextField fullWidth label="Branch" value={form.bank_branch} onChange={e => setForm(f => ({ ...f, bank_branch: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                  {form.hire_category === 'foreign' && (
                    <Grid item xs={3}><TextField fullWidth label="SWIFT / BIC Code" value={form.bank_swift_code} onChange={e => setForm(f => ({ ...f, bank_swift_code: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                  )}
                </Grid>
              </Box>
            </Grid>

            {/* DFT International Transfer Fields (foreign only) */}
            {form.hire_category === 'foreign' && (<>
              <Grid item xs={12}>
                <Box sx={{ border: '1px solid #6366f130', borderRadius: 1.5, p: 2, bgcolor: 'rgba(99,102,241,0.02)' }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>DFT Transfer Details</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={4}><TextField fullWidth label="Remittance Type" value={form.remittance_type} onChange={e => setForm(f => ({ ...f, remittance_type: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                    <Grid item xs={4}><TextField fullWidth label="Beneficiary Code" value={form.beneficiary_code} onChange={e => setForm(f => ({ ...f, beneficiary_code: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                    <Grid item xs={4}><TextField fullWidth label="Country of Destination" value={form.country_of_destination} onChange={e => setForm(f => ({ ...f, country_of_destination: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                    <Grid item xs={6}><TextField fullWidth label="Beneficiary Address" value={form.beneficiary_address} onChange={e => setForm(f => ({ ...f, beneficiary_address: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                    <Grid item xs={6}><TextField fullWidth label="Beneficiary Bank Address" value={form.bank_address} onChange={e => setForm(f => ({ ...f, bank_address: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                    <Grid item xs={12}><TextField fullWidth label="Purpose / Nature of Transfer" value={form.purpose_nature} onChange={e => setForm(f => ({ ...f, purpose_nature: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                  </Grid>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2 }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>
                    Intermediary Bank
                    <Box component="span" sx={{ ml: 1, fontWeight: 400, textTransform: 'none', color: 'text.disabled' }}>(optional)</Box>
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={4}><TextField fullWidth label="Bank Name" value={form.intermediary_bank_name} onChange={e => setForm(f => ({ ...f, intermediary_bank_name: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                    <Grid item xs={4}><TextField fullWidth label="Bank Address" value={form.intermediary_bank_address} onChange={e => setForm(f => ({ ...f, intermediary_bank_address: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                    <Grid item xs={4}><TextField fullWidth label="SWIFT Code" value={form.intermediary_bank_swift} onChange={e => setForm(f => ({ ...f, intermediary_bank_swift: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                  </Grid>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2 }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>Tax / Withholding</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={4}><TextField fullWidth label="Payee TIN" value={form.payee_tin} onChange={e => setForm(f => ({ ...f, payee_tin: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                    <Grid item xs={4}><TextField fullWidth label="Payee Zip Code" value={form.payee_zip_code} onChange={e => setForm(f => ({ ...f, payee_zip_code: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                    <Grid item xs={4}><TextField fullWidth label="Tax Code" value={form.tax_code} onChange={e => setForm(f => ({ ...f, tax_code: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                    <Grid item xs={6}><TextField fullWidth label="Payee Foreign Address" value={form.payee_foreign_address} onChange={e => setForm(f => ({ ...f, payee_foreign_address: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                    <Grid item xs={6}><TextField fullWidth label="Payee Foreign Zip Code" value={form.payee_foreign_zip_code} onChange={e => setForm(f => ({ ...f, payee_foreign_zip_code: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                  </Grid>
                </Box>
              </Grid>
            </>)}

            {/* Wrike */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField fullWidth label="Wrike User ID" value={form.wrike_user_id} onChange={e => setForm(f => ({ ...f, wrike_user_id: e.target.value }))} placeholder="e.g. ABCDE123" size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
                <Button variant="outlined" startIcon={loadingContacts ? <CircularProgress size={14} /> : <LinkIcon />} onClick={handleLookupWrike} disabled={loadingContacts}
                  sx={{ whiteSpace: 'nowrap', borderRadius: '10px', textTransform: 'none', borderColor: 'divider', color: 'text.secondary', minWidth: 140 }}>
                  Find in Wrike
                </Button>
              </Box>
              {showContactPicker && filteredContacts.length > 0 && (
                <Paper elevation={3} sx={{ mt: 1, borderRadius: 0, maxHeight: 220, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ p: 1, borderBottom: '1px solid', borderBottomColor: 'divider' }}>
                    <TextField fullWidth placeholder="Search contacts…" value={contactSearch} onChange={e => setContactSearch(e.target.value)} size="small" autoFocus sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.85rem' } }} />
                  </Box>
                  <Box sx={{ overflowY: 'auto' }}>
                    {filteredContacts.map(c => (
                      <Box key={c.id} onClick={() => { setForm(f => ({ ...f, wrike_user_id: c.id })); setShowContactPicker(false); toast.success(`Linked to ${c.firstName} ${c.lastName}`); }}
                        sx={{ px: 2, py: 1, cursor: 'pointer', bgcolor: form.wrike_user_id === c.id ? 'rgba(99,102,241,0.07)' : 'transparent', '&:hover': { bgcolor: 'action.hover' }, borderBottom: '1px solid', borderBottomColor: 'divider' }}>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>{c.firstName} {c.lastName}</Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>{c.profiles?.[0]?.email || '—'} · {c.id}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Paper>
              )}
              {form.wrike_user_id && (
                <Typography sx={{ mt: 0.5, fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CheckCircleIcon sx={{ fontSize: 12 }} /> Wrike ID: {form.wrike_user_id}
                </Typography>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeModal} sx={{ borderRadius: '10px', textTransform: 'none', color: 'text.secondary' }}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={saving}
            sx={{ borderRadius: '10px', textTransform: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', boxShadow: '0 4px 12px rgba(99,102,241,0.35)', minWidth: 100 }}>
            {saving ? <CircularProgress size={18} sx={{ color: 'white' }} /> : editing ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Portal credentials dialog */}
      <Dialog open={!!portalCreds} onClose={() => setPortalCreds(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '4px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          {portalCreds?.isReset ? 'New Credentials' : 'Portal Account Created'}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', mb: 2 }}>
            {portalCreds?.isReset ? 'Password has been reset. Share with the employee.' : 'Portal login created. Share with the employee.'}
          </Typography>
          {[
            { label: 'Username', value: portalCreds?.username },
            { label: portalCreds?.isReset ? 'New Password' : 'Temp Password', value: portalCreds?.tempPassword || portalCreds?.newPassword },
          ].map(({ label, value }) => (
            <Box key={label} sx={{ bgcolor: 'action.hover', borderRadius: 0, p: 1.5, mb: 1 }}>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', mb: 0.5 }}>{label}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', flex: 1 }}>{value}</Typography>
                <IconButton size="small" onClick={() => { navigator.clipboard.writeText(value); toast.success('Copied'); }}>
                  <ContentCopyIcon sx={{ fontSize: 16, color: '#6366f1' }} />
                </IconButton>
              </Box>
            </Box>
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPortalCreds(null)} variant="contained"
            sx={{ borderRadius: '10px', textTransform: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)' }}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
