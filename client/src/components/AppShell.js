import { useState } from 'react';
import { NavLink, useLocation, matchPath } from 'react-router-dom';
import {
  Box, Drawer, List, ListItem, ListItemButton, Typography, Avatar, Tooltip, IconButton,
  AppBar, Toolbar, useMediaQuery, useTheme,
} from '@mui/material';
import { motion, MotionConfig } from 'motion/react';
import LogoutIcon from '@mui/icons-material/LogoutOutlined';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import MenuIcon from '@mui/icons-material/MenuOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeftOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRightOutlined';
import { useThemeMode } from '../context/ThemeContext';
import { tokens } from '../theme';
import Guilloche from './Guilloche';
import BrandMark from './BrandMark';

const WIDTH = 264;
const WIDTH_COLLAPSED = 76;
const SPRING = { type: 'spring', stiffness: 420, damping: 36, mass: 0.8 };
const PAGE_IN = { duration: 0.32, ease: [0.2, 0.8, 0.2, 1] };

const C = {
  text: 'rgba(226,236,238,0.66)',
  textStrong: '#f3f8f9',
  muted: 'rgba(226,236,238,0.4)',
  hover: 'rgba(255,255,255,0.05)',
  active: 'rgba(91,176,198,0.16)',
  line: 'rgba(255,255,255,0.09)',
};

const readCollapsed = () => {
  try { return localStorage.getItem('sidebarCollapsed') === '1'; } catch { return false; }
};
const writeCollapsed = (v) => {
  try { localStorage.setItem('sidebarCollapsed', v ? '1' : '0'); } catch { /* storage unavailable */ }
};

function Seal({ size = 38 }) {
  return <BrandMark size={size} title="Timeflow" />;
}

function StepMark({ n, active }) {
  return (
    <Box sx={{
      width: 22, height: 22, borderRadius: '50%', flexShrink: 0, position: 'relative', zIndex: 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '0.7rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
      transition: 'background-color 200ms, color 200ms, border-color 200ms',
      bgcolor: active ? tokens.brass.main : tokens.ink[800],
      color: active ? tokens.ink[900] : C.text,
      border: `1.5px solid ${active ? tokens.brass.main : 'rgba(226,236,238,0.28)'}`,
    }}>
      {n}
    </Box>
  );
}

function NavItem({ item, active, collapsed, step, isLastStep, layoutPrefix, onNavigate }) {
  const linkProps = item.to ? { component: NavLink, to: item.to, end: item.end } : {};
  return (
    <ListItem disablePadding sx={{ position: 'relative' }}>
      {step && !isLastStep && (
        <Box aria-hidden sx={{
          position: 'absolute', zIndex: 0, width: '1.5px', bgcolor: 'rgba(226,236,238,0.16)',
          top: 31, height: 22, left: collapsed ? 'calc(50% - 0.75px)' : 22.25,
        }} />
      )}
      <Tooltip title={collapsed ? item.label : ''} placement="right" arrow>
        <ListItemButton
          {...linkProps}
          onClick={() => { item.onClick?.(); onNavigate?.(); }}
          aria-current={active ? 'page' : undefined}
          sx={{
            position: 'relative', height: 40, borderRadius: '8px', gap: 1.5,
            px: collapsed ? 0 : 1.5,
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: active ? C.textStrong : C.text,
            transition: 'color 160ms',
            '&:hover': { bgcolor: C.hover, color: C.textStrong },
            '&.active': { bgcolor: 'transparent' },
          }}
        >
          {active && (
            <motion.span
              layoutId={`${layoutPrefix}-active`}
              transition={SPRING}
              style={{ position: 'absolute', inset: 0, borderRadius: 8, background: C.active, zIndex: 0 }}
            />
          )}
          {step ? (
            <StepMark n={step} active={active} />
          ) : (
            <Box sx={{
              display: 'flex', position: 'relative', zIndex: 1, width: 22, justifyContent: 'center',
              color: active ? tokens.brass.light : C.muted, transition: 'color 160ms',
              '& svg': { fontSize: 20 },
            }}>
              {item.icon}
            </Box>
          )}
          {!collapsed && (
            <Typography noWrap sx={{ position: 'relative', zIndex: 1, fontSize: '0.875rem', fontWeight: active ? 600 : 500 }}>
              {item.label}
            </Typography>
          )}
        </ListItemButton>
      </Tooltip>
    </ListItem>
  );
}

