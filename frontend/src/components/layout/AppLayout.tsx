import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ScanLine,
  Activity,
  Sliders,
  Settings,
  Shield,
  Plus,
  Menu,
  X,
} from 'lucide-react';
import { useShield } from '../../context/ShieldContext';

export const AppLayout: React.FC = () => {
  const { apiMode, toggleApiMode, auditLogs } = useShield();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getBreadcrumbTitle = () => {
    switch (location.pathname) {
      case '/overview':
        return 'System Overview';
      case '/scanner':
        return 'Prompt Privacy Gateway';
      case '/audit':
        return 'Security Audit Trail';
      case '/policies':
        return 'Sanitization Policies';
      case '/settings':
        return 'Gateway Specifications';
      default:
        return 'LocalShield AI';
    }
  };

  const navItems = [
    { to: '/overview', label: 'Overview', icon: LayoutDashboard },
    { to: '/scanner', label: 'Prompt Scanner', icon: ScanLine },
    { to: '/audit', label: 'Audit Logs', icon: Activity, badge: auditLogs.length },
    { to: '/policies', label: 'Policies', icon: Sliders },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-app)' }}>
      {/* ================= Sidebar (Desktop) ================= */}
      <aside
        style={{
          width: '240px',
          background: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 110,
          flexShrink: 0,
        }}
        className="desktop-sidebar"
      >
        {/* Brand Header */}
        <div
          style={{
            padding: '1.25rem 1.25rem 1.1rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
              border: '1px solid var(--cyan-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--cyan-primary)',
              boxShadow: '0 0 14px rgba(0, 240, 255, 0.15)',
            }}
          >
            <Shield size={17} />
          </div>
          <div>
            <div style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
              LocalShield<span style={{ color: 'var(--cyan-primary)' }}>.AI</span>
            </div>
            <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.02em' }}>
              Privacy Gateway &bull; v2.4
            </div>
          </div>
        </div>

        {/* Primary CTA: New Privacy Scan */}
        <div style={{ padding: '0.85rem 1rem 0.5rem 1rem' }}>
          <button
            onClick={() => navigate('/scanner')}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.78rem' }}
          >
            <Plus size={14} />
            <span>New Privacy Scan</span>
          </button>
        </div>

        {/* Navigation Links */}
        <nav style={{ padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
          <div style={{ fontSize: '0.64rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', padding: '0.4rem 0.65rem', letterSpacing: '0.06em' }}>
            Console Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.55rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  textDecoration: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#FFF' : 'var(--text-secondary)',
                  background: isActive ? 'var(--bg-surface-elevated)' : 'transparent',
                  border: isActive ? '1px solid var(--border-medium)' : '1px solid transparent',
                  position: 'relative',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Icon size={15} style={{ color: isActive ? 'var(--cyan-primary)' : 'var(--text-muted)' }} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontFamily: 'var(--font-mono)',
                      padding: '0.05rem 0.4rem',
                      borderRadius: 'var(--radius-pill)',
                      background: isActive ? 'rgba(0, 240, 255, 0.18)' : 'var(--bg-surface-active)',
                      color: isActive ? 'var(--cyan-primary)' : 'var(--text-muted)',
                      border: `1px solid ${isActive ? 'var(--cyan-border)' : 'var(--border-subtle)'}`,
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Engine Telemetry Widget */}
        <div style={{ padding: '0.85rem 1rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div
            style={{
              padding: '0.75rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span
                  className="pulse-dot"
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: apiMode === 'LIVE' ? '#10B981' : 'var(--cyan-primary)',
                  }}
                />
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {apiMode === 'LIVE' ? 'Live Gateway' : 'Client Simulator'}
                </span>
              </div>
              <button
                onClick={toggleApiMode}
                className="btn btn-ghost"
                style={{ padding: '0.1rem 0.35rem', fontSize: '0.65rem', color: 'var(--cyan-primary)', textDecoration: 'underline' }}
                title="Toggle simulator or live backend"
              >
                Switch
              </button>
            </div>

            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', lineHeight: 1.4 }}>
              {apiMode === 'LIVE' ? 'Connected to :8000 proxy' : 'In-browser zero-leak sandbox'}
            </div>
          </div>
        </div>
      </aside>

      {/* ================= Main Content Viewport ================= */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        {/* Top Navbar */}
        <header
          style={{
            height: '56px',
            background: 'rgba(10, 13, 21, 0.75)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.75rem',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          {/* Breadcrumb Path & Mobile Hamburger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="btn btn-ghost mobile-menu-btn"
              style={{ display: 'none', padding: '0.35rem' }}
              aria-label="Toggle navigation drawer"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>Console</span>
              <span style={{ color: 'var(--text-dim)' }}>/</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{getBreadcrumbTitle()}</span>
            </div>
          </div>

          {/* Quick Engine Status Pill & Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span
              className="status-badge"
              style={{
                fontSize: '0.68rem',
                fontFamily: 'var(--font-mono)',
                background: apiMode === 'LIVE' ? 'rgba(16, 185, 129, 0.1)' : 'var(--cyan-subtle)',
                color: apiMode === 'LIVE' ? '#34D399' : 'var(--cyan-primary)',
                border: `1px solid ${apiMode === 'LIVE' ? 'rgba(16, 185, 129, 0.25)' : 'var(--cyan-border)'}`,
              }}
            >
              {apiMode === 'LIVE' ? 'LIVE MODE (:8000)' : 'SIMULATION MODE'}
            </span>

            <button
              onClick={() => navigate('/scanner')}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.74rem' }}
            >
              <ScanLine size={13} style={{ color: 'var(--cyan-primary)' }} />
              <span>Scan Prompt</span>
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            style={{
              position: 'fixed',
              inset: '56px 0 0 0',
              background: 'rgba(7, 9, 14, 0.95)',
              backdropFilter: 'blur(8px)',
              zIndex: 200,
              display: 'flex',
              flexDirection: 'column',
              padding: '1.25rem',
              gap: '0.5rem',
            }}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? 'var(--cyan-primary)' : 'var(--text-primary)',
                    background: isActive ? 'var(--cyan-subtle)' : 'var(--bg-surface)',
                    border: `1px solid ${isActive ? 'var(--cyan-border)' : 'var(--border-subtle)'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="status-badge status-badge-neutral">{item.badge}</span>
                  )}
                </NavLink>
              );
            })}
          </div>
        )}

        {/* Routed Page Content Viewport */}
        <main className="app-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
