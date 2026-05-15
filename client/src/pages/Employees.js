import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Box, Paper, Typography, Button, TextField, InputAdornment,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, MenuItem, Select, FormControl, InputLabel, CircularProgress, Avatar,
  Autocomplete,
} from '@mui/material';
import { loadBankCodes, searchSwift, searchLocal } from '../utils/bankCodes';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
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
  { value: 'IC',        label: 'IC — Independent Contractor',                    category: 'local'   },
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
  employee_address: '',
  // Bank details
  bank_name: '', bank_account_number: '', bank_account_name: '', bank_branch: '', bank_swift_code: '',
  // DFT international fields
  remittance_type: '', beneficiary_code: '', beneficiary_address: '', bank_address: '',
  country_of_destination: '', purpose_nature: '',
  intermediary_bank_name: '', intermediary_bank_address: '', intermediary_bank_swift: '',
  payee_zip_code: '', payee_foreign_address: '', payee_foreign_zip_code: '',
  tax_code: '',
};

const TEMPLATE_COLS = [
  'employee_id','name','email','department','position','hire_date',
  'hourly_rate','currency','employee_type',
  'first_name','last_name','middle_name',
  'sss_number','philhealth_number','pagibig_number','payee_tin',
  'employee_address',
  'bank_name','bank_account_number','bank_account_name','bank_branch','bank_swift_code',
  'wrike_user_id',
  'remittance_type','beneficiary_code','beneficiary_address','bank_address',
  'country_of_destination','purpose_nature',
  'intermediary_bank_name','intermediary_bank_address','intermediary_bank_swift',
  'payee_zip_code','payee_foreign_address','payee_foreign_zip_code','tax_code',
];

const TEMPLATE_EXAMPLE = {
  employee_id: 'EMP001', name: 'Juan dela Cruz', email: 'juan@company.com',
  department: 'Engineering', position: 'Developer', hire_date: '2025-01-15',
  hourly_rate: '500', currency: 'PHP', employee_type: 'FTE-LCL',
  first_name: 'Juan', last_name: 'dela Cruz', middle_name: 'Santos',
  sss_number: '34-1234567-8', philhealth_number: '02-123456789-0',
  pagibig_number: '1234-5678-9012', payee_tin: '123-456-789-000',
  employee_address: '123 Main St, Cebu City, 6000',
  bank_name: 'BDO', bank_account_number: '001234567890',
  bank_account_name: 'Juan Santos dela Cruz', bank_branch: 'SM City Cebu',
};

