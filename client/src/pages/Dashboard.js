import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Box, Grid, Paper, Typography, Button, Skeleton, Table, TableBody, TableCell, TableHead, TableRow,
  ListItemButton, useTheme, alpha,
} from '@mui/material';
import { motion, animate, useReducedMotion } from 'motion/react';
import RefreshIcon from '@mui/icons-material/RefreshOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRightOutlined';
import CalculateIcon from '@mui/icons-material/CalculateOutlined';
import AccountBalanceIcon from '@mui/icons-material/AccountBalanceOutlined';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLongOutlined';
import FactCheckIcon from '@mui/icons-material/FactCheckOutlined';
import { dashboardAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { formatHoursAsHM } from '../utils/time';
import { tokens } from '../theme';

const EASE = [0.2, 0.8, 0.2, 1];
const DAY = 86400000;

// Period dates arrive as 'YYYY-MM-DD…'; read them as local calendar days.
const toLocalDay = (value) => {
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const fmtDay = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtMoney = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function periodProgress(period) {
  const start = toLocalDay(period.start_date);
  const end = toLocalDay(period.end_date);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const total = Math.round((end - start) / DAY) + 1;
  const day = Math.round((today - start) / DAY) + 1;
  if (day < 1) return { start, end, total, ratio: 0, headline: `Starts in ${1 - day} day${1 - day === 1 ? '' : 's'}`, detail: `${total}-day period` };
  if (day > total) return { start, end, total, ratio: 1, headline: 'Closed', detail: `Ended ${fmtDay(end)}` };
  const left = total - day;
  return {
    start, end, total, ratio: day / total,
    headline: `Day ${day} of ${total}`,
    detail: left === 0 ? 'Cutoff is today' : `${left} day${left === 1 ? '' : 's'} to cutoff`,
  };
}

function CountUp({ value, format = (n) => Math.round(n).toLocaleString() }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (reduce) { node.textContent = format(value); return undefined; }
    const controls = animate(0, value, { duration: 0.9, ease: EASE, onUpdate: v => { node.textContent = format(v); } });
    return () => controls.stop();
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span ref={ref}>{format(0)}</span>;
}

/** A pay-period "stub": the run it belongs to on the left, where today sits in it on the right. */
function PeriodStub({ kind, period, color }) {
  const p = periodProgress(period);
  return (
    <Paper variant="outlined" sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, overflow: 'hidden', height: '100%' }}>
      <Box sx={{ width: { xs: 'auto', sm: 132 }, flexShrink: 0, p: 2, bgcolor: alpha(color, 0.07), display: 'flex', flexDirection: { xs: 'row', sm: 'column' }, alignItems: { xs: 'baseline', sm: 'stretch' }, justifyContent: 'space-between', gap: 2 }}>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color }}>{kind}</Typography>
        <Box sx={{ textAlign: { xs: 'right', sm: 'left' } }}>
          <Typography sx={{ fontFamily: tokens.fonts.display, fontSize: '1.05rem', fontWeight: 700, color: 'text.primary', lineHeight: 1.15 }}>{p.headline}</Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mt: 0.25 }}>{p.detail}</Typography>
        </Box>
      </Box>
      {/* Perforation between stub and body */}
      <Box aria-hidden sx={{
        borderStyle: 'dashed', borderColor: 'divider',
        borderWidth: { xs: '2px 0 0 0', sm: '0 0 0 2px' },
        mx: { xs: 1.5, sm: 0 }, my: { xs: 0, sm: 1.5 },
      }} />
      <Box sx={{ flex: 1, minWidth: 0, p: 2, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography sx={{ fontFamily: tokens.fonts.display, fontSize: { xs: '1.25rem', sm: '1.5rem' }, fontWeight: 700, letterSpacing: '-0.02em', color: 'text.primary', lineHeight: 1.15, overflowWrap: 'anywhere' }}>
            {period.period_name}
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
            {fmtDay(p.start)} – {fmtDay(p.end)}, {p.end.getFullYear()}
          </Typography>
        </Box>
        <Box>
          <Box sx={{ position: 'relative', height: 6, borderRadius: 3, bgcolor: alpha(color, 0.14), overflow: 'hidden' }}>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: p.ratio }}
              transition={{ duration: 0.9, delay: 0.15, ease: EASE }}
              style={{ position: 'absolute', inset: 0, background: color, borderRadius: 3, transformOrigin: 'left' }}
            />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.75 }}>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{fmtDay(p.start)}</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{fmtDay(p.end)}</Typography>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}

