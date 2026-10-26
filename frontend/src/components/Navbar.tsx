import React from 'react';
import { Shield, Sliders, Activity, Cpu, Server } from 'lucide-react';
import type { PolicyConfig } from '../types/shield';

interface NavbarProps {
  policyConfig: PolicyConfig;
  onSelectPolicyPreset: (preset: 'balanced' | 'strict' | 'permissive') => void;
  apiMode: 'MOCK' | 'LIVE';
  backendUrl: string;
  onToggleApiMode: () => void;
  onOpenSettings: () => void;
  auditCount: number;
  onScrollToSection: (sectionId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  policyConfig,
  onSelectPolicyPreset,
  apiMode,
  backendUrl,
  onToggleApiMode,
  onOpenSettings,
  auditCount,
  onScrollToSection,
}) => {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(8, 12, 20, 0.92)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0.75rem 1.5rem',
      }}
    >
      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        {/* Brand & Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--cyan-subtle)',
                border: '1px solid var(--cyan-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--cyan-primary)',
              }}
            >
              <Shield size={18} />
            </div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                LocalShield<span style={{ color: 'var(--cyan-primary)' }}>.AI</span>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.02em' }}>
                Privacy Gateway for AI Prompts
              </div>
            </div>
          </div>

          {/* Nav links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <button
              onClick={() => onScrollToSection('workspace-section')}
              className="btn btn-ghost"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', color: 'var(--text-primary)' }}
            >
              Workspace
            </button>
            <button
              onClick={() => onScrollToSection('audit-section')}
              className="btn btn-ghost"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
            >
              <Activity size={13} style={{ color: 'var(--text-muted)' }} />
              <span>Audit Trail</span>
              {auditCount > 0 && (
                <span
                  style={{
                    fontSize: '0.65rem',
                    padding: '0.05rem 0.4rem',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-medium)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {auditCount}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Controls & Engine Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Policy Preset Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '0.3rem 0.6rem',
            }}
          >
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>Policy:</span>
            <select
              value={
                policyConfig.name.includes('Strict')
                  ? 'strict'
                  : policyConfig.name.includes('Permissive')
                  ? 'permissive'
                  : 'balanced'
              }
              onChange={(e) =>
                onSelectPolicyPreset(e.target.value as 'balanced' | 'strict' | 'permissive')
              }
              style={{
                background: 'transparent',
                color: 'var(--text-primary)',
                border: 'none',
                outline: 'none',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <option value="balanced" style={{ background: '#0E1422' }}>Balanced (Recommended)</option>
              <option value="strict" style={{ background: '#0E1422' }}>Strict Zero-Trust</option>
              <option value="permissive" style={{ background: '#0E1422' }}>Permissive Audit</option>
            </select>
          </div>

          {/* Engine Status Toggle (Explicitly distinguished) */}
          <button
            onClick={onToggleApiMode}
            className="btn btn-secondary"
            title={
              apiMode === 'MOCK'
                ? 'Client Simulation Mode: Regex & masking executed in-browser. Click to toggle live backend.'
                : `Live Backend Mode: Connected to ${backendUrl}. Click to switch to client simulation.`
            }
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.76rem',
              borderColor: apiMode === 'LIVE' ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-medium)',
            }}
          >
            {apiMode === 'MOCK' ? (
              <>
                <Cpu size={13} style={{ color: 'var(--cyan-primary)' }} />
                <span>Engine: <strong style={{ color: 'var(--text-primary)' }}>Client Simulation</strong></span>
              </>
            ) : (
              <>
                <Server size={13} style={{ color: '#10B981' }} />
                <span>Engine: <strong style={{ color: '#34D399' }}>Live API (:8000)</strong></span>
              </>
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.76rem' }}
            title="Configure sensitivity rules and policies"
          >
            <Sliders size={13} />
            <span>Rules</span>
          </button>
        </div>
      </div>
    </header>
  );
};
