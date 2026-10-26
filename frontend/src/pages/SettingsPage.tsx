import React, { useState } from 'react';
import {
  Server,
  Cpu,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useShield } from '../context/ShieldContext';

export const SettingsPage: React.FC = () => {
  const {
    apiMode,
    toggleApiMode,
    backendUrl,
    setBackendUrl,
    backendHealth,
    checkBackendHealth,
    auditLogs,
    clearAuditLogs,
  } = useShield();

  const [inputUrl, setInputUrl] = useState(backendUrl);
  const [urlSavedFeedback, setUrlSavedFeedback] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleSaveUrl = () => {
    setBackendUrl(inputUrl);
    setUrlSavedFeedback(true);
    setTimeout(() => setUrlSavedFeedback(false), 2000);
  };

  // Estimate storage usage in localStorage
  const bytes = new Blob([JSON.stringify(auditLogs)]).size;
  const storageFootprint = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

  const detectionRules = [
    { name: 'email_pattern', type: 'EMAIL', desc: 'RFC 5322 compliant email regular expression with domain validation' },
    { name: 'phone_pattern', type: 'PHONE', desc: 'Domestic, international, and E.164 formatted telephone numbers' },
    { name: 'openai_api_key', type: 'API_KEY', desc: 'Vendor pattern matching sk-... (≥20 chars), sk-proj-..., and synthetic test keys (sk-test-...)' },
    { name: 'aws_access_key', type: 'API_KEY', desc: 'AWS IAM access key IDs matching AKIA[0-9A-Z]{16}' },
    { name: 'github_token', type: 'API_KEY', desc: 'GitHub personal access tokens matching gh[pousr]_[0-9A-Za-z_]{36,}' },
    { name: 'slack_token', type: 'API_KEY', desc: 'Slack bot and user tokens matching xox[baprs]-...' },
    { name: 'bearer_token', type: 'API_KEY', desc: 'HTTP Bearer authorization token header assignments' },
    { name: 'generic_api_key_assignment', type: 'API_KEY', desc: 'Generic secret key / token assignments ([:=] or natural language "is", ≥14 chars)' },
    { name: 'password_assignment', type: 'PASSWORD', desc: 'Database passwords and application secret key configuration statements' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '1000px', width: '100%' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
          Gateway Configuration &amp; Specifications
        </h1>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Manage backend endpoints, verify live connectivity, inspect detection rules, and configure local audit storage.
        </p>
      </div>

      {/* 1. Engine Operating Mode Section */}
      <section className="panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Gateway Operating Architecture
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Choose whether prompt sanitization executes in the browser client or dispatches to a live backend proxy.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {/* Option A: Client-Side Simulation */}
          <div
            onClick={() => { if (apiMode === 'LIVE') toggleApiMode(); }}
            style={{
              padding: '1.25rem',
              background: apiMode === 'MOCK' ? 'rgba(0, 240, 255, 0.04)' : 'var(--bg-inset)',
              border: `1px solid ${apiMode === 'MOCK' ? 'var(--cyan-border)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              boxShadow: apiMode === 'MOCK' ? 'var(--shadow-cyan)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Cpu size={16} style={{ color: 'var(--cyan-primary)' }} />
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  Client Simulation Engine
                </span>
              </div>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: apiMode === 'MOCK' ? 'var(--cyan-primary)' : 'var(--border-medium)',
                }}
              />
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              All detection, masking, and policy rules execute locally in JavaScript. No data ever leaves the browser; zero external network requests.
            </p>
            {apiMode === 'MOCK' && (
              <span className="status-badge status-badge-cyan" style={{ alignSelf: 'flex-start', fontSize: '0.65rem' }}>
                ACTIVE ENGINE
              </span>
            )}
          </div>

          {/* Option B: Live Backend Gateway */}
          <div
            onClick={() => { if (apiMode === 'MOCK') toggleApiMode(); }}
            style={{
              padding: '1.25rem',
              background: apiMode === 'LIVE' ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-inset)',
              border: `1px solid ${apiMode === 'LIVE' ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-subtle)'}`,
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Server size={16} style={{ color: '#34D399' }} />
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  Live Backend Gateway Proxy
                </span>
              </div>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: apiMode === 'LIVE' ? '#10B981' : 'var(--border-medium)',
                }}
              />
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Routes sanitized prompts strictly through the configured backend proxy server (requires active backend listener at :8000).
            </p>
            {apiMode === 'LIVE' && (
              <span className="status-badge status-badge-success" style={{ alignSelf: 'flex-start', fontSize: '0.65rem' }}>
                ACTIVE GATEWAY
              </span>
            )}
          </div>
        </div>
      </section>

      {/* 2. Backend Connectivity & Health Ping */}
      <section className="panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Backend Gateway Connectivity
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Verify reachability of your teammate's backend server before dispatching in Live Mode.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="http://localhost:8000"
            style={{
              flex: 1,
              minWidth: '240px',
              background: 'var(--bg-inset)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.55rem 0.85rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.78rem',
              outline: 'none',
            }}
          />

          <button onClick={handleSaveUrl} className="btn btn-secondary" style={{ padding: '0.55rem 0.95rem' }}>
            <span>{urlSavedFeedback ? 'Saved' : 'Save URL'}</span>
          </button>

          <button
            onClick={() => {
              setBackendUrl(inputUrl);
              checkBackendHealth();
            }}
            disabled={backendHealth.checking}
            className="btn btn-primary"
            style={{ padding: '0.55rem 1.15rem' }}
          >
            <RefreshCw size={13} className={backendHealth.checking ? 'spin' : ''} />
            <span>Ping /health</span>
          </button>
        </div>

        {/* Health Check Result */}
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'var(--bg-inset)',
            border: `1px solid ${backendHealth.online ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.74rem',
          }}
        >
          {backendHealth.online ? (
            <CheckCircle2 size={15} style={{ color: '#10B981', flexShrink: 0 }} />
          ) : (
            <AlertTriangle size={15} style={{ color: '#FBBF24', flexShrink: 0 }} />
          )}
          <span style={{ color: backendHealth.online ? '#34D399' : 'var(--text-secondary)' }}>
            {backendHealth.message}
          </span>
        </div>
      </section>

      {/* 3. Storage & Audit Footprint */}
      <section className="panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Audit Ledger Storage Footprint
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Non-sensitive audit metadata stored locally in browser <code>localStorage</code>.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {auditLogs.length} events &bull; {storageFootprint}
            </span>

            {!showClearConfirm ? (
              <button
                onClick={() => setShowClearConfirm(true)}
                disabled={auditLogs.length === 0}
                className="btn btn-ghost"
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.74rem', color: '#F87171' }}
              >
                <Trash2 size={13} />
                <span>Clear All Logs</span>
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#F87171' }}>Clear all logs?</span>
                <button
                  onClick={() => {
                    clearAuditLogs();
                    setShowClearConfirm(false);
                  }}
                  className="btn btn-danger"
                  style={{ padding: '0.25rem 0.55rem', fontSize: '0.7rem' }}
                >
                  Confirm
                </button>
                <button onClick={() => setShowClearConfirm(false)} className="btn btn-ghost" style={{ padding: '0.25rem 0.45rem', fontSize: '0.7rem' }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Engine Heuristics & Rules Specification Table */}
      <section className="panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Engine Detection Heuristics Specification
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Patterns and heuristics synchronized with <code>backend/app/engine/detector.py</code>.
          </div>
        </div>

        <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.74rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-inset)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.6rem 0.95rem' }}>Rule Identifier</th>
                <th style={{ padding: '0.6rem 0.95rem' }}>Entity Class</th>
                <th style={{ padding: '0.6rem 0.95rem' }}>Heuristic Specification</th>
              </tr>
            </thead>
            <tbody>
              {detectionRules.map((rule) => (
                <tr key={rule.name} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '0.6rem 0.95rem', fontFamily: 'var(--font-mono)', color: 'var(--cyan-primary)', fontWeight: 600 }}>
                    {rule.name}
                  </td>
                  <td style={{ padding: '0.6rem 0.95rem' }}>
                    <span className="status-badge status-badge-neutral" style={{ fontSize: '0.65rem' }}>
                      {rule.type}
                    </span>
                  </td>
                  <td style={{ padding: '0.6rem 0.95rem', color: 'var(--text-muted)' }}>
                    {rule.desc}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
