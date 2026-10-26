import React, { useState, useMemo } from 'react';
import {
  Download,
  Trash2,
  Search,
  ChevronRight,
  X,
  Info,
  Shield,
  Check,
} from 'lucide-react';
import { useShield } from '../context/ShieldContext';
import type { AuditLogItem, EntityType } from '../types/shield';

export const AuditPage: React.FC = () => {
  const { auditLogs, clearAuditLogs } = useShield();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVerdict, setSelectedVerdict] = useState<string>('ALL');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('ALL');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AuditLogItem | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSnippet = log.promptSnippet.toLowerCase().includes(q);
        const matchesId = log.id.toLowerCase().includes(q);
        const matchesPolicy = log.policyProfile.toLowerCase().includes(q);
        if (!matchesSnippet && !matchesId && !matchesPolicy) return false;
      }

      // Verdict filter
      if (selectedVerdict !== 'ALL') {
        if (log.verdict !== selectedVerdict) return false;
      }

      // Entity type filter
      if (selectedEntityType !== 'ALL') {
        const count = log.entityCounts[selectedEntityType as EntityType] || 0;
        if (count === 0) return false;
      }

      return true;
    });
  }, [auditLogs, searchQuery, selectedVerdict, selectedEntityType]);

  // Export JSON of actual recorded audit logs
  const handleExportJson = () => {
    if (auditLogs.length === 0) return;

    const dataStr = JSON.stringify(auditLogs, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `localshield-audit-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  const copyEventId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Header & Persistence Notice */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
            Security Audit Trail
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Session ledger of prompt scans, token substitutions, and policy evaluations. Raw prompts and plaintext credentials are never stored.
          </p>
        </div>

        {/* Action Buttons: Export & Clear */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={handleExportJson}
            disabled={auditLogs.length === 0}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.76rem' }}
          >
            <Download size={13} />
            <span>{downloadSuccess ? 'Exported JSON' : 'Export Logs (JSON)'}</span>
          </button>

          {auditLogs.length > 0 && !showClearConfirm && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="btn btn-ghost"
              style={{ padding: '0.45rem 0.75rem', fontSize: '0.76rem', color: '#F87171' }}
            >
              <Trash2 size={13} />
              <span>Clear History</span>
            </button>
          )}

          {showClearConfirm && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.72rem', color: '#F87171' }}>Permanently clear?</span>
              <button
                onClick={() => {
                  clearAuditLogs();
                  setShowClearConfirm(false);
                  setSelectedRecord(null);
                }}
                className="btn btn-danger"
                style={{ padding: '0.3rem 0.65rem', fontSize: '0.72rem' }}
              >
                Confirm
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="btn btn-ghost"
                style={{ padding: '0.3rem 0.55rem', fontSize: '0.72rem' }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Information Banner regarding Persistence */}
      <div
        style={{
          background: 'var(--bg-inset)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.75rem 1rem',
          fontSize: '0.74rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
        }}
      >
        <Info size={15} style={{ color: 'var(--cyan-primary)', flexShrink: 0 }} />
        <span>
          <strong>Zero-Plaintext Persistence:</strong> Only non-sensitive metadata (event IDs, timestamps, token names, entity counts) is persisted across browser sessions in <code>localStorage</code>. Raw prompt text and unmasked secrets are <strong>never written</strong> to storage.
        </span>
      </div>

      {/* Search and Filters Bar */}
      <div
        className="panel"
        style={{
          padding: '0.85rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.85rem',
        }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '280px', flex: 1 }}>
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audit trail by prompt snippet, ID, or policy..."
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.8125rem',
              width: '100%',
              fontFamily: 'var(--font-sans)',
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="btn btn-ghost" style={{ padding: '0.1rem 0.3rem' }}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Verdict Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Verdict:</span>
            <select
              value={selectedVerdict}
              onChange={(e) => setSelectedVerdict(e.target.value)}
              style={{
                background: 'var(--bg-inset)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-xs)',
                padding: '0.25rem 0.6rem',
                fontSize: '0.74rem',
                outline: 'none',
              }}
            >
              <option value="ALL">All Verdicts</option>
              <option value="PROTECTED">PROTECTED</option>
              <option value="WARNING">WARNING</option>
              <option value="BLOCKED">BLOCKED</option>
            </select>
          </div>

          {/* Entity Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Entity:</span>
            <select
              value={selectedEntityType}
              onChange={(e) => setSelectedEntityType(e.target.value)}
              style={{
                background: 'var(--bg-inset)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-xs)',
                padding: '0.25rem 0.6rem',
                fontSize: '0.74rem',
                outline: 'none',
              }}
            >
              <option value="ALL">All Types</option>
              <option value="API_KEY">API Keys</option>
              <option value="PASSWORD">Passwords</option>
              <option value="EMAIL">Emails</option>
              <option value="PHONE">Phones</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Audit Data Table */}
      <div className="panel" style={{ overflow: 'hidden' }}>
        {filteredLogs.length === 0 ? (
          <div
            style={{
              padding: '3.5rem 1.5rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.65rem',
            }}
          >
            <Shield size={32} style={{ color: 'var(--text-dim)', opacity: 0.6 }} />
            <div style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              No Audit Records Found
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', maxWidth: '420px' }}>
              {auditLogs.length === 0
                ? 'Your session audit trail is empty. Scans executed in the Prompt Scanner will automatically log non-sensitive metadata here.'
                : 'No records matched your search query or filter criteria.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
              <thead>
                <tr
                  style={{
                    background: 'var(--bg-inset)',
                    borderBottom: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <th style={{ padding: '0.65rem 1rem' }}>Event ID</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Timestamp</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Prompt Descriptor</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Verdict</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Entities Intercepted</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Mode</th>
                  <th style={{ padding: '0.65rem 1rem' }}>Latency</th>
                  <th style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => {
                  const isBlocked = log.verdict === 'BLOCKED';
                  const isWarning = log.verdict === 'WARNING';

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedRecord(log)}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-surface-elevated)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      {/* Event ID with copy */}
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.74rem' }}>
                        <span
                          onClick={(e) => copyEventId(log.id, e)}
                          title="Click to copy Event ID"
                          style={{
                            color: 'var(--cyan-primary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            cursor: 'copy',
                          }}
                        >
                          {copiedId === log.id ? <Check size={11} style={{ color: '#10B981' }} /> : null}
                          <span>{log.id}</span>
                        </span>
                      </td>

                      {/* Timestamp */}
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                        {log.timestamp}
                      </td>

                      {/* Prompt Descriptor */}
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.promptSnippet}
                      </td>

                      {/* Verdict Badge */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span
                          className={`status-badge ${
                            isBlocked ? 'status-badge-danger' : isWarning ? 'status-badge-warning' : 'status-badge-success'
                          }`}
                          style={{ fontSize: '0.66rem', padding: '0.1rem 0.45rem' }}
                        >
                          {log.verdict}
                        </span>
                      </td>

                      {/* Entities Count & Breakdown */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {(Number(log.entityCounts?.API_KEY) || 0) > 0 && (
                            <span className="entity-badge entity-badge-api_key" style={{ fontSize: '0.65rem' }}>
                              {log.entityCounts.API_KEY} Key
                            </span>
                          )}
                          {(Number(log.entityCounts?.PASSWORD) || 0) > 0 && (
                            <span className="entity-badge entity-badge-password" style={{ fontSize: '0.65rem' }}>
                              {log.entityCounts.PASSWORD} Pass
                            </span>
                          )}
                          {(Number(log.entityCounts?.EMAIL) || 0) > 0 && (
                            <span className="entity-badge entity-badge-email" style={{ fontSize: '0.65rem' }}>
                              {log.entityCounts.EMAIL} Email
                            </span>
                          )}
                          {(Number(log.entityCounts?.PHONE) || 0) > 0 && (
                            <span className="entity-badge entity-badge-phone" style={{ fontSize: '0.65rem' }}>
                              {log.entityCounts.PHONE} Phone
                            </span>
                          )}
                          {(Number(log.totalEntities) || 0) === 0 && (
                            <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>None</span>
                          )}
                        </div>
                      </td>

                      {/* Execution Mode */}
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {log.executionMode}
                        </span>
                      </td>

                      {/* Latency */}
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                        {log.latencyMs}ms
                      </td>

                      {/* Detail Action */}
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRecord(log);
                          }}
                          className="btn btn-ghost"
                          style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem', color: 'var(--cyan-primary)' }}
                        >
                          <span>Inspect</span>
                          <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Slide-Over / Modal */}
      {selectedRecord && (
        <div className="modal-backdrop" onClick={() => setSelectedRecord(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '640px' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Event Telemetry Inspector
                  </span>
                  <span
                    className={`status-badge ${
                      selectedRecord.verdict === 'BLOCKED'
                        ? 'status-badge-danger'
                        : selectedRecord.verdict === 'WARNING'
                        ? 'status-badge-warning'
                        : 'status-badge-success'
                    }`}
                    style={{ fontSize: '0.68rem' }}
                  >
                    {selectedRecord.verdict}
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--cyan-primary)' }}>
                  ID: {selectedRecord.id} &bull; {selectedRecord.timestamp}
                </div>
              </div>

              <button onClick={() => setSelectedRecord(null)} className="btn btn-ghost" style={{ padding: '0.25rem' }}>
                <X size={16} />
              </button>
            </div>

            {/* Event Specs Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.75rem',
                background: 'var(--bg-inset)',
                padding: '0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.74rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Policy Profile:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedRecord.policyProfile}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Execution Mode:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedRecord.executionMode}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Entities Detected:</span>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {selectedRecord.totalEntities ?? 0} total ({selectedRecord.maskedCount ?? 0} masked, {selectedRecord.blockedCount ?? 0} blocked, {selectedRecord.allowedCount ?? 0} allowed)
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Execution Latency:</span>
                <div style={{ fontWeight: 600, color: 'var(--cyan-primary)', fontFamily: 'var(--font-mono)' }}>
                  {selectedRecord.latencyMs} ms
                </div>
              </div>
            </div>

            {/* Prompt Snippet */}
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                Logged Prompt Descriptor:
              </div>
              <div
                style={{
                  background: 'var(--bg-inset)',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.78rem',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {selectedRecord.promptSnippet}
              </div>
            </div>

            {/* Token Substitutions */}
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 600 }}>
                Deterministic Tokens Substituted:
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {selectedRecord.placeholderTokens && selectedRecord.placeholderTokens.length > 0 ? (
                  selectedRecord.placeholderTokens.map((tok) => (
                    <span
                      key={tok}
                      style={{
                        padding: '0.15rem 0.45rem',
                        background: 'rgba(0, 240, 255, 0.08)',
                        border: '1px solid rgba(0, 240, 255, 0.25)',
                        color: 'var(--cyan-primary)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.72rem',
                        borderRadius: 'var(--radius-xs)',
                      }}
                    >
                      {tok}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>
                    No placeholder tokens mapped for this event.
                  </span>
                )}
              </div>
            </div>

            {/* Close Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
              <button onClick={() => setSelectedRecord(null)} className="btn btn-secondary" style={{ padding: '0.4rem 1rem' }}>
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
