import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  shieldApi,
  DEFAULT_BACKEND_URL,
} from '../services/shieldApi';
import type {
  PolicyConfig,
  PolicyAction,
  AuditLogItem,
  ScanReport,
  AIResponse,
} from '../types/shield';
import { SAMPLE_PROMPTS } from '../data/samplePrompts';

interface ShieldContextType {
  // Policies
  policyConfig: PolicyConfig;
  updatePolicyConfig: (config: PolicyConfig) => void;
  resetPolicyConfig: () => void;

  // Engine & Backend
  apiMode: 'MOCK' | 'LIVE';
  toggleApiMode: () => void;
  backendUrl: string;
  setBackendUrl: (url: string) => void;
  backendHealth: { online: boolean; message: string; checking: boolean };
  checkBackendHealth: () => Promise<void>;

  // Audit Logs (Real, persisted in localStorage)
  auditLogs: AuditLogItem[];
  clearAuditLogs: () => void;

  // Active Scanner Workspace
  promptText: string;
  setPromptText: (text: string) => void;
  scanReport: ScanReport | null;
  setScanReport: (report: ScanReport | null) => void;
  aiResponse: AIResponse | null;
  setAiResponse: (resp: AIResponse | null) => void;
  isScanning: boolean;
  isDispatching: boolean;
  dispatchError: string | null;
  setDispatchError: (err: string | null) => void;
  customOverrides: Record<string, PolicyAction>;
  updateEntityPolicy: (entityId: string, action: PolicyAction) => Promise<void>;
  setAllEntityPolicies: (action: PolicyAction) => Promise<void>;
  runScan: (customPrompt?: string) => Promise<void>;
  resetScanner: () => void;
  dispatchToAi: () => Promise<void>;
}

const ShieldContext = createContext<ShieldContextType | undefined>(undefined);