function Stat({ label, value, format, note }) {
  return (
    <Box sx={{ p: { xs: 2, md: 2.5 }, minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
      <Typography sx={{ fontFamily: tokens.fonts.display, fontSize: { xs: '1.6rem', md: '2rem' }, fontWeight: 700, letterSpacing: '-0.03em', color: 'text.primary', lineHeight: 1.1, mt: 0.5 }}>
        <CountUp value={value} format={format} />
      </Typography>
      {note && <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mt: 0.5 }}>{note}</Typography>}
    </Box>
  );
}

function SectionTitle({ children }) {
  return <Typography component="h2" sx={{ fontFamily: tokens.fonts.display, fontSize: '1.05rem', fontWeight: 700, color: 'text.primary', letterSpacing: '-0.01em' }}>{children}</Typography>;
}

function DashboardSkeleton() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Grid container spacing={2}>
        {[0, 1].map(i => <Grid key={i} size={{ xs: 12, md: 6 }}><Skeleton variant="rounded" height={148} /></Grid>)}
      </Grid>
      <Skeleton variant="rounded" height={112} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}><Skeleton variant="rounded" height={220} /></Grid>
        <Grid size={{ xs: 12, md: 5 }}><Skeleton variant="rounded" height={220} /></Grid>
      </Grid>
    </Box>
  );
}

const SHORTCUTS = [
  { label: 'Verify timesheets',    hint: 'Check imported Wrike hours',  to: '/wrike',       page: 'verify',      icon: <FactCheckIcon /> },
  { label: 'Process payroll',      hint: 'Calculate pay for a period',  to: '/generate',    page: 'process',     icon: <CalculateIcon /> },
  { label: 'Generate bank upload', hint: 'Build the bank payment file', to: '/bank-upload', page: 'bank_upload', icon: <AccountBalanceIcon /> },
  { label: 'Payslips',             hint: 'Review and send payslips',    to: '/payslips',    page: 'payslips',    icon: <ReceiptLongIcon /> },
];

