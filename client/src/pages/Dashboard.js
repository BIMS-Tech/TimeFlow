import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Box, Grid, Paper, Typography, Button, Chip, CircularProgress, Divider
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { dashboardAPI } from '../api';


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
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);

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

  const { currentLocalPeriod, currentForeignPeriod, summaries, payslips, employeeCount, periodCounts } = stats || {};

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>
            Dashboard
          </Typography>
          {(currentLocalPeriod || currentForeignPeriod) && (
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
              {currentLocalPeriod && (
                <Chip label={`Local: ${currentLocalPeriod.period_name}`} size="small"
                  sx={{ fontSize: '0.72rem', fontWeight: 600, bgcolor: '#6366f115', color: '#6366f1', height: 20 }} />
              )}
              {currentForeignPeriod && (
                <Chip label={`Intl: ${currentForeignPeriod.period_name}`} size="small"
                  sx={{ fontSize: '0.72rem', fontWeight: 600, bgcolor: '#0ea5e915', color: '#0ea5e9', height: 20 }} />
              )}
            </Box>
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
          <StatCard icon={<PeopleIcon />} label="Total Employees" value={employeeCount || 0} color="#6366f1" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<HourglassEmptyIcon />} label="Total Hours" value={`${Number(summaries?.total_hours || 0).toFixed(1)}h`} color="#f59e0b" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<CheckCircleOutlineIcon />}
            label={`Payslips · ${payslips?.local_count || 0} Local / ${payslips?.foreign_count || 0} Intl`}
            value={payslips?.total_payslips || 0}
            color="#10b981"
            gradient="linear-gradient(135deg, #10b981 0%, #34d399 100%)"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={<ReceiptLongIcon />}
            label={`Pay Periods · ${periodCounts?.local || 0} Local / ${periodCounts?.foreign || 0} Intl`}
            value={periodCounts?.total || 0}
            color="#6366f1"
          />
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

      {/* Current periods detail */}
      {(currentLocalPeriod || currentForeignPeriod) && (
        <Grid container spacing={2}>
          {currentLocalPeriod && (
            <Grid item xs={12} md={6}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 0, border: '1px solid', borderColor: '#6366f130', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <Typography sx={{ fontWeight: 700, color: 'text.primary', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  Local Payroll Period
                  <Chip label="current" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#6366f115', color: '#6366f1' }} />
                </Typography>
                <Divider sx={{ mb: 1 }} />
                <InfoRow label="Period" value={currentLocalPeriod.period_name} />
                <InfoRow label="Start"  value={new Date(currentLocalPeriod.start_date).toLocaleDateString()} />
                <InfoRow label="End"    value={new Date(currentLocalPeriod.end_date).toLocaleDateString()} />
              </Paper>
            </Grid>
          )}
          {currentForeignPeriod && (
            <Grid item xs={12} md={6}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 0, border: '1px solid', borderColor: '#0ea5e930', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <Typography sx={{ fontWeight: 700, color: 'text.primary', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                  International Payroll Period
                  <Chip label="current" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#0ea5e915', color: '#0ea5e9' }} />
                </Typography>
                <Divider sx={{ mb: 1 }} />
                <InfoRow label="Period" value={currentForeignPeriod.period_name} />
                <InfoRow label="Start"  value={new Date(currentForeignPeriod.start_date).toLocaleDateString()} />
                <InfoRow label="End"    value={new Date(currentForeignPeriod.end_date).toLocaleDateString()} />
              </Paper>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
}
