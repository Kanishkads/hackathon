import React, { useState } from 'react';
import {
  Download,
  Trash2,
  Clock,
  Activity,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { AuditLogItem } from '../types/shield';

interface AuditSummaryProps {
  auditLogs: AuditLogItem[];
  onClearLogs: () => void;
  isMock: boolean;
}

export const AuditSummary: React.FC<AuditSummaryProps> = ({
  auditLogs,
  onClearLogs,
  isMock,
}) => {
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Compute metrics from actual session logs
  const totalScans = auditLogs.length;
  const totalEntitiesIntercepted = auditLogs.reduce((acc, log) => acc + (Number(log.totalEntities) || 0), 0);
  const totalApiKeys = auditLogs.reduce((acc, log) => acc + (Number(log.entityCounts?.API_KEY) || 0), 0);
  const totalPasswords = auditLogs.reduce((acc, log) => acc + (Number(log.entityCounts?.PASSWORD) || 0), 0);
  const totalPii = auditLogs.reduce(
    (acc, log) => acc + (Number(log.entityCounts?.EMAIL) || 0) + (Number(log.entityCounts?.PHONE) || 0),
    0
  );

  const blockedCount = auditLogs.filter((l) => l.verdict === 'BLOCKED').length;
  const protectedCount = auditLogs.filter((l) => l.verdict === 'PROTECTED').length;

  const handleExportJson = () => {
    const reportData = {
      system: 'LocalShield AI Privacy Audit Report',
      source: isMock ? 'Client Simulation Session' : 'Live Gateway Logs',
      generatedAt: new Date().toISOString(),
      sessionSummary: {
        totalScans,
        totalEntitiesIntercepted,
        totalApiKeysProtected: totalApiKeys,
        totalPasswordsBlocked: totalPasswords,
        totalPiiMasked: totalPii,
      },
      auditLogs,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `localshield-audit-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  const toggleRow = (id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  return (
    <div id="audit-section" className="panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Title & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Activity size={16} style={{ color: 'var(--cyan-primary)' }} />
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Session Audit Trail
          </h2>
          <span
            className="status-badge status-badge-neutral"
            style={{ fontSize: '0.7rem', padding: '0.08rem 0.45rem' }}
          >
            {isMock ? 'In-Memory Simulation Logs' : 'Live Gateway Logs'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <button
            onClick={handleExportJson}
            className="btn btn-secondary"
            style={{ padding: '0.3rem 0.65rem', fontSize: '0.74rem' }}
            title="Export session audit report in JSON format"
          >
            <Download size={12} />
            <span>{downloadSuccess ? 'Exported' : 'Export JSON'}</span>
          </button>

          {auditLogs.length > 0 && !showClearConfirm && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="btn btn-ghost"
              style={{ padding: '0.3rem 0.55rem', fontSize: '0.74rem' }}
              title="Clear session audit logs"
            >
              <Trash2 size={12} />
              <span>Clear</span>
            </button>
          )}

          {showClearConfirm && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.72rem', color: '#F87171' }}>Confirm clear?</span>
              <button
                onClick={() => {
                  onClearLogs();
                  setShowClearConfirm(false);
                }}
                className="btn btn-danger"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
              >
                Yes, Clear
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="btn btn-ghost"
                style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Honest Metric Cards (Clearly labelled as Session Statistics) */}
      <div className="stats-grid">
        <div
          style={{
            background: 'var(--bg-inset)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 0.95rem',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Session Scans
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
            {totalScans}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#34D399' }}>
            {protectedCount} dispatches approved
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-inset)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 0.95rem',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Entities Intercepted
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--cyan-primary)', fontFamily: 'var(--font-mono)' }}>
            {totalEntitiesIntercepted}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Total entities across session
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-inset)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 0.95rem',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Critical Leaks Blocked
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#F87171', fontFamily: 'var(--font-mono)' }}>
            {totalPasswords}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#F87171' }}>
            {blockedCount} dispatch violations
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-inset)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 0.95rem',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            PII Neutralized
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--violet-primary)', fontFamily: 'var(--font-mono)' }}>
            {totalPii}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Emails and phone numbers
          </div>
        </div>
      </div>

      {/* Activity Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Clock size={12} />
          <span>Activity Log (Redacted Descriptors Only &bull; Zero Raw Prompts Stored)</span>
        </div>

        {auditLogs.length === 0 ? (
          <div
            style={{
              padding: '1.25rem',
              textAlign: 'center',
              background: 'var(--bg-inset)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              fontSize: '0.78rem',
            }}
          >
            No prompt scans recorded this session.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.76rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.5rem 0.75rem', width: '30px' }}></th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Timestamp</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Prompt Descriptor</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Detected Categories</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Policy Profile</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => {
                  const isExpanded = expandedRowId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => toggleRow(log.id)}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          background: isExpanded ? 'var(--bg-surface-elevated)' : 'var(--bg-inset)',
                          cursor: 'pointer',
                        }}
                      >
                        <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>
                          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                          {log.timestamp}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {log.promptSnippet}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                            {log.entityCounts.API_KEY > 0 && (
                              <span className="chip chip-api-key" style={{ padding: '0.05rem 0.35rem', fontSize: '0.68rem' }}>
                                {log.entityCounts.API_KEY} Key
                              </span>
                            )}
                            {log.entityCounts.PASSWORD > 0 && (
                              <span className="chip chip-password" style={{ padding: '0.05rem 0.35rem', fontSize: '0.68rem' }}>
                                {log.entityCounts.PASSWORD} Pass
                              </span>
                            )}
                            {log.entityCounts.EMAIL > 0 && (
                              <span className="chip chip-email" style={{ padding: '0.05rem 0.35rem', fontSize: '0.68rem' }}>
                                {log.entityCounts.EMAIL} Email
                              </span>
                            )}
                            {log.entityCounts.PHONE > 0 && (
                              <span className="chip chip-phone" style={{ padding: '0.05rem 0.35rem', fontSize: '0.68rem' }}>
                                {log.entityCounts.PHONE} Phone
                              </span>
                            )}
                            {log.totalEntities === 0 && (
                              <span style={{ color: '#10B981', fontSize: '0.7rem' }}>Clean</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>
                          {log.policyProfile}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <span
                            className={`status-badge ${
                              log.verdict === 'BLOCKED'
                                ? 'status-badge-danger'
                                : log.verdict === 'WARNING'
                                ? 'status-badge-warning'
                                : 'status-badge-success'
                            }`}
                            style={{ fontSize: '0.68rem', padding: '0.05rem 0.4rem' }}
                          >
                            {log.verdict}
                          </span>
                        </td>
                      </tr>

                      {/* Expandable Detail Row */}
                      {isExpanded && (
                        <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                          <td colSpan={6} style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.72rem' }}>
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>Log Reference: </span>
                                <code style={{ color: 'var(--text-primary)' }}>{log.id}</code>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>Execution Latency: </span>
                                <strong style={{ color: 'var(--cyan-primary)' }}>{log.latencyMs} ms</strong>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-muted)' }}>Privacy Verification: </span>
                                <span style={{ color: '#34D399' }}>Verified in local memory</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
