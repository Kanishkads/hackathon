import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Key,
  Lock,
  Mail,
  Phone,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';
import type { DetectedEntity, EntityType, PolicyAction } from '../types/shield';

interface EntityInspectorProps {
  entities: DetectedEntity[];
  onUpdateEntityPolicy: (entityId: string, policy: PolicyAction) => void;
  onSetAllPolicies: (policy: PolicyAction) => void;
}

export const EntityInspector: React.FC<EntityInspectorProps> = ({
  entities,
  onUpdateEntityPolicy,
  onSetAllPolicies,
}) => {
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getEntityIcon = (type: EntityType) => {
    switch (type) {
      case 'API_KEY':
        return <Key size={12} />;
      case 'PASSWORD':
        return <Lock size={12} />;
      case 'EMAIL':
        return <Mail size={12} />;
      case 'PHONE':
        return <Phone size={12} />;
    }
  };

  const getBadgeClass = (type: EntityType) => {
    switch (type) {
      case 'API_KEY':
        return 'entity-badge-api_key';
      case 'PASSWORD':
        return 'entity-badge-password';
      case 'EMAIL':
        return 'entity-badge-email';
      case 'PHONE':
        return 'entity-badge-phone';
    }
  };

  const maskValueDisplay = (val: string, type: EntityType) => {
    if (type === 'PASSWORD') {
      return '••••••••••••';
    }
    if (val.length <= 8) {
      return val.slice(0, 2) + '••••' + val.slice(-1);
    }
    return val.slice(0, 4) + '••••••••' + val.slice(-4);
  };

  return (
    <div className="panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      {/* Header and Bulk Control Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-sm)',
              background: entities.length > 0 ? 'rgba(245, 158, 11, 0.1)' : 'var(--status-success-bg)',
              border: `1px solid ${entities.length > 0 ? 'rgba(245, 158, 11, 0.3)' : 'var(--status-success-border)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: entities.length > 0 ? '#FBBF24' : '#34D399',
            }}
          >
            {entities.length > 0 ? <ShieldAlert size={15} /> : <ShieldCheck size={15} />}
          </div>
          <div>
            <div style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              Detected Entity Ledger
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Per-entity policy overrides apply immediately to the sanitized payload
            </div>
          </div>
          <span
            className={entities.length > 0 ? 'status-badge status-badge-warning' : 'status-badge status-badge-success'}
            style={{ fontSize: '0.7rem', marginLeft: '0.25rem' }}
          >
            {entities.length} {entities.length === 1 ? 'threat vector' : 'threat vectors'}
          </span>
        </div>

        {/* Quick Bulk Policy Actions */}
        {entities.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.66rem' }}>
              Bulk Action:
            </span>
            <button
              onClick={() => onSetAllPolicies('MASK')}
              className="btn btn-ghost"
              style={{
                padding: '0.2rem 0.55rem',
                fontSize: '0.7rem',
                border: '1px solid var(--border-medium)',
                color: 'var(--cyan-primary)',
              }}
            >
              Mask All
            </button>
            <button
              onClick={() => onSetAllPolicies('BLOCK')}
              className="btn btn-ghost"
              style={{
                padding: '0.2rem 0.55rem',
                fontSize: '0.7rem',
                border: '1px solid var(--border-medium)',
                color: '#F87171',
              }}
            >
              Block All
            </button>
            <button
              onClick={() => onSetAllPolicies('ALLOW')}
              className="btn btn-ghost"
              style={{
                padding: '0.2rem 0.55rem',
                fontSize: '0.7rem',
                border: '1px solid var(--border-medium)',
                color: '#FBBF24',
              }}
            >
              Allow All
            </button>
          </div>
        )}
      </div>

      {/* Entity Findings Cards */}
      {entities.length === 0 ? (
        <div
          style={{
            padding: '1.25rem',
            background: 'var(--bg-inset)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            color: '#34D399',
            fontSize: '0.78rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={15} />
          <span>No sensitive credentials or personal identifiers detected in this prompt.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {entities.map((entity) => {
            const isRevealed = !!revealedIds[entity.id];
            const displayVal = isRevealed ? entity.value : maskValueDisplay(entity.value, entity.entity_type);

            return (
              <div
                key={entity.id}
                style={{
                  background: 'var(--bg-inset)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.65rem 0.95rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.65rem',
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* Left: Entity Metadata */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: '220px', flex: 1 }}>
                  {/* Entity Type Badge */}
                  <span className={`entity-badge ${getBadgeClass(entity.entity_type)}`}>
                    {getEntityIcon(entity.entity_type)}
                    <span>{entity.entity_type}</span>
                  </span>

                  {/* Masked / Revealed Value */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <code
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.78rem',
                        color: isRevealed ? 'var(--text-primary)' : 'var(--text-secondary)',
                        background: 'rgba(255, 255, 255, 0.04)',
                        padding: '0.1rem 0.4rem',
                        borderRadius: 'var(--radius-xs)',
                      }}
                    >
                      {displayVal}
                    </code>

                    {/* Unmask toggle in local client */}
                    <button
                      onClick={() => toggleReveal(entity.id)}
                      className="btn btn-ghost"
                      style={{ padding: '0.15rem 0.35rem', color: 'var(--text-muted)' }}
                      title={isRevealed ? 'Mask value' : 'Inspect raw value locally in memory'}
                    >
                      {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>

                  {/* Rule & Confidence Telemetry */}
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    rule: {entity.rule_name} ({entity.confidence}) &bull; span [{entity.start}:{entity.end}]
                  </span>
                </div>

                {/* Right: Policy Override Segmented Control */}
                <div
                  style={{
                    display: 'flex',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '2px',
                    gap: '2px',
                  }}
                >
                  {(['ALLOW', 'MASK', 'BLOCK'] as PolicyAction[]).map((action) => {
                    const isSelected = entity.policy === action;
                    let activeBg = 'var(--cyan-subtle)';
                    let activeColor = 'var(--cyan-primary)';
                    let activeBorder = 'rgba(0, 240, 255, 0.35)';

                    if (action === 'ALLOW') {
                      activeBg = 'var(--status-warning-bg)';
                      activeColor = '#FBBF24';
                      activeBorder = 'rgba(245, 158, 11, 0.35)';
                    } else if (action === 'BLOCK') {
                      activeBg = 'var(--status-danger-bg)';
                      activeColor = '#F87171';
                      activeBorder = 'rgba(239, 68, 68, 0.35)';
                    }

                    return (
                      <button
                        key={action}
                        onClick={() => onUpdateEntityPolicy(entity.id, action)}
                        style={{
                          border: isSelected ? `1px solid ${activeBorder}` : '1px solid transparent',
                          background: isSelected ? activeBg : 'transparent',
                          color: isSelected ? activeColor : 'var(--text-muted)',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '0.68rem',
                          fontFamily: 'var(--font-mono)',
                          padding: '0.2rem 0.55rem',
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
      )}
    </div>
  );
};
