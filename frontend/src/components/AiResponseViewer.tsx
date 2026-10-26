import React, { useState } from 'react';
import {
  Bot,
  Copy,
  Check,
  RefreshCw,
  Info,
} from 'lucide-react';
import type { AIResponse } from '../types/shield';

interface AiResponseViewerProps {
  response: AIResponse | null;
  isLoading?: boolean;
  mapping: Record<string, string>;
}

export const AiResponseViewer: React.FC<AiResponseViewerProps> = ({
  response,
  isLoading = false,
  mapping,
}) => {
  const [copied, setCopied] = useState(false);
  const [isRehydrated, setIsRehydrated] = useState(false);

  const placeholderCount = Object.keys(mapping).length;

  if (isLoading) {
    return (
      <div className="panel" style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
        <div className="spin" style={{ width: '24px', height: '24px', border: '3px solid var(--border-medium)', borderTopColor: 'var(--cyan-primary)', borderRadius: '50%' }} />
        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
          Generating Gateway Completion...
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '400px' }}>
          Simulating proxy gateway response in local browser memory. No external network call or AI provider request is made.
        </div>
      </div>
    );
  }

  if (!response) {
    return null;
  }

  const currentContent = isRehydrated ? response.rehydratedCompletion : response.rawCompletion;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderFormattedResponse = () => {
    const lines = currentContent.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('```')) {
        return (
          <div key={idx} style={{ color: 'var(--cyan-primary)', fontWeight: 600, margin: '0.4rem 0' }}>
            {line}
          </div>
        );
      }
      if (line.startsWith('###')) {
        return (
          <h3 key={idx} style={{ fontSize: '0.98rem', margin: '0.8rem 0 0.3rem 0', color: 'var(--text-primary)', fontWeight: 700 }}>
            {line.replace(/^###\s*/, '')}
          </h3>
        );
      }
      return (
        <div key={idx} style={{ minHeight: '1.25em' }}>
          {line}
        </div>
      );
    });
  };

  return (
    <div className="panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Response Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--cyan-subtle)',
              border: '1px solid var(--cyan-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--cyan-primary)',
            }}
          >
            <Bot size={15} />
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>
              AI Response Stream {response.isMock ? '(Client Simulation)' : '(Live Gateway)'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Model: <strong style={{ color: 'var(--text-primary)' }}>{response.model}</strong> {response.isMock ? '(Local Simulator)' : '(Live)'} &bull; Latency: <strong style={{ color: 'var(--cyan-primary)' }}>{response.latencyMs}ms</strong>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Local Rehydration Toggle */}
          {placeholderCount > 0 && (
            <button
              onClick={() => setIsRehydrated(!isRehydrated)}
              className="btn btn-secondary"
              style={{
                padding: '0.3rem 0.65rem',
                fontSize: '0.74rem',
                borderColor: isRehydrated ? 'var(--cyan-primary)' : 'var(--border-medium)',
                background: isRehydrated ? 'var(--cyan-subtle)' : 'var(--bg-surface-elevated)',
                color: isRehydrated ? 'var(--cyan-primary)' : 'var(--text-secondary)',
              }}
              title="Restores placeholders to original values in local browser memory only"
            >
              <RefreshCw size={12} style={{ transform: isRehydrated ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }} />
              <span>
                Local Rehydration: <strong>{isRehydrated ? 'ON (De-anonymized)' : 'OFF (Sanitized)'}</strong>
              </span>
            </button>
          )}

          <button
            onClick={handleCopy}
            className="btn btn-secondary"
            style={{ padding: '0.3rem 0.65rem', fontSize: '0.74rem' }}
          >
            {copied ? (
              <>
                <Check size={13} style={{ color: '#10B981' }} />
                <span style={{ color: '#10B981' }}>Copied</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notice on Privacy & Local Rehydration */}
      <div
        style={{
          background: 'var(--bg-inset)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '0.5rem 0.75rem',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Info size={13} style={{ color: 'var(--cyan-primary)', flexShrink: 0 }} />
          <span>
            {isRehydrated ? (
              <>
                <strong>Local Rehydration Active:</strong> Tokens were substituted with original values in browser memory for viewing. The upstream AI model only saw sanitized tokens.
              </>
            ) : (
              <>
                <strong>Sanitized Stream:</strong> The response shows structured tokens as produced by the AI model without exposing raw secrets.
              </>
            )}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>
          <span>In: ~{response.tokensPrompt} tok</span>
          <span>Out: ~{response.tokensCompletion} tok</span>
        </div>
      </div>

      {/* Response Panel */}
      <div
        className="code-panel"
        style={{
          minHeight: '180px',
          borderColor: 'var(--border-subtle)',
        }}
      >
        {renderFormattedResponse()}
      </div>
    </div>
  );
};