function csvEscape(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadTemplate() {
  const header = TEMPLATE_COLS.join(',');
  const example = TEMPLATE_COLS.map(c => csvEscape(TEMPLATE_EXAMPLE[c] ?? '')).join(',');
  const blob = new Blob([`${header}\n${example}\n`], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'employee_bulk_upload_template.csv'; a.click();
  URL.revokeObjectURL(url);
}

function parseCSVClient(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const result = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let inQ = false, cur = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (ch === ',' && !inQ) { row.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    row.push(cur.trim());
    result.push(row);
  }
  return result;
}

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

  // Bulk upload
  const [bulkOpen,    setBulkOpen]    = useState(false);
  const [bulkRows,    setBulkRows]    = useState([]);   // parsed preview rows
  const [bulkHeaders, setBulkHeaders] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResults, setBulkResults] = useState(null); // { created, skipped, errors }
  const bulkFileRef = useRef();

  // Bank code lookup
  const [bankCodes,    setBankCodes]    = useState(null); // { local, foreign }
  const [swiftOptions, setSwiftOptions] = useState([]);
  const [localOptions, setLocalOptions] = useState([]);
  const swiftDebounce = useRef(null);

  // Load bank codes once when the form opens
  const ensureBankCodes = useCallback(async () => {
    if (bankCodes) return bankCodes;
    const codes = await loadBankCodes();
    setBankCodes(codes);
    return codes;
  }, [bankCodes]);

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
    ensureBankCodes();
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
      employee_address: emp.employee_address || '',
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

  const openBulk = () => {
    setBulkRows([]); setBulkHeaders([]); setBulkResults(null);
    setBulkOpen(true);
    setTimeout(() => bulkFileRef.current?.click(), 100);
  };

  const handleBulkFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSVClient(ev.target.result);
      if (parsed.length < 2) { toast.error('CSV must have a header row and at least one data row'); return; }
      setBulkHeaders(parsed[0]);
      const dataRows = parsed.slice(1).filter(r => r.some(c => c));
      setBulkRows(dataRows.map(r => {
        const obj = {};
        parsed[0].forEach((h, i) => { obj[h.toLowerCase().trim()] = r[i] || ''; });
        const missing = ['employee_id','name','email'].filter(f => !obj[f]);
        return { ...obj, _raw: r, _error: missing.length ? `Missing: ${missing.join(', ')}` : null };
      }));
      setBulkResults(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleBulkUpload = async () => {
    const file = bulkFileRef.current?.files?.[0];
    // Re-read from state rows (already parsed) — re-submit original file isn't easy; use a stored file ref
    // Instead, reconstruct CSV from parsed rows to send
    const validRows = bulkRows.filter(r => !r._error);
    if (!validRows.length) { toast.error('No valid rows to upload'); return; }

    setBulkUploading(true);
    try {
      // Rebuild CSV from parsed rows and send
      const csvLines = [TEMPLATE_COLS.join(',')];
      validRows.forEach(r => {
        csvLines.push(TEMPLATE_COLS.map(c => csvEscape(r[c] ?? '')).join(','));
      });
      const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
      const csvFile = new File([blob], 'upload.csv', { type: 'text/csv' });
      const res = await employeesAPI.bulkUpload(csvFile);
      setBulkResults(res.data);
      fetchEmployees();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setBulkUploading(false);
    }
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
      {/* Hidden file input for bulk upload */}
      <input ref={bulkFileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleBulkFile} />

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>Employees</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={downloadTemplate}
            sx={{ borderRadius: '10px', textTransform: 'none', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: '#6366f1', color: '#6366f1' } }}>
            Template
          </Button>
          <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={openBulk}
            sx={{ borderRadius: '10px', textTransform: 'none', borderColor: '#10b981', color: '#10b981', '&:hover': { bgcolor: '#10b98110' } }}>
            Bulk Upload
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openModal()}
            sx={{ borderRadius: '10px', textTransform: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }}>
            Add Employee
          </Button>
        </Box>
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
              <TextField fullWidth label="Employee ID *" value={form.employee_id}
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
                  <Grid item xs={6}>
                    {form.hire_category === 'local' ? (
                      <Autocomplete
                        freeSolo
                        options={localOptions}
                        getOptionLabel={o => typeof o === 'string' ? o : o.name}
                        inputValue={form.bank_name}
                        onInputChange={(_, val, reason) => {
                          setForm(f => ({ ...f, bank_name: val }));
                          if (reason === 'input' && bankCodes) setLocalOptions(searchLocal(bankCodes, val));
                        }}
                        onChange={(_, val) => {
                          if (val && typeof val === 'object') setForm(f => ({ ...f, bank_name: val.name }));
                        }}
                        renderOption={(props, o) => (
                          <Box component="li" {...props} key={o.code}>
                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{o.name}</Typography>
                            <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>{o.code}</Typography>
                          </Box>
                        )}
                        renderInput={(params) => (
                          <TextField {...params} label="Bank Name" size="small"
                            helperText={!bankCodes ? 'Loading bank list…' : undefined}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
                        )}
                      />
                    ) : (
                      <TextField fullWidth label="Bank Name" value={form.bank_name}
                        onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
                        size="small" helperText="Auto-filled when SWIFT code is selected"
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
                    )}
                  </Grid>
                  <Grid item xs={6}><TextField fullWidth label="Account Name" value={form.bank_account_name} onChange={e => setForm(f => ({ ...f, bank_account_name: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                  <Grid item xs={form.hire_category === 'foreign' ? 6 : 6}><TextField fullWidth label="Account Number" value={form.bank_account_number} onChange={e => setForm(f => ({ ...f, bank_account_number: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                  <Grid item xs={form.hire_category === 'foreign' ? 3 : 6}><TextField fullWidth label="Branch" value={form.bank_branch} onChange={e => setForm(f => ({ ...f, bank_branch: e.target.value }))} size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} /></Grid>
                  {form.hire_category === 'foreign' && (
                    <Grid item xs={3}>
                      <Autocomplete
                        freeSolo
                        options={swiftOptions}
                        getOptionLabel={o => typeof o === 'string' ? o : o.swift}
                        inputValue={form.bank_swift_code}
                        filterOptions={x => x}
                        onInputChange={(_, val, reason) => {
                          setForm(f => ({ ...f, bank_swift_code: val.toUpperCase() }));
                          if (reason === 'input') {
                            clearTimeout(swiftDebounce.current);
                            swiftDebounce.current = setTimeout(() => {
                              if (bankCodes && val.length >= 2) setSwiftOptions(searchSwift(bankCodes, val));
                              else setSwiftOptions([]);
                            }, 200);
                          }
                        }}
                        onChange={(_, val) => {
                          if (val && typeof val === 'object') {
                            setForm(f => ({ ...f, bank_swift_code: val.swift, bank_name: val.name }));
                            setSwiftOptions([]);
                          }
                        }}
                        renderOption={(props, o) => (
                          <Box component="li" {...props} key={o.swift}>
                            <Box>
                              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, fontFamily: 'monospace', color: '#6366f1' }}>{o.swift}</Typography>
                              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{o.name}</Typography>
                            </Box>
                          </Box>
                        )}
                        renderInput={(params) => (
                          <TextField {...params} label="SWIFT / BIC Code" size="small"
                            helperText={!bankCodes ? 'Loading…' : 'Type 2+ chars to search'}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
                        )}
                      />
                    </Grid>
                  )}
                </Grid>
              </Box>
            </Grid>

            {/* Address Details — local employees only */}
            {form.hire_category === 'local' && (
              <Grid item xs={12}>
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2 }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>Address Details</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <TextField fullWidth label="Employee Address" multiline rows={2}
                        placeholder="House/Unit no., Street, Barangay, City, Province, ZIP"
                        value={form.employee_address}
                        onChange={e => setForm(f => ({ ...f, employee_address: e.target.value }))}
                        size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField fullWidth label="Bank Branch Address"
                        placeholder="Full address of the bank branch"
                        value={form.bank_address}
                        onChange={e => setForm(f => ({ ...f, bank_address: e.target.value }))}
                        size="small" sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
                    </Grid>
                  </Grid>
                </Box>
              </Grid>
            )}

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

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: '4px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Bulk Upload Employees</span>
          <Button size="small" startIcon={<DownloadIcon />} onClick={downloadTemplate}
            sx={{ textTransform: 'none', color: '#6366f1', fontWeight: 600 }}>
            Download Template
          </Button>
        </DialogTitle>
        <DialogContent>
          {!bulkRows.length && !bulkResults && (
            <Box sx={{ py: 4, textAlign: 'center', border: '2px dashed', borderColor: 'divider', borderRadius: 2, cursor: 'pointer', '&:hover': { borderColor: '#6366f1', bgcolor: '#6366f108' } }}
              onClick={() => bulkFileRef.current?.click()}>
              <UploadFileIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography sx={{ fontWeight: 600, color: 'text.secondary' }}>Click to select a CSV file</Typography>
              <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled', mt: 0.5 }}>
                Use the template above — employee_id, name, and email are required
              </Typography>
            </Box>
          )}

          {bulkRows.length > 0 && !bulkResults && (() => {
            const valid   = bulkRows.filter(r => !r._error).length;
            const invalid = bulkRows.filter(r =>  r._error).length;
            return (
              <>
                <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Chip label={`${valid} valid`}   size="small" sx={{ bgcolor: '#10b98115', color: '#10b981', fontWeight: 700 }} />
                  {invalid > 0 && <Chip label={`${invalid} invalid`} size="small" sx={{ bgcolor: '#ef444415', color: '#ef4444', fontWeight: 700 }} />}
                  <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', ml: 'auto' }}>
                    Reviewing {bulkRows.length} row{bulkRows.length !== 1 ? 's' : ''} — invalid rows will be skipped
                  </Typography>
                </Box>
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', maxHeight: 360, overflowY: 'auto' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell sx={TH}>Row</TableCell>
                        <TableCell sx={TH}>ID</TableCell>
                        <TableCell sx={TH}>Name</TableCell>
                        <TableCell sx={TH}>Email</TableCell>
                        <TableCell sx={TH}>Dept</TableCell>
                        <TableCell sx={TH}>Type</TableCell>
                        <TableCell sx={TH}>Rate</TableCell>
                        <TableCell sx={TH}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {bulkRows.map((r, i) => (
                        <TableRow key={i} sx={{ bgcolor: r._error ? '#ef444408' : 'transparent' }}>
                          <TableCell sx={{ ...TD, color: 'text.disabled', fontSize: '0.75rem' }}>{i + 2}</TableCell>
                          <TableCell sx={TD}>{r.employee_id || <span style={{ color: '#ef4444' }}>—</span>}</TableCell>
                          <TableCell sx={TD}>{r.name || <span style={{ color: '#ef4444' }}>—</span>}</TableCell>
                          <TableCell sx={{ ...TD, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email || <span style={{ color: '#ef4444' }}>—</span>}</TableCell>
                          <TableCell sx={TD}>{r.department || '—'}</TableCell>
                          <TableCell sx={TD}>{r.employee_type || '—'}</TableCell>
                          <TableCell sx={TD}>{r.hourly_rate ? `${r.currency || 'PHP'} ${r.hourly_rate}` : '—'}</TableCell>
                          <TableCell sx={TD}>
                            {r._error
                              ? <Tooltip title={r._error} arrow><Chip label="Error" size="small" sx={{ bgcolor: '#ef444415', color: '#ef4444', fontWeight: 700, fontSize: '0.68rem', cursor: 'help' }} /></Tooltip>
                              : <Chip label="Ready" size="small" sx={{ bgcolor: '#10b98115', color: '#10b981', fontWeight: 700, fontSize: '0.68rem' }} />}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            );
          })()}

          {bulkResults && (
            <Box sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
                <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: '#10b981', borderRadius: 2, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: '#10b981' }}>{bulkResults.created}</Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', fontWeight: 600 }}>Employees Created</Typography>
                </Paper>
                <Paper elevation={0} sx={{ flex: 1, p: 2, border: '1px solid', borderColor: bulkResults.skipped > 0 ? '#f59e0b' : 'divider', borderRadius: 2, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: bulkResults.skipped > 0 ? '#f59e0b' : 'text.disabled' }}>{bulkResults.skipped}</Typography>
                  <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', fontWeight: 600 }}>Skipped</Typography>
                </Paper>
              </Box>
              {bulkResults.errors.length > 0 && (
                <>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: 'text.secondary', mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Skip Details</Typography>
                  <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', maxHeight: 220, overflowY: 'auto' }}>
                    {bulkResults.errors.map((e, i) => (
                      <Box key={i} sx={{ px: 2, py: 1, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                        <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', minWidth: 40 }}>Row {e.row}</Typography>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, minWidth: 80 }}>{e.employee_id}</Typography>
                        <Typography sx={{ fontSize: '0.78rem', color: '#ef4444' }}>{e.error}</Typography>
                      </Box>
                    ))}
                  </Paper>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setBulkOpen(false)} sx={{ borderRadius: '10px', textTransform: 'none', color: 'text.secondary' }}>
            {bulkResults ? 'Close' : 'Cancel'}
          </Button>
          {!bulkResults && bulkRows.length > 0 && (
            <Button variant="contained" onClick={handleBulkUpload} disabled={bulkUploading || bulkRows.every(r => r._error)}
              startIcon={bulkUploading ? <CircularProgress size={14} color="inherit" /> : <UploadFileIcon />}
              sx={{ borderRadius: '10px', textTransform: 'none', bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}>
              {bulkUploading ? 'Uploading…' : `Upload ${bulkRows.filter(r => !r._error).length} Employee${bulkRows.filter(r => !r._error).length !== 1 ? 's' : ''}`}
            </Button>
          )}
          {bulkResults && (
            <Button variant="outlined" startIcon={<UploadFileIcon />}
              onClick={() => { setBulkRows([]); setBulkHeaders([]); setBulkResults(null); bulkFileRef.current?.click(); }}
              sx={{ borderRadius: '10px', textTransform: 'none', borderColor: '#10b981', color: '#10b981' }}>
              Upload Another File
            </Button>
          )}
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
