import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';

// Hypotrochoid layers, the same family of curves a geometric lathe engraves on
// cheques. R and r are integers so each curve closes after r / gcd(R, r) turns.
const PRESETS = {
  rosette: [
    { R: 150, r: 52, d: 72, scale: 1,    copies: 3, spread: 0.035 },
    { R: 120, r: 45, d: 58, scale: 0.62, copies: 2, spread: 0.06 },
    { R: 96,  r: 35, d: 30, scale: 0.3,  copies: 1, spread: 0 },
  ],
  ring: [
    { R: 210, r: 74, d: 40, scale: 1,    copies: 4, spread: 0.02 },
  ],
};

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

function drawLayer(ctx, { R, r, d, scale, copies, spread }, radius) {
  const turns = r / gcd(R, r);
  const k = (R - r) / r;
  const fit = (radius * scale) / (R - r + d);
  const steps = Math.ceil(turns * 360);
  for (let c = 0; c < copies; c++) {
    const rot = c * spread;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * turns * Math.PI * 2;
      const x = ((R - r) * Math.cos(t) + d * Math.cos(k * t)) * fit;
      const y = ((R - r) * Math.sin(t) - d * Math.sin(k * t)) * fit;
      const xr = x * Math.cos(rot) - y * Math.sin(rot);
      const yr = x * Math.sin(rot) + y * Math.cos(rot);
      if (i === 0) ctx.moveTo(xr, yr); else ctx.lineTo(xr, yr);
    }
    ctx.stroke();
  }
}

/**
 * Engraved security-print rosette. Drawn once to a canvas; `spin` (seconds per
 * revolution) rotates it with CSS so it costs nothing per frame. Spinning stops
 * under prefers-reduced-motion (see index.css).
 */
export default function Guilloche({ size = 480, color = '#c9a24a', variant = 'rosette', lineWidth = 0.6, spin = 0, reverse = false, sx }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, size / 2 * dpr, size / 2 * dpr);
    ctx.clearRect(-size / 2, -size / 2, size, size);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    PRESETS[variant].forEach(layer => drawLayer(ctx, layer, size / 2 - lineWidth * 2));
  }, [size, color, variant, lineWidth]);

  return (
    <Box
      component="canvas"
      ref={ref}
      aria-hidden="true"
      className={spin ? 'guilloche-spin' : undefined}
      sx={{
        width: size, height: size, display: 'block', pointerEvents: 'none', flexShrink: 0,
        animation: spin ? `guillocheSpin ${spin}s linear infinite${reverse ? ' reverse' : ''}` : 'none',
        ...sx,
      }}
    />
  );
}
