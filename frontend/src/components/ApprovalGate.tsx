import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Send,
  RotateCcw,
  Info,
} from 'lucide-react';
import type { DetectedEntity, OverallVerdict } from '../types/shield';

interface ApprovalGateProps {
  verdict?: OverallVerdict;
  blockReasons?: string[];
  entities?: DetectedEntity[];
  sanitizedText?: string;
  isMock?: boolean;
  onApproveAndDispatch: () => void;
  onReset: () => void;
  isDispatching?: boolean;
}

export const ApprovalGate: React.FC<ApprovalGateProps> = ({
  verdict = 'PROTECTED',
  blockReasons = [],
  entities = [],
  sanitizedText = '',
  isMock = false,
  onApproveAndDispatch,
  onReset,
  isDispatching = false,
}) => {
  const isBlocked = verdict === 'BLOCKED';
  const isWarning = verdict === 'WARNING';

  const safeEntities = Array.isArray(entities) ? entities : [];
  const safeSanitized = typeof sanitizedText === 'string' ? sanitizedText : '';

  const maskedEntities = safeEntities.filter((e) => e?.policy === 'MASK');
  const allowedEntities = safeEntities.filter((e) => e?.policy === 'ALLOW');
  const blockedEntities = safeEntities.filter((e) => e?.policy === 'BLOCK');

  const getStatusLabel = () => {
    if (isBlocked) return 'Dispatch Blocked by Security Policy';
    if (isWarning) return isMock ? 'Simulation: Policy Warning (Unmasked Entities)' : 'Gateway Warning (Unmasked Entities)';
    return isMock ? 'Sanitized: Ready for Simulated Dispatch' : 'Sanitized: Ready for Gateway Dispatch';
  };

  const getStatusBadge = () => {
    if (isBlocked) {
      return (
        <span className="status-badge status-badge-danger">
          <AlertOctagon size={12} />
          <span>BLOCKED</span>
        </span>
      );
    }
    if (isWarning) {
      return (
        <span className="status-badge status-badge-warning">
          <AlertTriangle size={12} />
          <span>ALLOW OVERRIDE</span>
        </span>
      );
    }
    return (
      <span className="status-badge status-badge-success">
        <CheckCircle2 size={12} />
        <span>{isMock ? 'READY (SIMULATED)' : 'READY (GATEWAY)'}</span>
      </span>
    );
  };

  return (
    <div
      className="panel"
      style={{
        padding: '1.25rem 1.5rem',
        borderLeft: `3px solid ${
          isBlocked ? '#EF4444' : isWarning ? '#F59E0B' : 'var(--cyan-primary)'
        }`,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.9rem',
      }}
    >
      {/* Status Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <h3 style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {getStatusLabel()}
            </h3>
            {getStatusBadge()}
          </div>
          <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            {isBlocked
              ? 'Security rules prevent payload dispatch due to blocked high-risk credentials.'
              : isWarning
              ? 'One or more sensitive values will be transmitted in plain text per your ALLOW policy.'
              : 'Sanitization verified. Inspect the token distribution below before dispatching.'}
          </p>
        </div>
      </div>

      {/* Block Details (Compact & Crisp without dominating the page) */}
      {isBlocked && blockReasons.length > 0 && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.65rem 0.95rem',
            fontSize: '0.74rem',
            color: '#FCA5A5',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <AlertOctagon size={13} style={{ color: '#EF4444' }} />
            <span>Policy Violation Directives:</span>
          </div>
          <ul style={{ paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            {blockReasons.map((reason, idx) => (
              <li key={idx}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Entity Routing Summary Telemetry */}
      <div
        style={{
          background: 'var(--bg-inset)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.75rem 1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.75rem',
          fontSize: '0.74rem',
        }}
      >
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 600 }}>
            Masked With Tokens:
          </div>
          <div style={{ fontWeight: 800, color: 'var(--cyan-primary)', fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>
            {maskedEntities.length}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
            Replaced with structured symbols
          </div>
        </div>

        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 600 }}>
            Transmitted Unmasked:
          </div>
          <div style={{ fontWeight: 800, color: allowedEntities.length > 0 ? '#FBBF24' : 'var(--text-secondary)', fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>
            {allowedEntities.length}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
            Allowed by user policy
          </div>
        </div>

        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 600 }}>
            Blocked Violations:
          </div>
          <div style={{ fontWeight: 800, color: blockedEntities.length > 0 ? '#EF4444' : 'var(--text-secondary)', fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>
            {blockedEntities.length}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
            Must be resolved before dispatch
          </div>
        </div>
      </div>

      {/* Mode Disclaimer & Action Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <Info size={12} style={{ flexShrink: 0, color: 'var(--cyan-primary)' }} />
          <span>
            {isMock
              ? 'Client simulation active: All detection & masking executed in-browser. Zero external network requests.'
              : 'Live gateway mode: Exact sanitized payload will be transmitted to configured backend proxy.'}
          </span>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={onReset}
            className="btn btn-ghost"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.76rem', border: '1px solid var(--border-medium)' }}
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>

          <button
            onClick={onApproveAndDispatch}
            disabled={isBlocked || isDispatching || !safeSanitized.trim()}
            className="btn btn-primary"
            style={{
              padding: '0.55rem 1.45rem',
              fontSize: '0.8125rem',
              background: isBlocked ? 'var(--bg-surface-elevated)' : 'var(--cyan-primary)',
              color: isBlocked ? 'var(--text-muted)' : '#07090E',
              borderColor: isBlocked ? 'var(--border-subtle)' : 'var(--cyan-primary)',
            }}
          >
            {isDispatching ? (
              <>
                <div
                  className="spin"
                  style={{
                    width: '13px',
                    height: '13px',
                    border: '2px solid #07090E',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                  }}
                />
                <span>{isMock ? 'Simulating AI Gateway Response...' : 'Dispatching to Gateway...'}</span>
              </>
            ) : (
              <>
                <Send size={13} />
                <span>
                  {isBlocked
                    ? 'Blocked by Policy'
                    : isMock
                    ? 'Confirm & Dispatch (Simulated AI)'
                    : 'Dispatch Sanitized Payload to Gateway'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
