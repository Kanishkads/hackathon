/**
 * LocalShield AI - Type Definitions
 * Matches backend engine definitions in backend/app/engine/detector.py & masker.py
 */

export type EntityType = 'PERSON' | 'EMAIL' | 'PHONE' | 'API_KEY' | 'PASSWORD';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export type PolicyAction = 'ALLOW' | 'MASK' | 'BLOCK';

export type OverallVerdict = 'PROTECTED' | 'WARNING' | 'BLOCKED';

export interface DetectedEntity {
  id: string;
  entity_type: EntityType;
  value: string;
  start: number;
  end: number;
  confidence: Confidence;
  rule_name: string;
  policy: PolicyAction;
}

export interface MaskResult {
  sanitized_text: string;
  mapping: Record<string, string>; // placeholder -> sensitive value (held in memory only)
  entities: DetectedEntity[];
  stats: Record<string, number>;
}

export interface ScanReport {
  scanId: string;
  sessionId?: string;
  timestamp: string;
  originalText: string;
  sanitizedText: string;
  mapping: Record<string, string>;
  entities: DetectedEntity[];
  stats: Record<string, number>;
  verdict: OverallVerdict;
  blockReasons: string[];
  executionTimeMs: number;
  isMock: boolean;
  warnings?: string[];
  placeholders?: string[];
}

export interface PolicyConfig {
  name: string;
  defaultAction: Record<EntityType, PolicyAction>;
  blockOnPassword: boolean;
  warnOnAllow: boolean;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  promptSnippet: string; // Truncated redacted descriptor, NEVER raw sensitive text
  entityCounts: Record<EntityType, number>;
  totalEntities: number;
  verdict: OverallVerdict;
  policyProfile: string;
  latencyMs: number;
  executionMode: 'Client Simulation' | 'Live Backend';
  sanitizedLength: number;
  maskedCount: number;
  allowedCount: number;
  blockedCount: number;
  placeholderTokens: string[];
}

export interface AIResponse {
  id: string;
  model: string;
  sanitizedPrompt: string;
  rawCompletion: string;
  rehydratedCompletion: string;
  latencyMs: number;
  tokensPrompt: number;
  tokensCompletion: number;
  timestamp: string;
  isMock: boolean;
  leakDetected?: boolean;
  redactedPlaceholders?: string[];
  warnings?: string[];
}

