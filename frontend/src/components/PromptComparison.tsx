import React, { useState } from 'react';
import { Columns, Copy, Check, ShieldCheck, Layers } from 'lucide-react';
import type { DetectedEntity } from '../types/shield';

interface PromptComparisonProps {
  originalText: string;
  sanitizedText: string;
  entities: DetectedEntity[];
  mapping: Record<string, string>;
}

export const PromptComparison: React.FC<PromptComparisonProps> = ({
  originalText,
  sanitizedText,
  entities,
  mapping,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'sanitized-only'>('split');

  const handleCopy = () => {
    navigator.clipboard.writeText(sanitizedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Render original text with highlighted sensitive spans
  const renderOriginalHighlighted = () => {
    if (!originalText || entities.length === 0) {
      return <span>{originalText || '(No prompt provided)'}</span>;
    }

    const segments: React.ReactNode[] = [];
    let lastIndex = 0;

    entities.forEach((entity, idx) => {
      if (entity.start < lastIndex) return;

      if (entity.start > lastIndex) {
        segments.push(originalText.slice(lastIndex, entity.start));
      }

      const isBlocked = entity.policy === 'BLOCK';
      const isAllowed = entity.policy === 'ALLOW';

      segments.push(
        <span
          key={`orig-${idx}`}
          className="highlight-detected-raw"
          style={{
            background: isBlocked
              ? 'rgba(239, 68, 68, 0.22)'
              : isAllowed
              ? 'rgba(245, 158, 11, 0.18)'
              : 'rgba(0, 240, 255, 0.15)',
            borderBottom: `2px solid ${isBlocked ? '#EF4444' : isAllowed ? '#F59E0B' : '#00F0FF'}`,
            color: isBlocked ? '#FCA5A5' : isAllowed ? '#FDE68A' : '#7DD3FC',
          }}
          title={`[${entity.entity_type}] Policy: ${entity.policy} (${entity.rule_name})`}
        >
          {entity.value}
        </span>
      );

      lastIndex = entity.end;
    });

    if (lastIndex < originalText.length) {
      segments.push(originalText.slice(lastIndex));
    }

    return <>{segments}</>;
  };

  // Render sanitized text with token pills
  const renderSanitizedHighlighted = () => {
    if (!sanitizedText) {
      return <span style={{ color: 'var(--text-muted)' }}>(Prompt has not been scanned yet)</span>;
    }

    const placeholderRegex = /(\[[A-Z_]+_\d+\]|\[[A-Z_]+_REDACTED\])/g;
    const parts = sanitizedText.split(placeholderRegex);

    return (
      <>
        {parts.map((part, i) => {
          if (placeholderRegex.test(part)) {
            return (
              <span key={`san-${i}`} className="highlight-sanitized-token">
                {part}
              </span>
            );
          }
          return <span key={`text-${i}`}>{part}</span>;
        })}
      </>
    );
  };

  const placeholderCount = Object.keys(mapping).length;

  return (
    <div className="panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header and Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--cyan-subtle)',
              border: '1px solid var(--cyan-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--cyan-primary)',
            }}
          >
            <Columns size={15} />
          </div>
          <div>
            <div style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Dual-Console Payload Comparison
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Verifiable side-by-side diff between raw ingress and sanitized egress payload
            </div>
          </div>
          <span className="status-badge status-badge-cyan" style={{ fontSize: '0.68rem', marginLeft: '0.25rem' }}>
            {placeholderCount} {placeholderCount === 1 ? 'token mapped' : 'tokens mapped'}
          </span>
        </div>

        {/* Console Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* View Mode Toggle */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bg-inset)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-medium)',
              padding: '2px',
              gap: '2px',
            }}
          >
            <button
              onClick={() => setViewMode('split')}
              style={{
                border: 'none',
                background: viewMode === 'split' ? 'var(--bg-surface-elevated)' : 'transparent',
                color: viewMode === 'split' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: viewMode === 'split' ? 700 : 500,
                fontSize: '0.72rem',
                padding: '0.25rem 0.65rem',
                borderRadius: 'var(--radius-xs)',
                cursor: 'pointer',
              }}
            >
              Side-by-Side
            </button>
            <button
              onClick={() => setViewMode('sanitized-only')}
              style={{
                border: 'none',
                background: viewMode === 'sanitized-only' ? 'var(--bg-surface-elevated)' : 'transparent',
                color: viewMode === 'sanitized-only' ? 'var(--text-primary)' : 'var(--text-muted)',
                fontWeight: viewMode === 'sanitized-only' ? 700 : 500,
                fontSize: '0.72rem',
                padding: '0.25rem 0.65rem',
                borderRadius: 'var(--radius-xs)',
                cursor: 'pointer',
              }}
            >
              Sanitized Only
            </button>
          </div>

          {/* Copy Sanitized */}
          <button
            onClick={handleCopy}
            disabled={!sanitizedText}
            className="btn btn-secondary"
            style={{ padding: '0.3rem 0.75rem', fontSize: '0.74rem' }}
            title="Copy exact sanitized payload to clipboard"
          >
            {copied ? (
              <>
                <Check size={13} style={{ color: '#10B981' }} />
                <span style={{ color: '#10B981' }}>Copied</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy Payload</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Comparison Dual-Panes */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: viewMode === 'split' ? '1fr 1fr' : '1fr',
          gap: '1rem',
          alignItems: 'stretch',
        }}
      >
        {/* Left Side: Original Raw */}
        {viewMode === 'split' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444' }} />
                Ingress Raw Prompt (Local Memory Only)
              </span>
              <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                {originalText.length} chars
              </span>
            </div>

            <div
              className="code-panel"
              style={{
                minHeight: '190px',
                maxHeight: '340px',
                overflowY: 'auto',
                borderColor: 'var(--border-subtle)',
              }}
            >
              {renderOriginalHighlighted()}
            </div>

            <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
              Sensitive items flagged prior to transmission. Secrets stay in local memory.
            </div>
          </div>
        )}

        {/* Right Side: Sanitized Payload */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--cyan-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ShieldCheck size={13} />
              Sanitized Egress Payload (Prepared for LLM)
            </span>
            <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              {sanitizedText.length} chars
            </span>
          </div>

          <div
            className="code-panel"
            style={{
              minHeight: '190px',
              maxHeight: '340px',
              overflowY: 'auto',
              borderColor: 'var(--border-medium)',
              boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.4)',
            }}
          >
            {renderSanitizedHighlighted()}
          </div>

          <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
            Tokens like <code>[API_KEY_1]</code> replace raw secrets. Reverse dictionary stored locally.
          </div>
        </div>
      </div>

      {/* Token Mapping Reference Strip */}
      {placeholderCount > 0 && (
        <div
          style={{
            background: 'var(--bg-inset)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.65rem 0.95rem',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
            fontSize: '0.72rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            <Layers size={13} style={{ color: 'var(--cyan-primary)' }} />
            <span>Active Token Dictionary:</span>
          </div>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            {Object.keys(mapping).map((token) => (
              <span
                key={token}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  padding: '0.1rem 0.4rem',
                  borderRadius: 'var(--radius-xs)',
                  background: 'rgba(0, 240, 255, 0.08)',
                  border: '1px solid rgba(0, 240, 255, 0.25)',
                  color: 'var(--cyan-primary)',
                }}
              >
                {token} &rarr; [Vaulted]
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
