import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Box, Grid, Paper, Typography, Button, Chip, CircularProgress, Divider,
  Collapse, Avatar, Tooltip, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FilterListIcon from '@mui/icons-material/FilterList';
import { dashboardAPI, timesheetAPI, employeesAPI } from '../api';

const STATUS_COLORS = { open: '#6366f1', processing: '#f59e0b', approved: '#10b981', rejected: '#ef4444', paid: '#10b981' };

function StatCard({ icon, label, value, color, gradient }) {
  return (
    <Paper elevation={0} sx={{
      p: 2, borderRadius: 0,
      background: gradient,
      bgcolor: gradient ? undefined : 'background.paper',
      border: gradient ? 'none' : '1px solid',
      borderColor: gradient ? undefined : 'divider',
      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      display: 'flex', alignItems: 'center', gap: 2,
    }}>
      <Box sx={{
        width: 52, height: 52, borderRadius: 0,
        background: gradient ? 'rgba(255,255,255,0.2)' : `${color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {React.cloneElement(icon, { sx: { fontSize: 26, color: gradient ? 'white' : color } })}
      </Box>
      <Box>
        <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, color: gradient ? 'white' : 'text.primary', lineHeight: 1 }}>
          {value}
        </Typography>
        <Typography sx={{ fontSize: '0.8rem', color: gradient ? 'rgba(255,255,255,0.75)' : 'text.secondary', mt: 0.25 }}>
          {label}
        </Typography>
      </Box>
    </Paper>
  );
}

function InfoRow({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1.25, borderBottom: '1px solid', borderBottomColor: 'divider' }}>
      <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>{value}</Typography>
    </Box>
  );
}

function CategoryHoursPanel({ periods, employees }) {
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState(null);

  const fetchCategoryHours = useCallback(async () => {
    setLoading(true);
    setExpandedCategory(null);
    try {
      const res = await dashboardAPI.getCategoryHours(
        selectedPeriod || null,
        selectedEmployee || null
      );
      if (res.success) setData(res.data);
    } catch {
      toast.error('Failed to load category hours');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, selectedEmployee]);

  useEffect(() => { fetchCategoryHours(); }, [fetchCategoryHours]);

  const { categoryBreakdown = [], categoryEmployeeBreakdown = [] } = data || {};
  const maxHours = categoryBreakdown.length ? Math.max(...categoryBreakdown.map(c => +c.total_hours)) : 1;

  const empByCategory = categoryEmployeeBreakdown.reduce((acc, row) => {
    if (!acc[row.category]) acc[row.category] = [];
    acc[row.category].push(row);
    return acc;
  }, {});

  const selectedEmpName = employees.find(e => String(e.id) === String(selectedEmployee))?.name;
  const selectedPeriodName = periods.find(p => String(p.id) === String(selectedPeriod))?.period_name;

  return (
    <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', mb: 2, overflow: 'hidden' }}>
      {/* Header + filters */}
      <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 160 }}>
          <AccessTimeIcon sx={{ fontSize: 18, color: '#6366f1' }} />
          <Typography sx={{ fontWeight: 700, color: 'text.primary' }}>Hours by Category</Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <FilterListIcon sx={{ fontSize: 18, color: 'text.disabled' }} />

          {/* Period selector */}
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel sx={{ fontSize: '0.8rem' }}>Period</InputLabel>
            <Select
              label="Period"
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
              sx={{ fontSize: '0.8rem', borderRadius: '8px' }}
            >
              <MenuItem value=""><em>All Periods</em></MenuItem>
              {periods.map(p => (
                <MenuItem key={p.id} value={p.id} sx={{ fontSize: '0.8rem' }}>{p.period_name}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Employee selector */}
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel sx={{ fontSize: '0.8rem' }}>Employee</InputLabel>
            <Select
              label="Employee"
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
              sx={{ fontSize: '0.8rem', borderRadius: '8px' }}
            >
              <MenuItem value=""><em>All Employees</em></MenuItem>
              {employees.map(e => (
                <MenuItem key={e.id} value={e.id} sx={{ fontSize: '0.8rem' }}>{e.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* Active filter tags */}
      {(selectedPeriod || selectedEmployee) && (
        <Box sx={{ px: 2.5, py: 1, bgcolor: 'rgba(99,102,241,0.04)', borderBottom: '1px solid', borderBottomColor: 'divider', display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', mr: 0.5 }}>Showing:</Typography>
          {selectedPeriodName && <Chip label={selectedPeriodName} size="small" onDelete={() => setSelectedPeriod('')} sx={{ fontSize: '0.72rem', height: 22, bgcolor: '#6366f115', color: '#6366f1' }} />}
          {selectedEmpName   && <Chip label={selectedEmpName}   size="small" onDelete={() => setSelectedEmployee('')} sx={{ fontSize: '0.72rem', height: 22, bgcolor: '#10b98115', color: '#10b981' }} />}
        </Box>
      )}

      {/* Body */}
      {loading ? (
        <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress size={28} sx={{ color: '#6366f1' }} />
        </Box>
      ) : categoryBreakdown.length === 0 ? (
        <Box sx={{ py: 5, textAlign: 'center', color: 'text.disabled' }}>
          <AccessTimeIcon sx={{ fontSize: 36, opacity: 0.2, mb: 1 }} />
          <Typography sx={{ fontSize: '0.875rem' }}>No time entries found for the selected filters.</Typography>
        </Box>
      ) : (
        categoryBreakdown.map(({ category, total_hours, employee_count }, idx) => {
          const isOpen = expandedCategory === category;
          const empRows = empByCategory[category] || [];
          const barPct = Math.round((+total_hours / maxHours) * 100);

          return (
            <Box key={category} sx={{ borderBottom: idx < categoryBreakdown.length - 1 ? '1px solid' : 'none', borderBottomColor: 'divider' }}>
              <Box
                onClick={() => setExpandedCategory(isOpen ? null : category)}
                sx={{ px: 2.5, py: 1.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
                  bgcolor: isOpen ? 'rgba(99,102,241,0.04)' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' }, transition: 'background 0.15s' }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {category}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0, ml: 2 }}>
                      {!selectedEmployee && (
                        <Tooltip title={`${employee_count} employee${employee_count !== 1 ? 's' : ''}`}>
                          <Chip label={`${employee_count} emp`} size="small"
                            sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600, bgcolor: '#6366f110', color: '#6366f1', cursor: 'pointer' }} />
                        </Tooltip>
                      )}
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 800, color: '#6366f1', minWidth: 52, textAlign: 'right' }}>
                        {Number(total_hours).toFixed(1)}h
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ height: 5, borderRadius: '3px', bgcolor: 'action.hover', overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', borderRadius: '3px', bgcolor: isOpen ? '#6366f1' : '#818cf8',
                      width: `${barPct}%`, transition: 'width 0.4s ease, background 0.2s' }} />
                  </Box>
                </Box>
                <Box sx={{ color: 'text.disabled', flexShrink: 0 }}>
                  {isOpen ? <ExpandLessIcon sx={{ fontSize: 20 }} /> : <ExpandMoreIcon sx={{ fontSize: 20 }} />}
                </Box>
              </Box>

              <Collapse in={isOpen} unmountOnExit>
                <Box sx={{ px: 2.5, pb: 1.5, pt: 0.5, bgcolor: 'rgba(99,102,241,0.025)' }}>
                  {empRows.length === 0 ? (
                    <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled', py: 1 }}>No breakdown available.</Typography>
                  ) : empRows.map((emp, i) => {
                    const empPct = Math.round((emp.hours / total_hours) * 100);
                    return (
                      <Box key={emp.emp_code} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75,
                        borderBottom: i < empRows.length - 1 ? '1px dashed' : 'none', borderBottomColor: 'divider' }}>
                        <Avatar sx={{ width: 28, height: 28, fontSize: '0.7rem', fontWeight: 700, bgcolor: '#6366f115', color: '#6366f1', flexShrink: 0 }}>
                          {emp.employee_name.slice(0, 2).toUpperCase()}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.4 }}>
                            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {emp.employee_name}
                            </Typography>
                            <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'text.primary', ml: 1, flexShrink: 0 }}>
                              {Number(emp.hours).toFixed(1)}h
                              <Typography component="span" sx={{ fontSize: '0.7rem', color: 'text.disabled', fontWeight: 400, ml: 0.5 }}>
                                ({empPct}%)
                              </Typography>
                            </Typography>
                          </Box>
                          <Box sx={{ height: 3, borderRadius: '2px', bgcolor: 'action.hover', overflow: 'hidden' }}>
                            <Box sx={{ height: '100%', borderRadius: '2px', bgcolor: '#10b981', width: `${empPct}%`, transition: 'width 0.3s ease' }} />
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Collapse>
            </Box>
          );
        })
      )}
    </Paper>
  );
}

export default function Dashboard() {
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [periods, setPeriods]   = useState([]);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    fetchDashboard();
    // Load periods + employees for the category filter dropdowns
    timesheetAPI.getPeriods(100, 0).then(r => { if (r.success) setPeriods(r.data || []); }).catch(() => {});
    employeesAPI.getAll(true).then(r => { if (r.success) setEmployees(r.data || []); }).catch(() => {});
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getStats();
      if (response.success) setStats(response.data);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: '#6366f1' }} />
      </Box>
    );
  }

  const { currentPeriod, summaries, payslips } = stats || {};

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>
            Dashboard
          </Typography>
          {currentPeriod && (
            <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', mt: 0.25 }}>
              Current Period: {currentPeriod.period_name}
            </Typography>
          )}
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchDashboard}
          sx={{ borderRadius: '10px', textTransform: 'none', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: '#6366f1', color: '#6366f1', bgcolor: 'rgba(99,102,241,0.04)' } }}>
          Refresh
        </Button>
      </Box>

      {/* Stat cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<PeopleIcon />} label="Total Employees" value={employees.length || 0} color="#6366f1" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<HourglassEmptyIcon />} label="Total Hours" value={`${Number(summaries?.total_hours || 0).toFixed(1)}h`} color="#f59e0b" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<CheckCircleOutlineIcon />} label="Payslips Generated" value={payslips?.total_payslips || 0} color="#10b981" gradient="linear-gradient(135deg, #10b981 0%, #34d399 100%)" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<ReceiptLongIcon />} label="Pay Periods" value={periods.length || 0} color="#6366f1" />
        </Grid>
      </Grid>

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontWeight: 700, color: 'text.primary' }}>Hours & Gross Pay</Typography>
              <TrendingUpIcon sx={{ color: 'text.disabled' }} />
            </Box>
            <Box sx={{ mb: 1.5 }}>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 0.25 }}>Total Hours</Typography>
              <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, color: 'text.primary', lineHeight: 1 }}>
                {Number(summaries?.total_hours || 0).toFixed(1)}h
              </Typography>
            </Box>
            <Divider sx={{ mb: 1.5 }} />
            <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 0.75 }}>Gross Pay by Currency</Typography>
            {summaries?.grossByCurrency?.length > 0 ? summaries.grossByCurrency.map(({ currency, total_gross }) => (
              <Box key={currency} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', fontWeight: 600 }}>{currency || 'N/A'}</Typography>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'text.primary' }}>
                  {Number(total_gross || 0).toLocaleString()}
                </Typography>
              </Box>
            )) : (
              <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled' }}>No data</Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontWeight: 700, color: 'text.primary' }}>Payslips Generated</Typography>
              <ReceiptLongIcon sx={{ color: 'text.disabled' }} />
            </Box>
            <Box sx={{ mb: 1.5 }}>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 0.25 }}>Total Payslips</Typography>
              <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, color: 'text.primary', lineHeight: 1 }}>
                {payslips?.total_payslips || 0}
              </Typography>
            </Box>
            <Divider sx={{ mb: 1.5 }} />
            <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 0.75 }}>Net Pay by Currency</Typography>
            {payslips?.netByCurrency?.length > 0 ? payslips.netByCurrency.map(({ currency, total_net }) => (
              <Box key={currency} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', fontWeight: 600 }}>{currency || 'N/A'}</Typography>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#10b981' }}>
                  {Number(total_net || 0).toLocaleString()}
                </Typography>
              </Box>
            )) : (
              <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled' }}>No payslips yet</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Quick actions */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', mb: 2 }}>
        <Typography sx={{ fontWeight: 700, color: 'text.primary', mb: 2 }}>Quick Actions</Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {[
            { label: 'Generate Payslips',  to: '/generate',   icon: <ReceiptLongIcon fontSize="small" /> },
            { label: 'Manage Periods',     to: '/periods',    icon: <TrendingUpIcon fontSize="small" /> },
            { label: 'Manage Employees',   to: '/employees',  icon: <PeopleIcon fontSize="small" /> },
          ].map(({ label, to, icon }) => (
            <Button key={to} component={Link} to={to} variant="outlined" startIcon={icon}
              sx={{ borderRadius: '10px', textTransform: 'none', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: '#6366f1', color: '#6366f1', bgcolor: 'rgba(99,102,241,0.04)' } }}>
              {label}
            </Button>
          ))}
        </Box>
      </Paper>

      {/* Filterable category hours */}
      <CategoryHoursPanel periods={periods} employees={employees} />

      {/* Current period detail */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Typography sx={{ fontWeight: 700, color: 'text.primary', mb: 2 }}>Current Period</Typography>
        <Divider sx={{ mb: 1 }} />
        {currentPeriod ? (
          <>
            <InfoRow label="Period Name" value={currentPeriod.period_name} />
            <InfoRow label="Start Date"  value={new Date(currentPeriod.start_date).toLocaleDateString()} />
            <InfoRow label="End Date"    value={new Date(currentPeriod.end_date).toLocaleDateString()} />
          </>
        ) : (
          <Box sx={{ py: 2, textAlign: 'center', color: 'text.disabled', fontSize: '0.875rem' }}>
            No active period covers today's date.
          </Box>
        )}
      </Paper>
    </Box>
  );
}
