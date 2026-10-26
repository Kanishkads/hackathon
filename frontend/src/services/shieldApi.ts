/**
 * LocalShield AI - Service Layer
 * Interfaces with the backend API while providing an exact local simulation engine
 * based on backend/app/engine/detector.py and masker.py.
 *
 * NOTE: Never calls external AI providers directly.
 * NOTE: Never persists raw prompt secrets in localStorage.
 * NOTE: Returns genuine logs, no fabricated past records.
 */

import type {
  DetectedEntity,
  EntityType,
  Confidence,
  PolicyAction,
  OverallVerdict,
  ScanReport,
  AIResponse,
  AuditLogItem,
  PolicyConfig,
} from '../types/shield';

// Configuration
export const DEFAULT_BACKEND_URL = 'http://localhost:8000';
const AUDIT_STORAGE_KEY = 'localshield_audit_logs_v2';
const POLICY_STORAGE_KEY = 'localshield_policy_config_v2';

// Default Policy Configuration
export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  name: 'Balanced Gateway (Default)',
  defaultAction: {
    API_KEY: 'MASK',
    PASSWORD: 'BLOCK',
    EMAIL: 'MASK',
    PHONE: 'MASK',
  },
  blockOnPassword: true,
  warnOnAllow: true,
};

export const STRICT_POLICY_CONFIG: PolicyConfig = {
  name: 'Strict Zero-Trust',
  defaultAction: {
    API_KEY: 'BLOCK',
    PASSWORD: 'BLOCK',
    EMAIL: 'MASK',
    PHONE: 'MASK',
  },
  blockOnPassword: true,
  warnOnAllow: true,
};

export const PERMISSIVE_POLICY_CONFIG: PolicyConfig = {
  name: 'Permissive Audit',
  defaultAction: {
    API_KEY: 'MASK',
    PASSWORD: 'MASK',
    EMAIL: 'ALLOW',
    PHONE: 'ALLOW',
  },
  blockOnPassword: false,
  warnOnAllow: false,
};

