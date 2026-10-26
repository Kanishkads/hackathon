import React, { useState, useEffect } from 'react';
import { X, Sliders, Key, Lock, Mail, Phone } from 'lucide-react';
import type { PolicyConfig, EntityType, PolicyAction } from '../types/shield';

interface PolicySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  policyConfig: PolicyConfig;
  onUpdateConfig: (config: PolicyConfig) => void;
}

export const PolicySettingsModal: React.FC<PolicySettingsModalProps> = ({
  isOpen,
  onClose,
  policyConfig,
  onUpdateConfig,
}) => {
  const [draftActions, setDraftActions] = useState<Record<EntityType, PolicyAction>>(
    policyConfig.defaultAction
  );
  const [draftName, setDraftName] = useState(policyConfig.name);

  // Sync draft state on open
  useEffect(() => {
    if (isOpen) {
      setDraftActions(policyConfig.defaultAction);
      setDraftName(policyConfig.name);
    }
  }, [isOpen, policyConfig]);

  if (!isOpen) return null;

  const handleActionChange = (type: EntityType, action: PolicyAction) => {
    setDraftActions((prev) => ({
      ...prev,
      [type]: action,
    }));
    setDraftName('Custom Configuration');
  };

  const handleSave = () => {
    onUpdateConfig({
      ...policyConfig,
      name: draftName,
      defaultAction: draftActions,
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sliders size={16} style={{ color: 'var(--cyan-primary)' }} />
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
                Privacy Policy Configuration
              </h3>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Define automated masking or blocking rules for detected entity categories
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn btn-ghost"
            style={{ padding: '0.25rem', borderRadius: '4px' }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Policy Explainer */}
          <div
            style={{
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem',
              fontSize: '0.74rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.5rem',
            }}
          >
            <div>
              <strong style={{ color: '#34D399' }}>ALLOW:</strong>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Transmits in plain text</div>
            </div>
            <div>
              <strong style={{ color: 'var(--cyan-primary)' }}>MASK:</strong>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Replaces with token symbol</div>
            </div>
            <div>
              <strong style={{ color: '#F87171' }}>BLOCK:</strong>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Halts prompt dispatch</div>
            </div>
          </div>

          {/* Configuration Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {(['API_KEY', 'PASSWORD', 'EMAIL', 'PHONE'] as EntityType[]).map((type) => {
              const currentAction = draftActions[type];
              return (
                <div
                  key={type}
                  style={{
                    background: 'var(--bg-inset)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 0.95rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {type === 'API_KEY' && <Key size={13} style={{ color: 'var(--entity-api-key)' }} />}
                      {type === 'PASSWORD' && <Lock size={13} style={{ color: 'var(--entity-password)' }} />}
                      {type === 'EMAIL' && <Mail size={13} style={{ color: 'var(--entity-email)' }} />}
                      {type === 'PHONE' && <Phone size={13} style={{ color: 'var(--entity-phone)' }} />}
                      <span>{type}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {type === 'API_KEY' && 'Cloud access keys, OAuth bearer & API tokens'}
                      {type === 'PASSWORD' && 'Database credentials & application secret keys'}
                      {type === 'EMAIL' && 'RFC compliant email addresses'}
                      {type === 'PHONE' && 'E.164 domestic & international phone numbers'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {(['ALLOW', 'MASK', 'BLOCK'] as PolicyAction[]).map((action) => {
                      const isSelected = currentAction === action;
                      return (
                        <button
                          key={action}
                          onClick={() => handleActionChange(type, action)}
                          className={`btn ${isSelected ? 'btn-secondary' : 'btn-ghost'}`}
                          style={{
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.7rem',
                            borderColor: isSelected
                              ? action === 'ALLOW'
                                ? '#10B981'
                                : action === 'MASK'
                                ? 'var(--cyan-primary)'
                                : '#EF4444'
                              : 'transparent',
                            color: isSelected
                              ? action === 'ALLOW'
                                ? '#34D399'
                                : action === 'MASK'
                                ? 'var(--cyan-primary)'
                                : '#F87171'
                              : 'var(--text-muted)',
                            background: isSelected
                              ? action === 'ALLOW'
                                ? 'var(--status-success-bg)'
                                : action === 'MASK'
                                ? 'var(--cyan-subtle)'
                                : 'var(--status-danger-bg)'
                              : 'transparent',
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

        {/* Modal Footer with Clear Save / Cancel actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-inset)',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '0.45rem 0.95rem' }}>
            Cancel
          </button>
          <button onClick={handleSave} className="btn btn-primary" style={{ padding: '0.45rem 1.25rem' }}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
