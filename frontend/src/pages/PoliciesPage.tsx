import React, { useState, useEffect } from 'react';
import {
  Key,
  Lock,
  Mail,
  Phone,
  RotateCcw,
  Save,
} from 'lucide-react';
import { useShield } from '../context/ShieldContext';
import {
  DEFAULT_POLICY_CONFIG,
  STRICT_POLICY_CONFIG,
  PERMISSIVE_POLICY_CONFIG,
} from '../services/shieldApi';
import type { EntityType, PolicyAction, PolicyConfig } from '../types/shield';

export const PoliciesPage: React.FC = () => {
  const { policyConfig, updatePolicyConfig, resetPolicyConfig } = useShield();

  // Draft state to avoid showing unsaved edits as active
  const [draftConfig, setDraftConfig] = useState<PolicyConfig>(policyConfig);
  const [saveFeedback, setSaveFeedback] = useState(false);

  // Sync draft when active policy changes from outside
  useEffect(() => {
    setDraftConfig(policyConfig);
  }, [policyConfig]);

  // Check if draft has unsaved changes
  const hasUnsavedChanges = JSON.stringify(draftConfig) !== JSON.stringify(policyConfig);

  const handleActionChange = (type: EntityType, action: PolicyAction) => {
    setDraftConfig((prev) => ({
      ...prev,
      name: 'Custom Policy Profile',
      defaultAction: {
        ...prev.defaultAction,
        [type]: action,
      },
    }));
  };

  const handleApplyPreset = (preset: 'balanced' | 'strict' | 'permissive') => {
    let selected: PolicyConfig;
    if (preset === 'strict') selected = STRICT_POLICY_CONFIG;
    else if (preset === 'permissive') selected = PERMISSIVE_POLICY_CONFIG;
    else selected = DEFAULT_POLICY_CONFIG;

    setDraftConfig(selected);
  };

  const handleSave = () => {
    updatePolicyConfig(draftConfig);
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 2500);
  };

  const handleReset = () => {
    resetPolicyConfig();
    setDraftConfig(DEFAULT_POLICY_CONFIG);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1000px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
              Privacy &amp; Sanitization Policies
            </h1>
            {hasUnsavedChanges && (
              <span className="status-badge status-badge-warning" style={{ fontSize: '0.68rem' }}>
                Unsaved Changes
              </span>
            )}
            {saveFeedback && (
              <span className="status-badge status-badge-success" style={{ fontSize: '0.68rem' }}>
                Policies Applied
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Configure default gateway behavior when sensitive data patterns are intercepted in incoming prompts.
          </p>
        </div>

        {/* Save & Reset Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={handleReset}
            className="btn btn-ghost"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.76rem', border: '1px solid var(--border-medium)' }}
            title="Reset to recommended factory defaults"
          >
            <RotateCcw size={13} />
            <span>Reset Defaults</span>
          </button>

          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            className="btn btn-primary"
            style={{
              padding: '0.45rem 1.15rem',
              fontSize: '0.76rem',
              boxShadow: hasUnsavedChanges ? '0 0 16px rgba(0, 240, 255, 0.35)' : 'none',
            }}
          >
            <Save size={13} />
            <span>Save Policy Profile</span>
          </button>
        </div>
      </div>

      {/* Preset Profiles Bar */}
      <div className="panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Recommended Profiles:
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleApplyPreset('balanced')}
            style={{
              padding: '0.45rem 0.95rem',
              fontSize: '0.76rem',
              fontFamily: 'var(--font-sans)',
              fontWeight: draftConfig.name.includes('Balanced') ? 700 : 500,
              borderRadius: 'var(--radius-sm)',
              border: draftConfig.name.includes('Balanced') ? '1px solid var(--cyan-primary)' : '1px solid var(--border-subtle)',
              background: draftConfig.name.includes('Balanced') ? 'rgba(0, 240, 255, 0.08)' : 'var(--bg-inset)',
              color: draftConfig.name.includes('Balanced') ? 'var(--cyan-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Balanced Gateway (Recommended)
          </button>

          <button
            onClick={() => handleApplyPreset('strict')}
            style={{
              padding: '0.45rem 0.95rem',
              fontSize: '0.76rem',
              fontFamily: 'var(--font-sans)',
              fontWeight: draftConfig.name.includes('Strict') ? 700 : 500,
              borderRadius: 'var(--radius-sm)',
              border: draftConfig.name.includes('Strict') ? '1px solid var(--cyan-primary)' : '1px solid var(--border-subtle)',
              background: draftConfig.name.includes('Strict') ? 'rgba(0, 240, 255, 0.08)' : 'var(--bg-inset)',
              color: draftConfig.name.includes('Strict') ? 'var(--cyan-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Strict Zero-Trust (Block Keys &amp; Passwords)
          </button>

          <button
            onClick={() => handleApplyPreset('permissive')}
            style={{
              padding: '0.45rem 0.95rem',
              fontSize: '0.76rem',
              fontFamily: 'var(--font-sans)',
              fontWeight: draftConfig.name.includes('Permissive') ? 700 : 500,
              borderRadius: 'var(--radius-sm)',
              border: draftConfig.name.includes('Permissive') ? '1px solid var(--cyan-primary)' : '1px solid var(--border-subtle)',
              background: draftConfig.name.includes('Permissive') ? 'rgba(0, 240, 255, 0.08)' : 'var(--bg-inset)',
              color: draftConfig.name.includes('Permissive') ? 'var(--cyan-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Permissive Audit (Allow PII)
          </button>
        </div>
      </div>

      {/* Explainer Guide on Policy Actions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
          fontSize: '0.75rem',
        }}
      >
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontWeight: 700, color: '#FBBF24', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>ALLOW</span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', lineHeight: 1.5 }}>
            Leaves detected value unmasked in the prompt. Dispatches in plain text to the LLM (produces Policy Warning).
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--cyan-border)', padding: '1rem', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-cyan)' }}>
          <div style={{ fontWeight: 700, color: 'var(--cyan-primary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>MASK (Default)</span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', lineHeight: 1.5 }}>
            Substitutes sensitive values with deterministic tokens like <code>[API_KEY_1]</code>. Secrets stay local.
          </div>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontWeight: 700, color: '#EF4444', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>BLOCK</span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', lineHeight: 1.5 }}>
            Hard-blocks the prompt from being dispatched until the credential is removed or reclassified.
          </div>
        </div>
      </div>

      {/* Entity Policy Configuration Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {(['API_KEY', 'PASSWORD', 'EMAIL', 'PHONE'] as EntityType[]).map((type) => {
          const currentAction = draftConfig.defaultAction[type];
          return (
            <div
              key={type}
              className="panel"
              style={{
                padding: '1.15rem 1.4rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1.25rem',
              }}
            >
              <div style={{ maxWidth: '480px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.925rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  {type === 'API_KEY' && <Key size={15} style={{ color: '#F59E0B' }} />}
                  {type === 'PASSWORD' && <Lock size={15} style={{ color: '#EF4444' }} />}
                  {type === 'EMAIL' && <Mail size={15} style={{ color: '#00F0FF' }} />}
                  {type === 'PHONE' && <Phone size={15} style={{ color: '#A855F7' }} />}
                  <span>{type}</span>
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {type === 'API_KEY' && 'Cloud access keys (AWS, OpenAI, GitHub, Slack tokens, Bearer tokens, and key assignments).'}
                  {type === 'PASSWORD' && 'Database passwords, administrative secrets, and secret key assignment statements.'}
                  {type === 'EMAIL' && 'Corporate, internal, and personal email addresses meeting RFC 5322 compliance standards.'}
                  {type === 'PHONE' && 'Formatted domestic, international, and E.164 telephone numbers.'}
                </div>
              </div>

              {/* Segmented Action Buttons */}
              <div
                style={{
                  display: 'flex',
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '3px',
                  gap: '3px',
                }}
              >
                {(['ALLOW', 'MASK', 'BLOCK'] as PolicyAction[]).map((action) => {
                  const isSelected = currentAction === action;
                  let activeBg = 'var(--cyan-subtle)';
                  let activeColor = 'var(--cyan-primary)';
                  let activeBorder = 'var(--cyan-border)';

                  if (action === 'ALLOW') {
                    activeBg = 'var(--status-warning-bg)';
                    activeColor = '#FBBF24';
                    activeBorder = 'var(--status-warning-border)';
                  } else if (action === 'BLOCK') {
                    activeBg = 'var(--status-danger-bg)';
                    activeColor = '#F87171';
                    activeBorder = 'var(--status-danger-border)';
                  }

                  return (
                    <button
                      key={action}
                      onClick={() => handleActionChange(type, action)}
                      style={{
                        padding: '0.4rem 0.95rem',
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mono)',
                        border: isSelected ? `1px solid ${activeBorder}` : '1px solid transparent',
                        color: isSelected ? activeColor : 'var(--text-muted)',
                        background: isSelected ? activeBg : 'transparent',
                        fontWeight: isSelected ? 700 : 500,
                        borderRadius: 'var(--radius-xs)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {action}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
