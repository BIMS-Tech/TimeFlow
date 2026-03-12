import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, TextField, Button, Typography, InputAdornment, IconButton, CircularProgress
} from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import AccessTimeFilledIcon from '@mui/icons-material/AccessTimeFilled';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuth } from '../context/AuthContext';

/* ── Floating blob ─────────────────────────────────────────── */
function Blob({ sx }) {
  return (
    <Box sx={{
      position: 'absolute',
      borderRadius: '50%',
      filter: 'blur(80px)',
      opacity: 0.35,
      pointerEvents: 'none',
      ...sx,
    }} />
  );
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
      toast.success('Welcome back!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(-45deg, #0f172a, #1e1b4b, #0f172a, #1a1040)',
      backgroundSize: '400% 400%',
      animation: 'gradientShift 12s ease infinite',
    }}>
      {/* Animated blobs */}
      <Blob sx={{
        width: 480, height: 480,
        background: 'radial-gradient(circle, #6366f1 0%, #4338ca 100%)',
        top: '-120px', left: '-120px',
        animation: 'float 8s ease-in-out infinite',
      }} />
      <Blob sx={{
        width: 360, height: 360,
        background: 'radial-gradient(circle, #8b5cf6 0%, #6d28d9 100%)',
        bottom: '-80px', right: '-80px',
        animation: 'floatReverse 10s ease-in-out infinite',
      }} />
      <Blob sx={{
        width: 240, height: 240,
        background: 'radial-gradient(circle, #0ea5e9 0%, #0284c7 100%)',
        top: '40%', right: '10%',
        animation: 'float 14s ease-in-out infinite',
      }} />

      {/* Glass card */}
      <Box
        component="form"
        onSubmit={handleSubmit}
        className="animate-slide-up"
        sx={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 420,
          mx: 2,
          p: '40px 36px',
          borderRadius: '24px',
          backdropFilter: 'blur(24px) saturate(180%)',
          background: 'rgba(255, 255, 255, 0.07)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
      >
        {/* Logo + title */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box sx={{
            width: 64, height: 64, borderRadius: '18px', mx: 'auto', mb: 2,
            background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(99,102,241,0.5)',
            animation: 'pulse-ring 2.5s ease-in-out infinite',
          }}>
            <AccessTimeFilledIcon sx={{ color: 'white', fontSize: 32 }} />
          </Box>
          <Typography sx={{
            color: 'white', fontWeight: 800, fontSize: '1.75rem', lineHeight: 1.1, letterSpacing: '-0.02em'
          }}>
            Timeflow
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', mt: 0.5, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Payroll System
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.875rem', mt: 2 }}>
            Sign in to your account
          </Typography>
        </Box>

        {/* Username */}
        <TextField
          fullWidth
          label="Username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          required
          autoComplete="username"
          slotProps={{ input: {
            startAdornment: (
              <InputAdornment position="start">
                <PersonOutlineIcon sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }} />
              </InputAdornment>
            ),
          }}}
          sx={glassTF}
        />

        {/* Password */}
        <TextField
          fullWidth
          label="Password"
          type={showPass ? 'text' : 'password'}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
          autoComplete="current-password"
          slotProps={{ input: {
            startAdornment: (
              <InputAdornment position="start">
                <LockOutlinedIcon sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPass(!showPass)} edge="end" size="small"
                  sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}>
                  {showPass ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                </IconButton>
              </InputAdornment>
            ),
          }}}
          sx={{ ...glassTF, mt: 2 }}
        />

        {/* Sign in button */}
        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={loading}
          sx={{
            mt: 3, py: 1.5, borderRadius: '12px', fontWeight: 700, fontSize: '0.95rem',
            background: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
            boxShadow: '0 8px 24px rgba(99,102,241,0.45)',
            textTransform: 'none',
            transition: 'all 0.2s',
            '&:hover': {
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              boxShadow: '0 12px 32px rgba(99,102,241,0.55)',
              transform: 'translateY(-1px)',
            },
            '&:disabled': { background: 'rgba(99,102,241,0.4)', color: 'rgba(255,255,255,0.6)' },
          }}
        >
          {loading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Sign In'}
        </Button>

        {/* Hint */}
        <Typography sx={{ mt: 3, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>
          Default: <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>admin / admin123</span>
        </Typography>
      </Box>
    </Box>
  );
}

/* Glass TextField sx override */
const glassTF = {
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.45)', fontSize: '0.875rem' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#818cf8' },
  '& .MuiOutlinedInput-root': {
    color: 'white',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.06)',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
    '&.Mui-focused fieldset': { borderColor: '#6366f1' },
  },
};
