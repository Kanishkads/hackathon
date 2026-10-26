import React, { useEffect, useRef } from 'react';
import { Scan, Sparkles, Trash2, Terminal } from 'lucide-react';
import { SAMPLE_PROMPTS } from '../data/samplePrompts';
import type { SamplePrompt } from '../data/samplePrompts';

interface PromptScannerProps {
  promptText: string;
  setPromptText: (text: string) => void;
  onScan: () => void;
  isScanning: boolean;
  hasScanned: boolean;
}

export const PromptScanner: React.FC<PromptScannerProps> = ({
  promptText,
  setPromptText,
  onScan,
  isScanning,
  hasScanned,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keyboard shortcut Ctrl+Enter or Cmd+Enter to scan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (promptText.trim() && !isScanning) {
          e.preventDefault();
          onScan();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [promptText, isScanning, onScan]);

  const charCount = promptText.length;
  const wordCount = promptText.trim() ? promptText.trim().split(/\s+/).length : 0;
  const estimatedTokens = Math.max(0, Math.ceil(charCount / 4));

  const handleSelectSample = (sample: SamplePrompt) => {
    setPromptText(sample.text);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Top Header: Title & Scenario Presets Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
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
            <Terminal size={15} />
          </div>
          <div>
            <div style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Ingress Prompt Editor
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Inspect and sanitize sensitive payloads before AI dispatch
            </div>
          </div>
        </div>

        {/* Clear prompt action */}
        {promptText && (
          <button
            onClick={() => setPromptText('')}
            className="btn btn-ghost"
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}
            title="Clear prompt text"
          >
            <Trash2 size={12} />
            <span>Clear Editor</span>
          </button>
        )}
      </div>

      {/* Test Scenario Vector Pills */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Synthetic Test Vectors:
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
            Select to preload test scenario
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {SAMPLE_PROMPTS.map((sample) => {
            const isSelected = promptText === sample.text;
            return (
              <button
                key={sample.id}
                onClick={() => handleSelectSample(sample)}
                className="btn btn-ghost"
                style={{
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.72rem',
                  border: isSelected ? '1px solid var(--cyan-primary)' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'rgba(0, 240, 255, 0.08)' : 'var(--bg-inset)',
                  color: isSelected ? 'var(--cyan-primary)' : 'var(--text-secondary)',
                  fontWeight: isSelected ? 700 : 500,
                  transition: 'all 0.15s ease',
                }}
              >
                <Sparkles size={11} style={{ color: isSelected ? 'var(--cyan-primary)' : 'var(--text-muted)' }} />
                <span>{sample.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Editor Surface */}
      <div style={{ position: 'relative' }}>
        <textarea
          ref={textareaRef}
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="Paste or type raw prompt text here (containing API keys, passwords, emails, or phone numbers)..."
          rows={6}
          style={{
            width: '100%',
            background: 'var(--bg-inset)',
            color: '#E2E8F0',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.85rem 1rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8125rem',
            lineHeight: '1.65',
            resize: 'vertical',
            outline: 'none',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--cyan-primary)';
            e.currentTarget.style.boxShadow = '0 0 0 1px var(--cyan-primary)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-medium)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Telemetry Footer & Scan Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.25rem' }}>
        {/* Telemetry Counter Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span>
            Chars: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{charCount.toLocaleString()}</strong>
          </span>
          <span style={{ color: 'var(--border-strong)' }}>&bull;</span>
          <span>
            Words: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{wordCount}</strong>
          </span>
          <span style={{ color: 'var(--border-strong)' }}>&bull;</span>
          <span>
            Est. Tokens: <strong style={{ color: 'var(--cyan-primary)', fontFamily: 'var(--font-mono)' }}>~{estimatedTokens}</strong>
          </span>
        </div>

        {/* Scan & Sanitize CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
            [Ctrl + Enter]
          </span>

          <button
            onClick={onScan}
            disabled={isScanning || !promptText.trim()}
            className="btn btn-primary"
            style={{
              padding: '0.55rem 1.35rem',
              fontSize: '0.8125rem',
            }}
          >
            {isScanning ? (
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
                <span>Analyzing Telemetry...</span>
              </>
            ) : (
              <>
                <Scan size={14} />
                <span>{hasScanned ? 'Re-Scan & Sanitize' : 'Scan & Sanitize Prompt'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
