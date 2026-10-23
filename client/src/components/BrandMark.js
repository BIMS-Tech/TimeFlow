import { tokens } from '../theme';

// The Timeflow seal: a brass-ringed clock face, hands at 10:10. Kept in step
// with public/favicon.svg, which draws the same mark for the browser tab.
const MINOR = [30, 60, 120, 150, 210, 240, 300, 330];
const MAJOR = [0, 90, 180, 270];
const at = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [32 + r * Math.sin(a), 32 - r * Math.cos(a)];
};

export default function BrandMark({ size = 38, title }) {
  const brass = tokens.brass.main;
  const hand = tokens.brass.light;
  const tick = (deg, r1, r2, w, opacity) => {
    const [x1, y1] = at(deg, r1);
    const [x2, y2] = at(deg, r2);
    return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={brass} strokeWidth={w} strokeLinecap="round" opacity={opacity} />;
  };
  const [hx, hy] = at(300, 11);
  const [mx, my] = at(60, 16);

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} style={{ display: 'block', flexShrink: 0 }}>
      {title && <title>{title}</title>}
      <circle cx="32" cy="32" r="31" fill={tokens.ink[700]} />
      <circle cx="32" cy="32" r="28" fill="none" stroke={brass} strokeWidth="2.5" />
      <circle cx="32" cy="32" r="24.5" fill="none" stroke={brass} strokeWidth="1" opacity="0.4" />
      {MAJOR.map(d => tick(d, 21.5, 17, 2.4, 1))}
      {MINOR.map(d => tick(d, 21.5, 19.5, 1.3, 0.55))}
      <line x1="32" y1="32" x2={hx} y2={hy} stroke={hand} strokeWidth="3.4" strokeLinecap="round" />
      <line x1="32" y1="32" x2={mx} y2={my} stroke={hand} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="32" cy="32" r="2.8" fill={hand} />
    </svg>
  );
}
