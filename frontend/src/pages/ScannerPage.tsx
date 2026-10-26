import React from 'react';
import { AlertTriangle, Sliders } from 'lucide-react';
import { PromptScanner } from '../components/PromptScanner';
import { EntityInspector } from '../components/EntityInspector';
import { PromptComparison } from '../components/PromptComparison';
import { ApprovalGate } from '../components/ApprovalGate';
import { AiResponseViewer } from '../components/AiResponseViewer';
import { useShield } from '../context/ShieldContext';

export const ScannerPage: React.FC = () => {
  const {
    promptText,
    setPromptText,
    scanReport,
    aiResponse,
    isScanning,
    isDispatching,
    dispatchError,
    policyConfig,
    apiMode,
    runScan,
    resetScanner,
    dispatchToAi,
    updateEntityPolicy,
    setAllEntityPolicies,
  } = useShield();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Page Header & Live Status Telemetry Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
              Prompt Privacy Gateway
            </h1>
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
              {apiMode === 'LIVE' ? 'LIVE GATEWAY: CONNECTED' : 'ENGINE: CLIENT SIMULATION'}
            </span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', maxWidth: '780px' }}>
            Inspect incoming prompt payloads in local memory, substitute credentials with reversible tokens, and enforce policy rules before dispatching to LLMs.
          </p>
        </div>

        {/* Telemetry pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.75rem',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
            }}
          >
            <Sliders size={12} style={{ color: 'var(--cyan-primary)' }} />
            <span>Active Policy: <strong style={{ color: 'var(--text-primary)' }}>{policyConfig.name}</strong></span>
          </div>
        </div>
      </div>

      {/* 1. Prompt Input Console */}
      <section id="scanner-input-section">
        <PromptScanner
          promptText={promptText}
          setPromptText={setPromptText}
          onScan={() => runScan()}
          isScanning={isScanning}
          hasScanned={!!scanReport}
        />
      </section>

      {/* 2. Scanned Workflow Sequence */}
      {scanReport && (
        <>
          {/* Threat Findings & Per-Entity Policy Controls */}
          <section id="scanner-entities-section">
            <EntityInspector
              entities={scanReport.entities}
              onUpdateEntityPolicy={updateEntityPolicy}
              onSetAllPolicies={setAllEntityPolicies}
            />
          </section>

          {/* Dual-Console Payload Comparison */}
          <section id="scanner-comparison-section">
            <PromptComparison
              originalText={scanReport.originalText}
              sanitizedText={scanReport.sanitizedText}
              entities={scanReport.entities}
              mapping={scanReport.mapping}
            />
          </section>

          {/* Verification & Dispatch Gateway */}
          <section id="scanner-approval-section">
            <ApprovalGate
              verdict={scanReport.verdict}
              blockReasons={scanReport.blockReasons}
              entities={scanReport.entities}
              sanitizedText={scanReport.sanitizedText}
              isMock={scanReport.isMock}
              onApproveAndDispatch={dispatchToAi}
              onReset={resetScanner}
              isDispatching={isDispatching}
            />

            {dispatchError && (
              <div
                className="panel"
                style={{
                  marginTop: '0.85rem',
                  padding: '0.85rem 1.15rem',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.28)',
                  color: '#F87171',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                }}
              >
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span>{dispatchError}</span>
              </div>
            )}
          </section>
        </>
      )}

      {/* 3. AI Response Stream (Visible after dispatch) */}
      {(aiResponse || isDispatching) && scanReport && (
        <section id="ai-response-section">
          <AiResponseViewer
            response={aiResponse}
            isLoading={isDispatching}
            mapping={scanReport.mapping}
          />
        </section>
      )}
    </div>
  );
};