export default function Dashboard() {
  const theme = useTheme();
  const { can, hideAmounts } = useAuth();
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDashboard(); }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const response = await dashboardAPI.getStats();
      if (response.success) setStats(response.data);
    } catch {
      toast.error('Couldn’t load the dashboard. Check your connection and press Refresh.');
    } finally {
      setLoading(false);
    }
  };

  const { currentLocalPeriod, currentForeignPeriod, summaries, payslips, employeeCount, periodCounts } = stats || {};

  const currencies = {};
  (summaries?.grossByCurrency || []).forEach(({ currency, total_gross }) => {
    currencies[currency || 'N/A'] = { ...currencies[currency || 'N/A'], gross: total_gross };
  });
  (payslips?.netByCurrency || []).forEach(({ currency, total_net }) => {
    currencies[currency || 'N/A'] = { ...currencies[currency || 'N/A'], net: total_net };
  });
  const currencyRows = Object.entries(currencies);
  const shortcuts = SHORTCUTS.filter(s => can(s.page));
  const split = (local, intl) => `${local || 0} local, ${intl || 0} international`;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 3, flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h5" component="h1" sx={{ color: 'text.primary' }}>Dashboard</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem', mt: 0.5 }}>
            Where the current pay runs stand, and what has been paid so far.
          </Typography>
        </Box>
        <Button variant="outlined" size="small" onClick={fetchDashboard} disabled={loading}
          startIcon={<RefreshIcon sx={{ animation: loading ? 'guillocheSpin 0.9s linear infinite' : 'none' }} />}
          sx={{ color: 'text.secondary' }}>
          Refresh
        </Button>
      </Box>

      {loading && !stats ? <DashboardSkeleton /> : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {(currentLocalPeriod || currentForeignPeriod) && (
            <Grid container spacing={2}>
              {currentLocalPeriod && (
                <Grid size={{ xs: 12, md: currentForeignPeriod ? 6 : 12 }}>
                  <PeriodStub kind="Local payroll" period={currentLocalPeriod} color={theme.palette.primary.main} />
                </Grid>
              )}
              {currentForeignPeriod && (
                <Grid size={{ xs: 12, md: currentLocalPeriod ? 6 : 12 }}>
                  <PeriodStub kind="International" period={currentForeignPeriod} color={theme.palette.secondary.main} />
                </Grid>
              )}
            </Grid>
          )}

          {/* 1px gaps over a divider-colored ground draw the cell rules at every breakpoint */}
          <Paper variant="outlined" sx={{
            display: 'grid', gap: '1px', overflow: 'hidden', bgcolor: 'divider',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
            '& > *': { bgcolor: 'background.paper' },
          }}>
            <Stat label="Employees" value={employeeCount || 0} />
            <Stat label="Hours logged" value={Number(summaries?.total_hours || 0)} format={formatHoursAsHM} />
            <Stat label="Payslips issued" value={payslips?.total_payslips || 0} note={split(payslips?.local_count, payslips?.foreign_count)} />
            <Stat label="Pay periods" value={periodCounts?.total || 0} note={split(periodCounts?.local, periodCounts?.foreign)} />
          </Paper>

          <Grid container spacing={2}>
            {!hideAmounts && (
              <Grid size={{ xs: 12, md: shortcuts.length ? 7 : 12 }}>
                <Paper variant="outlined" sx={{ height: '100%', overflow: 'hidden' }}>
                  <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
                    <SectionTitle>Pay by currency</SectionTitle>
                    <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 0.25 }}>
                      Gross from processed timesheets, net from issued payslips.
                    </Typography>
                  </Box>
                  {currencyRows.length ? (
                    <Box sx={{ overflowX: 'auto' }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ pl: 2.5 }}>Currency</TableCell>
                            <TableCell align="right">Gross pay</TableCell>
                            <TableCell align="right" sx={{ pr: 2.5 }}>Net pay</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {currencyRows.map(([currency, { gross, net }]) => (
                            <TableRow key={currency}>
                              <TableCell sx={{ pl: 2.5, fontWeight: 600 }}>{currency}</TableCell>
                              <TableCell align="right">{gross != null ? fmtMoney(gross) : '—'}</TableCell>
                              <TableCell align="right" sx={{ pr: 2.5, fontWeight: 600, color: 'success.main' }}>{net != null ? fmtMoney(net) : '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </Box>
                  ) : (
                    <Typography sx={{ px: 2.5, pb: 2.5, fontSize: '0.875rem', color: 'text.secondary' }}>
                      Nothing paid yet. Totals appear here once a period is processed.
                    </Typography>
                  )}
                </Paper>
              </Grid>
            )}

            {shortcuts.length > 0 && (
              <Grid size={{ xs: 12, md: hideAmounts ? 12 : 5 }}>
                <Paper variant="outlined" sx={{ height: '100%', p: 1 }}>
                  <Box sx={{ px: 1.5, pt: 1, pb: 1 }}><SectionTitle>Continue the run</SectionTitle></Box>
                  {shortcuts.map(s => (
                    <ListItemButton key={s.to} component={Link} to={s.to} sx={{
                      borderRadius: '8px', gap: 1.5, py: 1.1,
                      '&:hover .chev': { transform: 'translateX(3px)', color: 'primary.main' },
                    }}>
                      <Box sx={{ width: 34, height: 34, borderRadius: '8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.selected', color: 'primary.main', '& svg': { fontSize: 18 } }}>
                        {s.icon}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>{s.label}</Typography>
                        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{s.hint}</Typography>
                      </Box>
                      <ChevronRightIcon className="chev" sx={{ color: 'text.disabled', transition: `transform 200ms ${tokens.ease}, color 160ms` }} />
                    </ListItemButton>
                  ))}
                </Paper>
              </Grid>
            )}
          </Grid>
        </Box>
      )}
    </Box>
  );
}
