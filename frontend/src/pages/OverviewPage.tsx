import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ScanLine,
  ArrowRight,
  ShieldCheck,
  Key,
  Lock,
  Mail,
  Phone,
} from 'lucide-react';
import { useShield } from '../context/ShieldContext';

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { auditLogs, apiMode, policyConfig } = useShield();

  // Genuine statistics calculated strictly from recorded auditLogs with resilient fallbacks
  const totalScans = auditLogs.length;

  const getLogMasked = (log: any): number => {
    if (typeof log.maskedCount === 'number' && !Number.isNaN(log.maskedCount)) {
      return log.maskedCount;
    }
    if (Array.isArray(log.placeholderTokens)) {
      return log.placeholderTokens.length;
    }
    if (log.verdict === 'PROTECTED') {
      return Number(log.totalEntities) || 0;
    }
    return 0;
  };

  const getLogBlocked = (log: any): number => {
    if (typeof log.blockedCount === 'number' && !Number.isNaN(log.blockedCount)) {
      return log.blockedCount;
    }
    if (log.verdict === 'BLOCKED') {
      return Number(log.totalEntities) || 1;
    }
    return 0;
  };

  const getLogAllowed = (log: any): number => {
    if (typeof log.allowedCount === 'number' && !Number.isNaN(log.allowedCount)) {
      return log.allowedCount;
    }
    return 0;
  };

  const getLogEntities = (log: any): number => {
    if (typeof log.totalEntities === 'number' && !Number.isNaN(log.totalEntities)) {
      return log.totalEntities;
    }
    const api = Number(log.entityCounts?.API_KEY) || 0;
    const pass = Number(log.entityCounts?.PASSWORD) || 0;
    const email = Number(log.entityCounts?.EMAIL) || 0;
    const phone = Number(log.entityCounts?.PHONE) || 0;
    const sum = api + pass + email + phone;
    if (sum > 0) return sum;
    return getLogMasked(log) + getLogBlocked(log) + getLogAllowed(log);
  };

  const totalEntities = auditLogs.reduce((acc, log) => acc + getLogEntities(log), 0);
  const totalMasked = auditLogs.reduce((acc, log) => acc + getLogMasked(log), 0);
  const totalBlocked = auditLogs.reduce((acc, log) => acc + getLogBlocked(log), 0);
  const totalAllowed = auditLogs.reduce((acc, log) => acc + getLogAllowed(log), 0);

  const totalApiKeys = auditLogs.reduce(
    (acc, log) => acc + (Number(log.entityCounts?.API_KEY) || 0),
    0
  );
  const totalPasswords = auditLogs.reduce(
    (acc, log) => acc + (Number(log.entityCounts?.PASSWORD) || 0),
    0
  );
  const totalEmails = auditLogs.reduce(
    (acc, log) => acc + (Number(log.entityCounts?.EMAIL) || 0),
    0
  );
  const totalPhones = auditLogs.reduce(
    (acc, log) => acc + (Number(log.entityCounts?.PHONE) || 0),
    0
  );

  const totalThreatTypes = totalApiKeys + totalPasswords + totalEmails + totalPhones;
  const effectiveTotalEntities = Math.max(totalEntities, totalThreatTypes);

  const recentScans = auditLogs.slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', width: '100%' }}>
      {/* Product Hero Banner & Executive Gateway Status */}
      <section
        className="panel"
        style={{
          padding: '2rem 2.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
          background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.04) 0%, rgba(14, 19, 31, 0.95) 100%)',
          borderColor: 'var(--border-medium)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '740px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span
              className="status-badge"
              style={{
                background: apiMode === 'LIVE' ? 'rgba(16, 185, 129, 0.12)' : 'var(--cyan-subtle)',
                color: apiMode === 'LIVE' ? '#34D399' : 'var(--cyan-primary)',
                border: `1px solid ${apiMode === 'LIVE' ? 'rgba(16, 185, 129, 0.3)' : 'var(--cyan-border)'}`,
                fontSize: '0.68rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {apiMode === 'LIVE' ? 'GATEWAY: LIVE BACKEND (:8000)' : 'GATEWAY: CLIENT SIMULATION'}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Active Policy: <strong style={{ color: 'var(--text-primary)' }}>{policyConfig.name}</strong>
            </span>
          </div>

          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
            Verifiable Privacy Gateway for AI Workflows
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Intercept credentials, API tokens, database passwords, and personal identifiers locally before prompts reach third-party LLM providers.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => navigate('/scanner')}
            className="btn btn-primary"
            style={{ padding: '0.65rem 1.45rem', fontSize: '0.84rem' }}
          >
            <ScanLine size={16} />
            <span>Launch Privacy Scan</span>
          </button>
        </div>
      </section>

      {/* Asymmetric Core Metric Array (Clear Hierarchy, Not 5 Identical Cards) */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
        {/* Hero Highlight Metric: Masked Entities */}
        <div
          className="panel"
          style={{
            padding: '1.4rem 1.6rem',
            background: 'linear-gradient(145deg, rgba(0, 240, 255, 0.05) 0%, var(--bg-surface) 100%)',
            border: '1px solid var(--cyan-border)',
            boxShadow: 'var(--shadow-cyan)',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--cyan-primary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
            Entities Neutralized
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--cyan-primary)', fontFamily: 'var(--font-mono)', margin: '0.2rem 0' }}>
            {totalMasked}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Replaced with reversible deterministic tokens
          </div>
        </div>

        {/* Total Scans Evaluated */}
        <div className="panel" style={{ padding: '1.4rem 1.6rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
            Ingress Scans Processed
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', margin: '0.2rem 0' }}>
            {totalScans}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Total prompt payloads inspected in session
          </div>
        </div>

        {/* Blocked Threats */}
        <div
          className="panel"
          style={{
            padding: '1.4rem 1.6rem',
            borderColor: totalBlocked > 0 ? 'rgba(239, 68, 68, 0.35)' : 'var(--border-subtle)',
            background: totalBlocked > 0 ? 'rgba(239, 68, 68, 0.04)' : 'var(--bg-surface)',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: totalBlocked > 0 ? '#EF4444' : 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
            Blocked Threat Dispatches
          </div>
          <div
            style={{
              fontSize: '2.5rem',
              fontWeight: 800,
              color: totalBlocked > 0 ? '#EF4444' : 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              margin: '0.2rem 0',
            }}
          >
            {totalBlocked}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            {totalBlocked > 0 ? 'Prevented from LLM transmission' : 'Zero hard-policy violations'}
          </div>
        </div>

        {/* Plaintext Ingress Allowed */}
        <div className="panel" style={{ padding: '1.4rem 1.6rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
            Transmitted Unmasked
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: totalAllowed > 0 ? '#FBBF24' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', margin: '0.2rem 0' }}>
            {totalAllowed}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Permitted by active user policies
          </div>
        </div>
      </section>

      {/* Threat Distribution Spectrum Visualizer */}
      <section className="panel" style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Threat Vector Distribution Spectrum
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Breakdown of sensitive entity classifications intercepted across all evaluated prompts
            </div>
          </div>
          <div style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: 'var(--cyan-primary)' }}>
            {effectiveTotalEntities} total intercepted
          </div>
        </div>

        {effectiveTotalEntities === 0 ? (
          <div
            style={{
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              background: 'var(--bg-inset)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <ShieldCheck size={26} style={{ color: 'var(--cyan-primary)', opacity: 0.8 }} />
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              No threat vectors logged in current session
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', maxWidth: '420px' }}>
              Select a scenario in the Prompt Scanner or run a custom prompt to generate live telemetry.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Proportional Segmented Bar */}
            <div
              style={{
                height: '10px',
                width: '100%',
                background: 'var(--bg-inset)',
                borderRadius: 'var(--radius-pill)',
                overflow: 'hidden',
                display: 'flex',
              }}
            >
              {totalApiKeys > 0 && (
                <div
                  style={{
                    width: `${(totalApiKeys / effectiveTotalEntities) * 100}%`,
                    background: '#F59E0B',
                    transition: 'width 0.3s ease',
                  }}
                  title={`API Keys: ${totalApiKeys}`}
                />
              )}
              {totalPasswords > 0 && (
                <div
                  style={{
                    width: `${(totalPasswords / effectiveTotalEntities) * 100}%`,
                    background: '#EF4444',
                    transition: 'width 0.3s ease',
                  }}
                  title={`Passwords: ${totalPasswords}`}
                />
              )}
              {totalEmails > 0 && (
                <div
                  style={{
                    width: `${(totalEmails / effectiveTotalEntities) * 100}%`,
                    background: '#00F0FF',
                    transition: 'width 0.3s ease',
                  }}
                  title={`Emails: ${totalEmails}`}
                />
              )}
              {totalPhones > 0 && (
                <div
                  style={{
                    width: `${(totalPhones / effectiveTotalEntities) * 100}%`,
                    background: '#A855F7',
                    transition: 'width 0.3s ease',
                  }}
                  title={`Phones: ${totalPhones}`}
                />
              )}
            </div>

            {/* Entity Category Counters Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem', background: 'var(--bg-inset)', borderRadius: 'var(--radius-sm)' }}>
                <Key size={14} style={{ color: '#F59E0B' }} />
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>API Keys</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{totalApiKeys}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem', background: 'var(--bg-inset)', borderRadius: 'var(--radius-sm)' }}>
                <Lock size={14} style={{ color: '#EF4444' }} />
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Passwords</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{totalPasswords}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem', background: 'var(--bg-inset)', borderRadius: 'var(--radius-sm)' }}>
                <Mail size={14} style={{ color: '#00F0FF' }} />
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Emails</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{totalEmails}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem', background: 'var(--bg-inset)', borderRadius: 'var(--radius-sm)' }}>
                <Phone size={14} style={{ color: '#A855F7' }} />
                <div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Phone Numbers</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{totalPhones}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Recent Telemetry Stream */}
      <section className="panel" style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Recent Security Telemetry Stream
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Latest privacy scans recorded in local session ledger
            </div>
          </div>
          {totalScans > 0 && (
            <button
              onClick={() => navigate('/audit')}
              className="btn btn-ghost"
              style={{ padding: '0.3rem 0.65rem', fontSize: '0.74rem', color: 'var(--cyan-primary)' }}
            >
              <span>Explore All Logs</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>

        {totalScans === 0 ? (
          <div
            style={{
              padding: '2rem 1.5rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.78rem',
            }}
          >
            No scan events recorded yet. Click <strong>"Launch Privacy Scan"</strong> to begin.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {recentScans.map((log) => {
              const isBlocked = log.verdict === 'BLOCKED';
              const isWarning = log.verdict === 'WARNING';
              return (
                <div
                  key={log.id}
                  onClick={() => navigate('/audit')}
                  style={{
                    padding: '0.75rem 1rem',
                    background: 'var(--bg-inset)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-medium)';
                    e.currentTarget.style.background = 'var(--bg-surface-elevated)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.background = 'var(--bg-inset)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '240px', flex: 1 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem',
                        color: 'var(--text-dim)',
                      }}
                    >
                      {log.timestamp}
                    </span>

                    <span
                      className={`status-badge ${
                        isBlocked ? 'status-badge-danger' : isWarning ? 'status-badge-warning' : 'status-badge-success'
                      }`}
                      style={{ fontSize: '0.65rem', padding: '0.1rem 0.45rem' }}
                    >
                      {log.verdict}
                    </span>

                    <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      {log.promptSnippet}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {getLogEntities(log)} {getLogEntities(log) === 1 ? 'threat' : 'threats'} ({getLogMasked(log)} masked)
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      {Number(log.latencyMs) || 0}ms
                    </span>
                    <ArrowRight size={13} style={{ color: 'var(--text-dim)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