export const ShieldProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Policy State
  const [policyConfig, setPolicyConfigState] = useState<PolicyConfig>(() =>
    shieldApi.getSavedPolicy()
  );

  // Engine Mode
  const [apiMode, setApiMode] = useState<'MOCK' | 'LIVE'>('MOCK');
  const [backendUrl, setBackendUrlState] = useState<string>(() => {
    return localStorage.getItem('localshield_backend_url') || DEFAULT_BACKEND_URL;
  });
  const [backendHealth, setBackendHealth] = useState<{
    online: boolean;
    message: string;
    checking: boolean;
  }>({
    online: false,
    message: 'Client Simulation Engine active',
    checking: false,
  });

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(() =>
    shieldApi.getAuditLogs()
  );

  // Scanner State
  const [promptText, setPromptText] = useState<string>(SAMPLE_PROMPTS[0].text);
  const [scanReport, setScanReport] = useState<ScanReport | null>(null);
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [customOverrides, setCustomOverrides] = useState<Record<string, PolicyAction>>({});

  // Check Backend Health
  const checkBackendHealth = useCallback(async () => {
    setBackendHealth((prev) => ({ ...prev, checking: true }));
    const result = await shieldApi.checkBackendHealth(backendUrl);
    setBackendHealth({
      online: result.online,
      message: result.message,
      checking: false,
    });
  }, [backendUrl]);

  // Set Backend URL
  const setBackendUrl = (url: string) => {
    setBackendUrlState(url);
    localStorage.setItem('localshield_backend_url', url);
  };

  // Toggle API Mode
  const toggleApiMode = () => {
    const nextMode = apiMode === 'MOCK' ? 'LIVE' : 'MOCK';
    setApiMode(nextMode);
    shieldApi.setMode(nextMode, backendUrl);
    if (nextMode === 'LIVE') {
      checkBackendHealth();
    }
  };

  // Save Policy
  const updatePolicyConfig = (config: PolicyConfig) => {
    setPolicyConfigState(config);
    shieldApi.savePolicy(config);
  };

  // Reset Policy
  const resetPolicyConfig = () => {
    const def = shieldApi.resetPolicy();
    setPolicyConfigState(def);
  };

  // Clear Audit Logs
  const clearAuditLogs = () => {
    shieldApi.clearAuditLogs();
    setAuditLogs([]);
  };

  // Run Scan
  const runScan = useCallback(
    async (customPrompt?: string) => {
      const textToScan = customPrompt !== undefined ? customPrompt : promptText;
      if (!textToScan.trim()) return;

      setIsScanning(true);
      setAiResponse(null);
      setDispatchError(null);

      try {
        const report = await shieldApi.scanPrompt(textToScan, policyConfig, customOverrides);

        // Validate report before updating state
        if (!report || typeof report !== 'object') {
          throw new Error('Received an invalid or empty scan report.');
        }

        const safeSanitizedText = typeof report.sanitizedText === 'string' ? report.sanitizedText : '';
        const safeOriginalText = typeof report.originalText === 'string' ? report.originalText : textToScan;
        const safeEntities = Array.isArray(report.entities) ? report.entities : [];
        const safeMapping = report.mapping && typeof report.mapping === 'object' ? report.mapping : {};

        // Normalized report ensuring no undefined properties
        const normalizedReport: ScanReport = {
          ...report,
          originalText: safeOriginalText,
          sanitizedText: safeSanitizedText,
          entities: safeEntities,
          mapping: safeMapping,
          stats: report.stats && typeof report.stats === 'object' ? report.stats : {},
          blockReasons: Array.isArray(report.blockReasons) ? report.blockReasons : [],
          verdict: report.verdict || 'PROTECTED',
          executionTimeMs: typeof report.executionTimeMs === 'number' ? report.executionTimeMs : 0,
        };

        setScanReport(normalizedReport);

        // Record a genuine audit log entry
        const snippet =
          safeOriginalText.trim().split('\n')[0].slice(0, 48) +
          (safeOriginalText.length > 48 ? '...' : '');

        const maskedCount = safeEntities.filter((e) => e?.policy === 'MASK').length;
        const allowedCount = safeEntities.filter((e) => e?.policy === 'ALLOW').length;
        const blockedCount = safeEntities.filter((e) => e?.policy === 'BLOCK').length;

        const entry: AuditLogItem = {
          id: `evt-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
          timestamp: new Date().toLocaleTimeString(),
          promptSnippet: snippet,
          entityCounts: {
            API_KEY: safeEntities.filter((e) => e?.entity_type === 'API_KEY').length,
            PASSWORD: safeEntities.filter((e) => e?.entity_type === 'PASSWORD').length,
            EMAIL: safeEntities.filter((e) => e?.entity_type === 'EMAIL').length,
            PHONE: safeEntities.filter((e) => e?.entity_type === 'PHONE').length,
            PERSON: safeEntities.filter((e) => e?.entity_type === 'PERSON').length,
          },
          totalEntities: safeEntities.length,
          verdict: normalizedReport.verdict,
          policyProfile: policyConfig.name,
          latencyMs: normalizedReport.executionTimeMs,
          executionMode: normalizedReport.isMock ? 'Client Simulation' : 'Live Backend',
          sanitizedLength: safeSanitizedText.length,
          maskedCount,
          allowedCount,
          blockedCount,
          placeholderTokens: Object.keys(safeMapping),
        };

        shieldApi.saveAuditLog(entry);
        setAuditLogs(shieldApi.getAuditLogs());
      } catch (err: any) {
        // Safe logging without leaking sensitive values
        console.error('Scan failed:', err?.message || 'Unknown scan error');
        setDispatchError(err?.message ? `Scan error: ${err.message}` : 'Scan operation failed.');
      } finally {
        setIsScanning(false);
      }
    },
    [promptText, policyConfig, customOverrides]
  );

  // Update single entity policy
  const updateEntityPolicy = async (entityId: string, action: PolicyAction) => {
    const updated = { ...customOverrides, [entityId]: action };
    setCustomOverrides(updated);

    if (promptText) {
      try {
        const report = await shieldApi.scanPrompt(promptText, policyConfig, updated);
        if (report && typeof report === 'object' && typeof report.sanitizedText === 'string') {
          setScanReport(report);
        }
      } catch (err: any) {
        console.error('Policy update scan failed:', err?.message || 'Unknown error');
      }
    }
  };

  // Set all entity policies
  const setAllEntityPolicies = async (action: PolicyAction) => {
    if (!scanReport) return;
    const newOverrides: Record<string, PolicyAction> = {};
    (scanReport.entities || []).forEach((e) => {
      newOverrides[e.id] = action;
    });
    setCustomOverrides(newOverrides);

    try {
      const report = await shieldApi.scanPrompt(promptText, policyConfig, newOverrides);
      if (report && typeof report === 'object' && typeof report.sanitizedText === 'string') {
        setScanReport(report);
      }
    } catch (err: any) {
      console.error('Bulk policy update scan failed:', err?.message || 'Unknown error');
    }
  };

  // Reset Scanner
  const resetScanner = () => {
    setPromptText('');
    setScanReport(null);
    setAiResponse(null);
    setDispatchError(null);
    setCustomOverrides({});
  };

  // Dispatch Sanitized Prompt to AI
  const dispatchToAi = async () => {
    if (!scanReport || scanReport.verdict === 'BLOCKED') return;

    setIsDispatching(true);
    setDispatchError(null);
    try {
      const resp = await shieldApi.dispatchToAi(
        scanReport.sanitizedText ?? '',
        scanReport.mapping ?? {},
        scanReport.sessionId
      );
      setAiResponse(resp);
    } catch (err: any) {
      console.error('Dispatch failed:', err?.message || 'Unknown error');
      setDispatchError(err?.message || 'Dispatch failed.');
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <ShieldContext.Provider
      value={{
        policyConfig,
        updatePolicyConfig,
        resetPolicyConfig,
        apiMode,
        toggleApiMode,
        backendUrl,
        setBackendUrl,
        backendHealth,
        checkBackendHealth,
        auditLogs,
        clearAuditLogs,
        promptText,
        setPromptText,
        scanReport,
        setScanReport,
        aiResponse,
        setAiResponse,
        isScanning,
        isDispatching,
        dispatchError,
        setDispatchError,
        customOverrides,
        updateEntityPolicy,
        setAllEntityPolicies,
        runScan,
        resetScanner,
        dispatchToAi,
      }}
    >
      {children}
    </ShieldContext.Provider>
  );
};

export const useShield = (): ShieldContextType => {
  const context = useContext(ShieldContext);
  if (!context) {
    throw new Error('useShield must be used within a ShieldProvider');
  }
  return context;
};