function SidebarContent({ groups, isActive, collapsed, subtitle, user, requestAction, onLogout, onNavigate, onToggleCollapse, layoutPrefix }) {
  const { mode, toggleTheme } = useThemeMode();
  const initials = (user?.name || 'TF').slice(0, 2).toUpperCase();
  const iconBtn = { color: C.muted, '&:hover': { color: C.textStrong, bgcolor: C.hover } };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: tokens.ink[800], position: 'relative', overflow: 'hidden' }}>
      {/* Engraved rosette peeking in behind the brand: the sidebar's one ornament */}
      <Guilloche size={340} color="rgba(201,162,74,0.11)" lineWidth={0.5} variant="ring"
        sx={{ position: 'absolute', top: -236, left: -150 }} />

      <Box sx={{ position: 'relative', px: collapsed ? 0 : 2.25, pt: 2.75, pb: 2, display: 'flex', alignItems: 'center', gap: 1.5, justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <Seal />
        {!collapsed && (
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontFamily: tokens.fonts.display, color: C.textStrong, fontWeight: 700, fontSize: '1.2rem', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              Timeflow
            </Typography>
            <Typography sx={{ color: C.muted, fontSize: '0.75rem', mt: 0.25 }}>{subtitle}</Typography>
          </Box>
        )}
        {onToggleCollapse && !collapsed && (
          <Tooltip title="Collapse menu" placement="right" arrow>
            <IconButton onClick={onToggleCollapse} size="small" aria-label="Collapse menu" sx={iconBtn}>
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      {onToggleCollapse && collapsed && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
          <Tooltip title="Expand menu" placement="right" arrow>
            <IconButton onClick={onToggleCollapse} size="small" aria-label="Expand menu" sx={iconBtn}>
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <Box component="nav" sx={{ position: 'relative', flex: 1, overflowY: 'auto', overflowX: 'hidden', px: collapsed ? 1.25 : 1.5, pb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {groups.filter(g => g.items.length).map((group, gi) => (
          <Box key={group.label || gi}>
            {group.label && (collapsed
              ? <Box sx={{ height: '1px', bgcolor: C.line, mx: 1, mb: 1 }} />
              : <Typography sx={{ px: 1.5, pb: 0.75, fontSize: '0.75rem', fontWeight: 600, color: C.muted }}>{group.label}</Typography>
            )}
            <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {group.items.map((item, i) => (
                <NavItem
                  key={item.key}
                  item={item}
                  active={isActive(item)}
                  collapsed={collapsed}
                  step={group.steps ? i + 1 : null}
                  isLastStep={i === group.items.length - 1}
                  layoutPrefix={layoutPrefix}
                  onNavigate={onNavigate}
                />
              ))}
            </List>
          </Box>
        ))}
      </Box>

      <Box sx={{ position: 'relative', borderTop: `1px solid ${C.line}`, p: collapsed ? 1.25 : 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {requestAction && (
          <Tooltip title={collapsed ? requestAction.label : ''} placement="right" arrow>
            <ListItemButton onClick={requestAction.onClick} sx={{
              height: 38, borderRadius: '8px', gap: 1.25, px: collapsed ? 0 : 1.5,
              justifyContent: collapsed ? 'center' : 'flex-start',
              border: '1px solid rgba(201,162,74,0.35)', color: tokens.brass.light,
              '&:hover': { bgcolor: 'rgba(201,162,74,0.1)', borderColor: tokens.brass.main },
            }}>
              <Box sx={{ display: 'flex', '& svg': { fontSize: 18 } }}>{requestAction.icon}</Box>
              {!collapsed && <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{requestAction.label}</Typography>}
            </ListItemButton>
          </Tooltip>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexDirection: collapsed ? 'column' : 'row', p: collapsed ? 0 : 0.5 }}>
          <Tooltip title={collapsed ? (user?.name || '') : ''} placement="right" arrow>
            <Avatar sx={{ width: 34, height: 34, fontSize: '0.8rem', fontWeight: 700, bgcolor: tokens.ink[600], color: tokens.brass.light, border: '1px solid rgba(201,162,74,0.4)' }}>
              {initials}
            </Avatar>
          </Tooltip>
          {!collapsed && (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ color: C.textStrong, fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.25 }}>{user?.name}</Typography>
              <Typography noWrap sx={{ color: C.muted, fontSize: '0.75rem' }}>{user?.role}</Typography>
            </Box>
          )}
          <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} placement={collapsed ? 'right' : 'top'} arrow>
            <IconButton onClick={toggleTheme} size="small" aria-label="Toggle color mode" sx={iconBtn}>
              {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Log out" placement={collapsed ? 'right' : 'top'} arrow>
            <IconButton onClick={onLogout} size="small" aria-label="Log out" sx={{ ...iconBtn, '&:hover': { color: '#ee938b', bgcolor: 'rgba(228,106,95,0.12)' } }}>
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Sidebar + mobile bar + animated content area shared by the admin app and the
 * employee portal. Items either route (`to`) or act (`onClick` + `active`).
 * A group with `steps` renders as the numbered payroll-run track.
 */
export default function AppShell({ groups, subtitle, user, onLogout, requestAction, collapsible = false, transitionKey, maxWidth, children }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedPref, setCollapsedPref] = useState(readCollapsed);
  const collapsed = collapsible && !isMobile && collapsedPref;
  const width = collapsed ? WIDTH_COLLAPSED : WIDTH;
  const { mode, toggleTheme } = useThemeMode();

  const isActive = (item) => (item.to ? !!matchPath({ path: item.to, end: !!item.end }, pathname) : !!item.active);
  const allItems = groups.flatMap(g => g.items);
  const current = allItems.find(isActive);

  const sidebarProps = {
    groups, isActive, subtitle, user, requestAction, onLogout,
    layoutPrefix: isMobile ? 'nav-m' : 'nav',
    collapsed,
    onNavigate: isMobile ? () => setMobileOpen(false) : undefined,
    onToggleCollapse: collapsible && !isMobile
      ? () => setCollapsedPref(v => { writeCollapsed(!v); return !v; })
      : undefined,
  };

  const widthTransition = theme.transitions.create('width', { easing: tokens.ease, duration: 260 });

  return (
    <MotionConfig reducedMotion="user">
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
        {isMobile && (
          <AppBar position="fixed" elevation={0} sx={{ bgcolor: tokens.ink[800], backgroundImage: 'none', borderBottom: `1px solid ${C.line}`, zIndex: theme.zIndex.drawer + 1 }}>
            <Toolbar sx={{ gap: 1.25, minHeight: { xs: 56 } }}>
              <IconButton edge="start" onClick={() => setMobileOpen(true)} aria-label="Open menu" sx={{ color: C.textStrong }}>
                <MenuIcon />
              </IconButton>
              <Seal size={30} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontFamily: tokens.fonts.display, color: C.textStrong, fontWeight: 700, fontSize: '1rem', lineHeight: 1.1 }}>Timeflow</Typography>
                {current && <Typography noWrap sx={{ color: C.muted, fontSize: '0.72rem' }}>{current.label}</Typography>}
              </Box>
              {requestAction && (
                <Tooltip title={requestAction.label} arrow>
                  <IconButton onClick={requestAction.onClick} size="small" aria-label={requestAction.label} sx={{ color: tokens.brass.light }}>
                    {requestAction.icon}
                  </IconButton>
                </Tooltip>
              )}
              <IconButton onClick={toggleTheme} size="small" aria-label="Toggle color mode" sx={{ color: C.text }}>
                {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
              </IconButton>
              <IconButton onClick={onLogout} size="small" aria-label="Log out" sx={{ color: C.text }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Toolbar>
          </AppBar>
        )}

        {isMobile ? (
          <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} ModalProps={{ keepMounted: true }}
            sx={{ '& .MuiDrawer-paper': { width: WIDTH, border: 'none' } }}>
            <SidebarContent {...sidebarProps} />
          </Drawer>
        ) : (
          <Drawer variant="permanent" sx={{
            width, flexShrink: 0, transition: widthTransition,
            '& .MuiDrawer-paper': { width, border: 'none', overflowX: 'hidden', transition: widthTransition },
          }}>
            <SidebarContent {...sidebarProps} />
          </Drawer>
        )}

        <Box component="main" sx={{ flex: 1, minWidth: 0, px: { xs: 2, sm: 3, md: 4 }, pt: { xs: 9.5, md: 4 }, pb: 6 }}>
          <motion.div
            key={transitionKey ?? pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={PAGE_IN}
            style={{ maxWidth: maxWidth || 'none', marginInline: maxWidth ? 'auto' : undefined }}
          >
            {children}
          </motion.div>
        </Box>
      </Box>
    </MotionConfig>
  );
}
