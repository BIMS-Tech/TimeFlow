import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, InputAdornment, IconButton, CircularProgress,
} from '@mui/material';
import { motion, MotionConfig } from 'motion/react';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { tokens } from '../theme';
import Guilloche from '../components/Guilloche';
import BrandMark from '../components/BrandMark';

const EASE = [0.2, 0.8, 0.2, 1];

/** Today's half-month pay period, the cadence every run in this system follows. */
function currentPeriodLabel(now = new Date()) {
  const month = now.toLocaleDateString('en-US', { month: 'short' });
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return now.getDate() <= 15 ? `${month} 1 – 15` : `${month} 16 – ${lastDay}`;
}

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/auth/login', form);
      login(response.data.user, response.data.token);
      toast.success('Signed in');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.error || 'That username and password don’t match. Check both and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <Box sx={{
        position: 'relative', overflow: 'hidden', minHeight: '100vh', bgcolor: tokens.ink[800],
        // Soft petrol and brass glows give the glass card something to refract
        backgroundImage: `radial-gradient(60% 55% at 78% 30%, rgba(47,139,163,0.34) 0%, rgba(15,42,49,0) 70%),
          radial-gradient(45% 45% at 70% 85%, rgba(201,162,74,0.16) 0%, rgba(15,42,49,0) 70%)`,
        display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.1fr) minmax(440px, 1fr)' },
        gridTemplateRows: { xs: 'auto 1fr', md: '1fr' },
      }}>
        {/* The rosette sits behind the sign-in card so the frosted glass blurs the moving line-work */}
        <Box sx={{ position: 'absolute', top: { xs: '44%', md: '50%' }, left: { xs: '50%', md: '76%' }, transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
          <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.4, ease: EASE }}>
            <Box sx={{ position: 'relative', width: { xs: 420, md: 'min(760px, 92vh)' }, aspectRatio: '1', maxWidth: 'none' }}>
              <Guilloche size={760} color="rgba(201,162,74,0.5)" lineWidth={0.6} spin={240}
                sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
              <Guilloche size={760} color="rgba(91,176,198,0.38)" lineWidth={0.55} spin={320} reverse
                sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'scale(0.86)' }} />
            </Box>
          </motion.div>
        </Box>

        {/* Brand and promise */}
        <Box sx={{
          position: 'relative', minHeight: { md: '100vh' },
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 4,
          p: { xs: 3, md: 6 }, pb: { xs: 1, md: 6 },
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <BrandMark size={40} title="Timeflow" />
            <Typography sx={{ fontFamily: tokens.fonts.display, color: '#f3f8f9', fontWeight: 700, fontSize: '1.2rem', letterSpacing: '-0.02em' }}>
              Timeflow
            </Typography>
          </Box>

          <Box sx={{ maxWidth: { xs: 320, md: 420 } }}>
            <Typography component="h1" sx={{
              fontFamily: tokens.fonts.display, color: '#f3f8f9', fontWeight: 700,
              fontSize: { xs: '2rem', md: '3.25rem' }, lineHeight: 1.02, letterSpacing: '-0.035em',
              fontVariationSettings: '"opsz" 96', textWrap: 'balance',
            }}>
              Hours in. Payslips and bank files out.
            </Typography>
            <Typography sx={{ color: 'rgba(226,236,238,0.62)', fontSize: '0.95rem', mt: 2, maxWidth: 380, lineHeight: 1.6, display: { xs: 'none', md: 'block' } }}>
              Wrike timelogs become verified timesheets, payslips and bank upload files, every half month.
            </Typography>
          </Box>

          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'baseline', gap: 1.5 }}>
            <Typography sx={{ color: 'rgba(226,236,238,0.45)', fontSize: '0.8rem' }}>Current pay period</Typography>
            <Typography sx={{ color: tokens.brass.light, fontSize: '0.95rem', fontWeight: 600 }}>{currentPeriodLabel()}</Typography>
          </Box>
        </Box>

        {/* Frosted sign-in card */}
        <Box sx={{ position: 'relative', display: 'flex', alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'center', px: 2, pt: { xs: 3, md: 6 }, pb: { xs: 5, md: 6 } }}>
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
            style={{ width: '100%', maxWidth: 420 }}
          >
            <Box component="form" onSubmit={handleSubmit} sx={{
              display: 'flex', flexDirection: 'column', gap: 2.25,
              p: { xs: 3, sm: 4.5 }, borderRadius: '20px',
              background: 'linear-gradient(155deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.04) 55%, rgba(255,255,255,0.07) 100%)',
              backdropFilter: 'blur(22px) saturate(150%)',
              WebkitBackdropFilter: 'blur(22px) saturate(150%)',
              border: '1px solid rgba(255,255,255,0.16)',
              boxShadow: '0 30px 70px rgba(4,14,17,0.45), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.04)',
            }}>
              <Box sx={{ mb: 1 }}>
                <Typography variant="h5" component="h2" sx={{ color: '#f3f8f9' }}>Sign in</Typography>
                <Typography sx={{ color: 'rgba(226,236,238,0.66)', fontSize: '0.9rem', mt: 0.75 }}>
                  Use the username your payroll admin gave you.
                </Typography>
              </Box>

              <TextField
                id="login-username"
                fullWidth
                size="medium"
                label="Username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
                autoFocus
                autoComplete="username"
                sx={glassField}
              />

              <TextField
                id="login-password"
                fullWidth
                size="medium"
                label="Password"
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                autoComplete="current-password"
                sx={glassField}
                slotProps={{ input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPass(!showPass)} edge="end" size="small"
                        aria-label={showPass ? 'Hide password' : 'Show password'}
                        sx={{ color: 'rgba(226,236,238,0.6)', '&:hover': { color: '#f3f8f9' } }}>
                        {showPass ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}}
              />

              <Button type="submit" fullWidth variant="contained" size="large" disabled={loading} sx={{
                mt: 0.5, height: 48, fontSize: '0.95rem',
                bgcolor: '#5bb0c6', color: tokens.ink[900],
                '&:hover': { bgcolor: '#86c8d9', boxShadow: '0 10px 28px rgba(91,176,198,0.35)' },
                '&.Mui-disabled': { bgcolor: 'rgba(91,176,198,0.35)', color: 'rgba(8,26,31,0.7)' },
              }}>
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Sign in'}
              </Button>
            </Box>
          </motion.div>
        </Box>
      </Box>
    </MotionConfig>
  );
}

/* Inputs tinted to sit inside the frosted card */
const glassField = {
  '& .MuiInputLabel-root': { color: 'rgba(226,236,238,0.6)' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#86c8d9' },
  '& .MuiOutlinedInput-root': {
    color: '#f3f8f9',
    backgroundColor: 'rgba(8,26,31,0.32)',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.32)' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#5bb0c6' },
    '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(91,176,198,0.18)' },
  },
  // Keep browser autofill from painting a white box inside the glass
  '& input:-webkit-autofill': {
    WebkitBoxShadow: '0 0 0 100px #12333b inset',
    WebkitTextFillColor: '#f3f8f9',
    caretColor: '#f3f8f9',
    borderRadius: 'inherit',
  },
};
