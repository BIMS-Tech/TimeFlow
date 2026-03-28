import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Box, Grid, Paper, Typography, Button, Chip, CircularProgress, Divider,
  Collapse, Avatar, Tooltip
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
import { dashboardAPI } from '../api';

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

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState(null);
  useEffect(() => { fetchDashboard(); }, []);

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

  const { currentPeriod, summaries, payslips, categoryBreakdown, categoryEmployeeBreakdown } = stats || {};
  const maxCategoryHours = categoryBreakdown?.length ? Math.max(...categoryBreakdown.map(c => c.total_hours)) : 1;

  // Group employee rows by category for quick lookup
  const empByCategory = (categoryEmployeeBreakdown || []).reduce((acc, row) => {
    if (!acc[row.category]) acc[row.category] = [];
    acc[row.category].push(row);
    return acc;
  }, {});

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
          <StatCard icon={<PeopleIcon />} label="Total Employees" value={summaries?.total_summaries || 0} color="#6366f1" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<HourglassEmptyIcon />} label="Total Hours" value={`${Number(summaries?.total_hours || 0).toFixed(1)}h`} color="#f59e0b" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<CheckCircleOutlineIcon />} label="Payslips Generated" value={payslips?.total_payslips || 0} color="#10b981" gradient="linear-gradient(135deg, #10b981 0%, #34d399 100%)" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<ReceiptLongIcon />} label="Categories" value={categoryBreakdown?.length || 0} color="#6366f1" />
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
            {summaries?.grossByCurrency?.filter(r => r.currency !== 'BDT').length > 0 ? summaries.grossByCurrency.filter(r => r.currency !== 'BDT').map(({ currency, total_gross }) => (
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
            {payslips?.netByCurrency?.filter(r => r.currency !== 'BDT').length > 0 ? payslips.netByCurrency.filter(r => r.currency !== 'BDT').map(({ currency, total_net }) => (
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
            { label: 'Generate Payslips', to: '/generate', icon: <ReceiptLongIcon fontSize="small" /> },
            { label: 'Manage Periods', to: '/periods', icon: <TrendingUpIcon fontSize="small" /> },
            { label: 'Manage Employees', to: '/employees', icon: <PeopleIcon fontSize="small" /> },
          ].map(({ label, to, icon }) => (
            <Button key={to} component={Link} to={to} variant="outlined" startIcon={icon}
              sx={{ borderRadius: '10px', textTransform: 'none', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: '#6366f1', color: '#6366f1', bgcolor: 'rgba(99,102,241,0.04)' } }}>
              {label}
            </Button>
          ))}
        </Box>
      </Paper>

      {/* Hours by Category — expandable per-employee breakdown */}
      {categoryBreakdown?.length > 0 && (
        <Paper elevation={0} sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', mb: 2, overflow: 'hidden' }}>
          {/* Section header */}
          <Box sx={{ px: 2.5, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid', borderBottomColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTimeIcon sx={{ fontSize: 18, color: '#6366f1' }} />
              <Typography sx={{ fontWeight: 700, color: 'text.primary' }}>Hours by Category</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>
              {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
            </Typography>
          </Box>

          {categoryBreakdown.map(({ category, total_hours, employee_count }, idx) => {
            const isOpen = expandedCategory === category;
            const empRows = empByCategory[category] || [];
            const barPct = Math.round((total_hours / maxCategoryHours) * 100);

            return (
              <Box key={category} sx={{ borderBottom: idx < categoryBreakdown.length - 1 ? '1px solid' : 'none', borderBottomColor: 'divider' }}>
                {/* Category row — clickable */}
                <Box
                  onClick={() => setExpandedCategory(isOpen ? null : category)}
                  sx={{ px: 2.5, py: 1.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2,
                    bgcolor: isOpen ? 'rgba(99,102,241,0.04)' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' }, transition: 'background 0.15s' }}
                >
                  {/* Bar + label */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {category}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0, ml: 2 }}>
                        <Tooltip title={`${employee_count} employee${employee_count !== 1 ? 's' : ''}`}>
                          <Chip label={`${employee_count} emp`} size="small"
                            sx={{ height: 20, fontSize: '0.68rem', fontWeight: 600, bgcolor: '#6366f110', color: '#6366f1', cursor: 'pointer' }} />
                        </Tooltip>
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

                  {/* Expand icon */}
                  <Box sx={{ color: 'text.disabled', flexShrink: 0 }}>
                    {isOpen ? <ExpandLessIcon sx={{ fontSize: 20 }} /> : <ExpandMoreIcon sx={{ fontSize: 20 }} />}
                  </Box>
                </Box>

                {/* Expanded employee breakdown */}
                <Collapse in={isOpen} unmountOnExit>
                  <Box sx={{ px: 2.5, pb: 1.5, pt: 0.5, bgcolor: 'rgba(99,102,241,0.025)' }}>
                    {empRows.length === 0 ? (
                      <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled', py: 1 }}>No breakdown available.</Typography>
                    ) : (
                      empRows.map((emp, i) => {
                        const empBarPct = Math.round((emp.hours / total_hours) * 100);
                        return (
                          <Box key={emp.emp_code} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75,
                            borderBottom: i < empRows.length - 1 ? '1px dashed' : 'none', borderBottomColor: 'divider' }}>
                            <Avatar sx={{ width: 28, height: 28, fontSize: '0.7rem', fontWeight: 700,
                              bgcolor: '#6366f115', color: '#6366f1', flexShrink: 0 }}>
                              {emp.employee_name.slice(0, 2).toUpperCase()}
                            </Avatar>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.4 }}>
                                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.primary',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {emp.employee_name}
                                </Typography>
                                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'text.primary', ml: 1, flexShrink: 0 }}>
                                  {Number(emp.hours).toFixed(1)}h
                                  <Typography component="span" sx={{ fontSize: '0.7rem', color: 'text.disabled', fontWeight: 400, ml: 0.5 }}>
                                    ({empBarPct}%)
                                  </Typography>
                                </Typography>
                              </Box>
                              <Box sx={{ height: 3, borderRadius: '2px', bgcolor: 'action.hover', overflow: 'hidden' }}>
                                <Box sx={{ height: '100%', borderRadius: '2px', bgcolor: '#10b981', width: `${empBarPct}%`, transition: 'width 0.3s ease' }} />
                              </Box>
                            </Box>
                          </Box>
                        );
                      })
                    )}
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Paper>
      )}

      {/* Current period detail */}
      <Paper elevation={0} sx={{ p: 2, borderRadius: 0, border: '1px solid', borderColor: 'divider', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography sx={{ fontWeight: 700, color: 'text.primary' }}>Current Period</Typography>
          {currentPeriod && (
            <Chip label={currentPeriod.status} size="small"
              sx={{ bgcolor: `${STATUS_COLORS[currentPeriod.status] || '#6366f1'}18`, color: STATUS_COLORS[currentPeriod.status] || '#6366f1', fontWeight: 600, fontSize: '0.75rem', textTransform: 'capitalize' }} />
          )}
        </Box>
        <Divider sx={{ mb: 1 }} />
        {currentPeriod ? (
          <>
            <InfoRow label="Period Name" value={currentPeriod.period_name} />
            <InfoRow label="Start Date" value={new Date(currentPeriod.start_date).toLocaleDateString()} />
            <InfoRow label="End Date" value={new Date(currentPeriod.end_date).toLocaleDateString()} />
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
