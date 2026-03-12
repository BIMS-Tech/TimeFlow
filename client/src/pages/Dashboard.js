import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Box, Grid, Paper, Typography, Button, Chip, CircularProgress, Divider
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { dashboardAPI, timesheetAPI } from '../api';

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
  const [processing, setProcessing] = useState(false);

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

  const handleProcessPeriod = async () => {
    try {
      setProcessing(true);
      toast.loading('Processing timesheets...');
      const response = await timesheetAPI.process();
      toast.dismiss();
      if (response.success) {
        toast.success(`Processed ${response.data.processed} timesheets`);
        fetchDashboard();
      }
    } catch {
      toast.error('Failed to process timesheets');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: '#6366f1' }} />
      </Box>
    );
  }

  const { currentPeriod, summaries, payslips, pendingApprovals } = stats || {};

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
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchDashboard}
            sx={{ borderRadius: '10px', textTransform: 'none', borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: '#6366f1', color: '#6366f1', bgcolor: 'rgba(99,102,241,0.04)' } }}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={processing ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <PlayArrowIcon />}
            onClick={handleProcessPeriod} disabled={processing}
            sx={{ borderRadius: '10px', textTransform: 'none', background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)', boxShadow: '0 4px 12px rgba(99,102,241,0.35)', '&:hover': { background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' } }}>
            Process Period
          </Button>
        </Box>
      </Box>

      {/* Stat cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<PeopleIcon />} label="Total Summaries" value={summaries?.total_summaries || 0} color="#6366f1" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<HourglassEmptyIcon />} label="Pending Approvals" value={pendingApprovals || 0} color="#f59e0b" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<CheckCircleOutlineIcon />} label="Approved" value={summaries?.approved_count || 0} color="#10b981" gradient="linear-gradient(135deg, #10b981 0%, #34d399 100%)" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<CancelOutlinedIcon />} label="Rejected" value={summaries?.rejected_count || 0} color="#ef4444" />
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
            { label: `Pending Approvals (${pendingApprovals || 0})`, to: '/pending', icon: <HourglassEmptyIcon fontSize="small" /> },
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