// Patterns matching backend/app/engine/detector.py with synthetic test key & assignment tolerance
const EMAIL_REGEX = /\b[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}\b/g;
const PHONE_REGEX = /(?:(?<=\s)|(?<=^)|(?<=[(]))(?:\+\d{1,3}[-.\s]*)?(?:\(\d{2,4}\)|\d{2,4})[-.\s]*\d{2,4}[-.\s]*\d{2,9}(?=(?:[\s,.;:!?)]|$))/g;
const OPENAI_KEY_REGEX = /\b(?:sk-[A-Za-z0-9]{20,}|sk-(?:proj|test)-[A-Za-z0-9_-]{14,})\b/g;
const AWS_ACCESS_KEY_REGEX = /\bAKIA[0-9A-Z]{16}\b/g;
const GITHUB_TOKEN_REGEX = /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/g;
const SLACK_TOKEN_REGEX = /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g;
const BEARER_TOKEN_REGEX = /\bBearer\s+([A-Za-z0-9_\-.]{20,})\b/gi;
const GENERIC_API_KEY_REGEX = /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|secret[_-]?key|client[_-]?secret)\s*(?:[:=]|\bis\b\s*:?)\s*(["']?)([A-Za-z0-9_\-.~+/=]{14,})\1/gi;
const PASSWORD_ASSIGNMENT_REGEX = /\b(password|passwd|pwd|db_pass|database_password|secret_key|app_secret)\s*[:=]\s*(["']?)([^\s"';\n]{6,})\2/gi;

const IGNORED_VALUES = new Set([
  'placeholder',
  'your_password',
  'your_password_here',
  'password',
  'secret',
  'null',
  'none',
  'true',
  'false',
  'undefined',
  'changeme',
  'example',
]);

/**
 * Client-Side Engine simulating backend/app/engine/detector.py and masker.py
 */
class LocalEngineSimulator {
  detect(text: string, policyMap: Record<EntityType, PolicyAction>): DetectedEntity[] {
    if (!text || typeof text !== 'string') return [];

    const candidates: DetectedEntity[] = [];

    // 1. Emails
    let match: RegExpExecArray | null;
    const emailRegex = new RegExp(EMAIL_REGEX);
    while ((match = emailRegex.exec(text)) !== null) {
      const val = match[0];
      const domain = val.split('@')[1];
      if (domain && !domain.includes('..')) {
        const tld = domain.split('.').pop() || '';
        candidates.push({
          id: `email-${match.index}`,
          entity_type: 'EMAIL',
          value: val,
          start: match.index,
          end: match.index + val.length,
          confidence: tld.length >= 2 ? 'HIGH' : 'MEDIUM',
          rule_name: 'email_pattern',
          policy: policyMap['EMAIL'],
        });
      }
    }

    // 2. Phones
    const phoneRegex = new RegExp(PHONE_REGEX);
    while ((match = phoneRegex.exec(text)) !== null) {
      const raw = match[0].trim().replace(/[.,;:!?]+$/, '');
      if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$|^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/.test(raw)) continue;
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(raw)) continue;
      if (/^\d+\.\d+\.\d+$/.test(raw)) continue;

      const digits = raw.replace(/\D/g, '');
      if (digits.length >= 7 && digits.length <= 15) {
        const hasCountryCode = raw.startsWith('+');
        const hasParens = raw.includes('(') && raw.includes(')');
        const hasSep = /[-.\s]/.test(raw);
        let conf: Confidence = 'LOW';
        if (hasCountryCode || hasParens || (hasSep && digits.length >= 10)) {
          conf = 'HIGH';
        } else if (digits.length >= 7 && hasSep) {
          conf = 'MEDIUM';
        }

        candidates.push({
          id: `phone-${match.index}`,
          entity_type: 'PHONE',
          value: raw,
          start: match.index,
          end: match.index + raw.length,
          confidence: conf,
          rule_name: 'phone_pattern',
          policy: policyMap['PHONE'],
        });
      }
    }

    // 3. Vendor API Keys
    const vendorRules: [RegExp, string][] = [
      [OPENAI_KEY_REGEX, 'openai_api_key'],
      [AWS_ACCESS_KEY_REGEX, 'aws_access_key'],
      [GITHUB_TOKEN_REGEX, 'github_token'],
      [SLACK_TOKEN_REGEX, 'slack_token'],
    ];

    for (const [regex, ruleName] of vendorRules) {
      const r = new RegExp(regex);
      while ((match = r.exec(text)) !== null) {
        candidates.push({
          id: `apikey-${match.index}`,
          entity_type: 'API_KEY',
          value: match[0],
          start: match.index,
          end: match.index + match[0].length,
          confidence: 'HIGH',
          rule_name: ruleName,
          policy: policyMap['API_KEY'],
        });
      }
    }

    // Bearer Token
    const bearerRegex = new RegExp(BEARER_TOKEN_REGEX);
    while ((match = bearerRegex.exec(text)) !== null) {
      const tokenVal = match[1];
      const tokenStart = match.index + match[0].indexOf(tokenVal);
      candidates.push({
        id: `bearer-${tokenStart}`,
        entity_type: 'API_KEY',
        value: tokenVal,
        start: tokenStart,
        end: tokenStart + tokenVal.length,
        confidence: 'HIGH',
        rule_name: 'bearer_token',
        policy: policyMap['API_KEY'],
      });
    }

    // Generic API Keys
    const genericKeyRegex = new RegExp(GENERIC_API_KEY_REGEX);
    while ((match = genericKeyRegex.exec(text)) !== null) {
      const tokenVal = match[2];
      if (tokenVal && !IGNORED_VALUES.has(tokenVal.toLowerCase())) {
        const tokenStart = match.index + match[0].indexOf(tokenVal);
        candidates.push({
          id: `genkey-${tokenStart}`,
          entity_type: 'API_KEY',
          value: tokenVal,
          start: tokenStart,
          end: tokenStart + tokenVal.length,
          confidence: tokenVal.length >= 24 ? 'HIGH' : 'MEDIUM',
          rule_name: 'generic_api_key_assignment',
          policy: policyMap['API_KEY'],
        });
      }
    }

    // 4. Passwords
    const passRegex = new RegExp(PASSWORD_ASSIGNMENT_REGEX);
    while ((match = passRegex.exec(text)) !== null) {
      const key = match[1].toLowerCase();
      const val = match[3];
      if (val && !IGNORED_VALUES.has(val.toLowerCase()) && !val.startsWith('[')) {
        const valStart = match.index + match[0].lastIndexOf(val);
        const isHigh = ['password', 'passwd', 'database_password', 'db_pass'].includes(key);
        candidates.push({
          id: `pass-${valStart}`,
          entity_type: 'PASSWORD',
          value: val,
          start: valStart,
          end: valStart + val.length,
          confidence: isHigh ? 'HIGH' : 'MEDIUM',
          rule_name: 'password_assignment',
          policy: policyMap['PASSWORD'],
        });
      }
    }

    return this.resolveOverlaps(candidates);
  }

  private resolveOverlaps(candidates: DetectedEntity[]): DetectedEntity[] {
    const confWeights = { HIGH: 3, MEDIUM: 2, LOW: 1 };

    const sorted = [...candidates].sort((a, b) => {
      const wDiff = confWeights[b.confidence] - confWeights[a.confidence];
      if (wDiff !== 0) return wDiff;
      const specA = a.rule_name.includes('generic') ? 1 : 2;
      const specB = b.rule_name.includes('generic') ? 1 : 2;
      if (specB !== specA) return specB - specA;
      const lenDiff = (b.end - b.start) - (a.end - a.start);
      if (lenDiff !== 0) return lenDiff;
      return a.start - b.start;
    });

    const accepted: DetectedEntity[] = [];
    for (const c of sorted) {
      const collision = accepted.some(
        (a) => Math.max(c.start, a.start) < Math.min(c.end, a.end)
      );
      if (!collision) {
        accepted.push(c);
      }
    }

    return accepted.sort((a, b) => a.start - b.start);
  }

  mask(text: string, entities: DetectedEntity[]): {
    sanitizedText: string;
    mapping: Record<string, string>;
    stats: Record<string, number>;
  } {
    if (!text || entities.length === 0) {
      return { sanitizedText: text, mapping: {}, stats: {} };
    }

    const valueToPlaceholder = new Map<string, string>();
    const placeholderToValue: Record<string, string> = {};
    const typeCounters: Record<string, number> = {};
    const stats: Record<string, number> = {};

    for (const entity of entities) {
      stats[entity.entity_type] = (stats[entity.entity_type] || 0) + 1;

      if (entity.policy === 'MASK') {
        const key = `${entity.entity_type}::${entity.value}`;
        if (!valueToPlaceholder.has(key)) {
          const count = (typeCounters[entity.entity_type] || 0) + 1;
          typeCounters[entity.entity_type] = count;
          const placeholder = `[${entity.entity_type}_${count}]`;
          valueToPlaceholder.set(key, placeholder);
          placeholderToValue[placeholder] = entity.value;
        }
      }
    }

    const chunks: string[] = [];
    let lastIndex = 0;

    for (const entity of entities) {
      if (entity.start < lastIndex) continue;

      chunks.push(text.slice(lastIndex, entity.start));

      if (entity.policy === 'MASK') {
        const placeholder = valueToPlaceholder.get(`${entity.entity_type}::${entity.value}`);
        chunks.push(placeholder || `[${entity.entity_type}_REDACTED]`);
      } else {
        chunks.push(entity.value);
      }

      lastIndex = entity.end;
    }

    chunks.push(text.slice(lastIndex));

    return {
      sanitizedText: chunks.join(''),
      mapping: placeholderToValue,
      stats,
    };
  }
}

const simulator = new LocalEngineSimulator();

class ShieldApiService {
  private apiMode: 'MOCK' | 'LIVE' = 'MOCK';
  private backendUrl = DEFAULT_BACKEND_URL;

  public setMode(mode: 'MOCK' | 'LIVE', url?: string) {
    this.apiMode = mode;
    if (url) this.backendUrl = url;
  }

  public getMode(): { mode: 'MOCK' | 'LIVE'; backendUrl: string } {
    return { mode: this.apiMode, backendUrl: this.backendUrl };
  }

  /**
   * Health check to verified backend URL
   */
  async checkBackendHealth(url = this.backendUrl): Promise<{ online: boolean; message: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${url}/api/health`, {
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeoutId);

      if (res && res.ok) {
        return { online: true, message: `Connected to ${url}` };
      }
      return { online: false, message: `Backend unreachable at ${url} (Connection refused or port closed)` };
    } catch {
      return { online: false, message: `Cannot connect to ${url}` };
    }
  }

  /**
   * Scans a prompt for sensitive entities and applies privacy masking
   */
  async scanPrompt(
    text: string,
    policyConfig: PolicyConfig = DEFAULT_POLICY_CONFIG,
    customOverrides?: Record<string, PolicyAction>
  ): Promise<ScanReport> {
    const startTime = performance.now();
    const scanId = `scan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // If LIVE mode selected, attempt real backend connection
    if (this.apiMode === 'LIVE') {
      try {
        const res = await fetch(`${this.backendUrl}/api/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: text }),
        });
        if (res.ok) {
          const data = await res.json();
          return {
            scanId,
            timestamp: new Date().toLocaleTimeString(),
            originalText: text,
            sanitizedText: data.sanitized_text,
            mapping: data.mapping || {},
            entities: (data.entities || []).map((e: any, idx: number) => ({
              id: `entity-${idx}`,
              entity_type: e.entity_type,
              value: e.value,
              start: e.start,
              end: e.end,
              confidence: e.confidence,
              rule_name: e.rule_name,
              policy: policyConfig.defaultAction[e.entity_type as EntityType] || 'MASK',
            })),
            stats: data.stats || {},
            verdict: 'PROTECTED',
            blockReasons: [],
            executionTimeMs: Math.round(performance.now() - startTime),
            isMock: false,
          };
        }
      } catch (err) {
        console.warn('Backend unavailable, falling back to LocalShield Engine simulator:', err);
      }
    }

    // Client-side LocalShield Engine simulation
    const effectivePolicyMap: Record<EntityType, PolicyAction> = {
      ...policyConfig.defaultAction,
    };

    const detected = simulator.detect(text, effectivePolicyMap);

    const entities = detected.map((e) => {
      const override = customOverrides ? customOverrides[e.id] : undefined;
      return {
        ...e,
        policy: override || e.policy,
      };
    });

    const { sanitizedText, mapping, stats } = simulator.mask(text, entities);

    // Determine overall verdict
    const blockReasons: string[] = [];
    const hasBlockedEntity = entities.some((e) => e.policy === 'BLOCK');
    const hasAllowedEntity = entities.some((e) => e.policy === 'ALLOW');

    if (hasBlockedEntity) {
      entities.filter((e) => e.policy === 'BLOCK').forEach((e) => {
        blockReasons.push(`Blocked by policy: [${e.entity_type}] detected via ${e.rule_name}`);
      });
    }

    let verdict: OverallVerdict = 'PROTECTED';
    if (blockReasons.length > 0) {
      verdict = 'BLOCKED';
    } else if (hasAllowedEntity) {
      verdict = 'WARNING';
    }

    const report: ScanReport = {
      scanId,
      timestamp: new Date().toLocaleTimeString(),
      originalText: text,
      sanitizedText,
      mapping,
      entities,
      stats,
      verdict,
      blockReasons,
      executionTimeMs: Math.round(performance.now() - startTime),
      isMock: true,
    };

    return report;
  }

  /**
   * Simulated AI completion gateway.
   * NOTE: Never calls direct external AI APIs from the browser.
   */
  async dispatchToAi(
    sanitizedPrompt: string,
    mapping: Record<string, string>,
    modelName = 'LocalShield-Proxy-Llama-3'
  ): Promise<AIResponse> {
    const startTime = performance.now();

    // LIVE MODE: Send strictly to the configured backend gateway endpoint
    if (this.apiMode === 'LIVE') {
      try {
        const response = await fetch(`${this.backendUrl}/api/dispatch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sanitized_prompt: sanitizedPrompt }),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return {
          id: data.id || `live-resp-${Date.now()}`,
          model: data.model || 'Backend-Gateway-Model',
          sanitizedPrompt,
          rawCompletion: data.completion || '',
          rehydratedCompletion: data.rehydrated || data.completion || '',
          latencyMs: Math.round(performance.now() - startTime),
          tokensPrompt: Math.round(sanitizedPrompt.length / 4),
          tokensCompletion: Math.round((data.completion || '').length / 4),
          timestamp: new Date().toLocaleTimeString(),
          isMock: false,
        };
      } catch (err: any) {
        throw new Error(
          `Live Gateway Dispatch Failed: ${err.message || 'Cannot reach ' + this.backendUrl + '/api/dispatch'}. In Live Mode, fallback to client simulation is disabled to prevent unauthorized dispatch.`
        );
      }
    }

    // SIMULATION MODE: Zero external network calls.
    await new Promise((resolve) => setTimeout(resolve, 650));

    let rawCompletion = '';

    if (sanitizedPrompt.includes('[AWS_ACCESS_KEY_1]') || sanitizedPrompt.includes('[PASSWORD_1]')) {
      rawCompletion = `### Gateway Security Analysis
Based on the sanitized prompt received by the proxy:

1. **Authentication Diagnostics**: Network timeouts to database clusters are generally attributable to security group rules or subnet routing rather than credential validity.
2. **Key Minimization**: The access identifier represented by \`[AWS_ACCESS_KEY_1]\` should enforce least-privilege IAM scopes.
3. **Password Vaulting**: The database credential \`[PASSWORD_1]\` should be migrated to a dedicated secret store (e.g., AWS Secrets Manager or HashiCorp Vault).
4. **Notification Channel**: Escalations directed to \`[EMAIL_1]\` for auditing.

*Notice: All secrets remained tokenized in transmission.*`;
    } else if (sanitizedPrompt.includes('[PHONE_1]') || sanitizedPrompt.includes('[EMAIL_1]')) {
      rawCompletion = `### Customer Support Escalation Resolution (#4891)

Dear Support Team,

Draft customer communication for account holder (\`[EMAIL_1]\`):

"Dear Jonathan,

Thank you for contacting customer support. We have investigated the billing dispute on your account and issued an adjustment.

An updated statement has been sent to \`[EMAIL_1]\`. If you require further verbal verification, our team can reach you at your telephone on file \`[PHONE_1]\`."

*Notice: Phone and email identifiers were neutralized as structured tokens in transit.*`;
    } else if (sanitizedPrompt.includes('[API_KEY_1]')) {
      rawCompletion = `### Integration Script Guide

To authenticate with GitHub's API and notify Slack without hardcoding secrets:

\`\`\`python
import os
import requests

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN") # Replaced from [API_KEY_2]
SLACK_TOKEN = os.getenv("SLACK_TOKEN")   # Replaced from [API_KEY_3]

def fetch_issues():
    headers = {"Authorization": f"bearer {GITHUB_TOKEN}"}
    return requests.post("https://api.github.com/graphql", json={"query": "{ viewer { login } }"}, headers=headers).json()
\`\`\`

*Notice: Proprietary keys remained represented by tokens ([API_KEY_1], [API_KEY_2]).*`;
    } else {
      rawCompletion = `### Technical Architecture Overview: Kafka vs RabbitMQ

1. **Streaming vs Queueing**:
   - **Apache Kafka**: Partitioned distributed log optimized for high-throughput stream replay and horizontal scaling.
   - **RabbitMQ**: AMQP-based message broker with flexible routing exchanges and delivery confirmations.

*Notice: Prompt scanned clean of sensitive credentials.*`;
    }

    let rehydratedCompletion = rawCompletion;
    for (const [placeholder, rawVal] of Object.entries(mapping)) {
      rehydratedCompletion = rehydratedCompletion.split(placeholder).join(rawVal);
    }

    const latencyMs = Math.round(performance.now() - startTime);

    return {
      id: `resp-${Date.now()}`,
      model: modelName,
      sanitizedPrompt,
      rawCompletion,
      rehydratedCompletion,
      latencyMs,
      tokensPrompt: Math.round(sanitizedPrompt.length / 4),
      tokensCompletion: Math.round(rawCompletion.length / 4),
      timestamp: new Date().toLocaleTimeString(),
      isMock: this.apiMode === 'MOCK',
    };
  }

  // Normalize audit records to guarantee safe numeric fields and prevent NaN
  normalizeAuditLogItem(raw: any): AuditLogItem {
    const entityCounts = {
      API_KEY: Number(raw?.entityCounts?.API_KEY) || 0,
      PASSWORD: Number(raw?.entityCounts?.PASSWORD) || 0,
      EMAIL: Number(raw?.entityCounts?.EMAIL) || 0,
      PHONE: Number(raw?.entityCounts?.PHONE) || 0,
    };

    const countSum =
      entityCounts.API_KEY +
      entityCounts.PASSWORD +
      entityCounts.EMAIL +
      entityCounts.PHONE;

    const totalEntities =
      typeof raw?.totalEntities === 'number' && !Number.isNaN(raw.totalEntities)
        ? raw.totalEntities
        : countSum;

    const placeholderTokens = Array.isArray(raw?.placeholderTokens)
      ? raw.placeholderTokens
      : [];

    const maskedCount =
      typeof raw?.maskedCount === 'number' && !Number.isNaN(raw.maskedCount)
        ? raw.maskedCount
        : placeholderTokens.length > 0
        ? placeholderTokens.length
        : raw?.verdict === 'PROTECTED'
        ? totalEntities
        : 0;

    const blockedCount =
      typeof raw?.blockedCount === 'number' && !Number.isNaN(raw.blockedCount)
        ? raw.blockedCount
        : raw?.verdict === 'BLOCKED'
        ? (totalEntities > 0 ? totalEntities : 1)
        : 0;

    const allowedCount =
      typeof raw?.allowedCount === 'number' && !Number.isNaN(raw.allowedCount)
        ? raw.allowedCount
        : Math.max(0, totalEntities - maskedCount - blockedCount);

    return {
      id: String(raw?.id || `evt-${Date.now().toString(36)}`),
      timestamp: String(raw?.timestamp || new Date().toLocaleTimeString()),
      promptSnippet: String(raw?.promptSnippet || 'Prompt scan payload'),
      entityCounts,
      totalEntities,
      verdict: raw?.verdict === 'BLOCKED' ? 'BLOCKED' : raw?.verdict === 'WARNING' ? 'WARNING' : 'PROTECTED',
      policyProfile: String(raw?.policyProfile || 'Balanced Gateway (Default)'),
      latencyMs: Number(raw?.latencyMs) || 0,
      executionMode: raw?.executionMode === 'Live Backend' ? 'Live Backend' : 'Client Simulation',
      sanitizedLength: Number(raw?.sanitizedLength) || 0,
      maskedCount,
      allowedCount,
      blockedCount,
      placeholderTokens,
    };
  }

  // Safe Audit Logging - Returns ONLY genuine recorded logs from localStorage
  getAuditLogs(): AuditLogItem[] {
    try {
      const data = localStorage.getItem(AUDIT_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => this.normalizeAuditLogItem(item));
        }
      }
    } catch {
      // ignore
    }
    return []; // Genuine empty array when no scans have been performed!
  }

  saveAuditLog(entry: AuditLogItem): void {
    try {
      const normalized = this.normalizeAuditLogItem(entry);
      const existing = this.getAuditLogs();
      const updated = [normalized, ...existing.filter((e) => e.id !== normalized.id)].slice(0, 100);
      localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('Could not save audit log:', err);
    }
  }

  clearAuditLogs(): void {
    try {
      localStorage.removeItem(AUDIT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  // Saved Policy Configuration
  getSavedPolicy(): PolicyConfig {
    try {
      const saved = localStorage.getItem(POLICY_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_POLICY_CONFIG;
  }

  savePolicy(config: PolicyConfig): void {
    try {
      localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(config));
    } catch (err) {
      console.warn('Could not save policy:', err);
    }
  }

  resetPolicy(): PolicyConfig {
    try {
      localStorage.removeItem(POLICY_STORAGE_KEY);
    } catch {
      // ignore
    }
    return DEFAULT_POLICY_CONFIG;
  }
}

export const shieldApi = new ShieldApiService();
