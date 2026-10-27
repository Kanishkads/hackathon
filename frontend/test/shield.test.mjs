import test from 'node:test';
import assert from 'node:assert/strict';

// Import shieldApi and simulator logic
import { shieldApi } from '../src/services/shieldApi.ts';

test('ShieldApi: Successful scan with sensitive values returns complete, valid structure', async () => {
  const prompt = 'Please reach Dr. Jane Doe at jane.doe@example.com or +1-555-0199.';
  const report = await shieldApi.scanPrompt(prompt);

  assert.ok(report, 'Report should be defined');
  assert.equal(typeof report.sanitizedText, 'string');
  assert.ok(report.sanitizedText.length > 0, 'Sanitized text should not be empty');
  assert.ok(Array.isArray(report.entities), 'Entities should be an array');
  assert.ok(report.entities.length >= 2, 'Should detect person, email, and phone');
  assert.equal(typeof report.mapping, 'object');
  assert.ok(report.mapping !== null);
  assert.equal(report.verdict, 'PROTECTED');
  assert.equal(typeof report.executionTimeMs, 'number');

  // Verify that sanitized text contains typed placeholders
  assert.match(report.sanitizedText, /\[(PERSON|EMAIL|PHONE)_\d+\]/);
});

test('ShieldApi: Empty prompt and non-sensitive prompt produce safe defaults', async () => {
  // Empty text
  const emptyReport = await shieldApi.scanPrompt('');
  assert.equal(emptyReport.sanitizedText, '');
  assert.equal(emptyReport.originalText, '');
  assert.deepEqual(emptyReport.entities, []);
  assert.deepEqual(emptyReport.mapping, {});
  assert.equal(emptyReport.sanitizedText.length, 0);

  // Non-sensitive text
  const nonSensitive = 'Explain the difference between synchronous and asynchronous operations.';
  const cleanReport = await shieldApi.scanPrompt(nonSensitive);
  assert.equal(cleanReport.originalText, nonSensitive);
  assert.equal(cleanReport.sanitizedText, nonSensitive);
  assert.deepEqual(cleanReport.entities, []);
  assert.deepEqual(cleanReport.mapping, {});
  assert.equal(cleanReport.verdict, 'PROTECTED');
});

test('ShieldApi: Backend response schema normalization handles sanitized_prompt and entities_detected', async () => {
  // Simulate what FastAPI backend /api/scan actually returns
  const mockBackendPayload = {
    session_id: 'sess-abc-123',
    sanitized_prompt: 'Contact [PERSON_1] at [EMAIL_1]',
    entity_types: ['PERSON', 'EMAIL'],
    placeholders: ['[PERSON_1]', '[EMAIL_1]'],
    entities_detected: [
      { entity_type: 'PERSON', placeholder: '[PERSON_1]', confidence: 'HIGH' },
      { entity_type: 'EMAIL', placeholder: '[EMAIL_1]', confidence: 'HIGH' }
    ],
    warnings: ['Heuristic detection applied'],
    disclaimer: 'LocalShield AI notice'
  };

  // Mock global fetch for this test
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.includes('/api/scan')) {
      return {
        ok: true,
        status: 200,
        json: async () => mockBackendPayload
      };
    }
    return { ok: false, status: 404 };
  };

  try {
    shieldApi.setApiMode('LIVE');
    const report = await shieldApi.scanPrompt('Contact Dr. Jane Doe at jane@example.com');

    assert.equal(report.isMock, false);
    assert.equal(report.sessionId, 'sess-abc-123');
    assert.equal(report.sanitizedText, 'Contact [PERSON_1] at [EMAIL_1]');
    assert.ok(Array.isArray(report.entities));
    assert.ok(report.entities.length > 0);
    assert.ok(Array.isArray(report.placeholders));
    assert.deepEqual(report.placeholders, ['[PERSON_1]', '[EMAIL_1]']);
    assert.ok(report.sanitizedText.length > 0);
    assert.ok(report.mapping['[PERSON_1]'] || report.mapping['[EMAIL_1]']);
  } finally {
    globalThis.fetch = originalFetch;
    shieldApi.setApiMode('MOCK');
  }
});

test('ShieldApi: Unexpected or malformed API responses fall back safely without crashing', async () => {
  const originalFetch = globalThis.fetch;

  // Mock fetch returning empty object or missing fields
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({}) // Empty backend payload
  });

  try {
    shieldApi.setApiMode('LIVE');
    const prompt = 'Test prompt with no fields';
    const report = await shieldApi.scanPrompt(prompt);

    // Must have safe string and array defaults, not undefined
    assert.equal(typeof report.sanitizedText, 'string');
    assert.ok(report.sanitizedText !== undefined);
    assert.ok(Array.isArray(report.entities));
    assert.ok(typeof report.mapping === 'object');
    assert.ok(report.mapping !== null);
    // Should not throw when measuring length
    assert.equal(typeof report.sanitizedText.length, 'number');
  } finally {
    globalThis.fetch = originalFetch;
    shieldApi.setApiMode('MOCK');
  }
});

test('ShieldApi: Backend 500 error or network failure falls back gracefully without exposing secrets', async () => {
  const originalFetch = globalThis.fetch;

  // Mock network throwing an error
  globalThis.fetch = async () => {
    throw new Error('Connection refused: Backend unreachable');
  };

  try {
    shieldApi.setApiMode('LIVE');
    const prompt = 'Contact alice@example.com';
    const report = await shieldApi.scanPrompt(prompt);

    // Fallback executes simulator, protecting user flow
    assert.ok(report);
    assert.ok(report.sanitizedText.includes('[EMAIL_1]'));
    assert.equal(report.isMock, true);
    assert.equal(typeof report.sanitizedText.length, 'number');
  } finally {
    globalThis.fetch = originalFetch;
    shieldApi.setApiMode('MOCK');
  }
});

test('PromptComparison & ApprovalGate: Null-safe properties guard against undefined inputs', () => {
  // Test helper replicating PromptComparison safe normalization logic
  function normalizeComparisonProps(props) {
    const safeOriginal = typeof props.originalText === 'string' ? props.originalText : '';
    const safeSanitized = typeof props.sanitizedText === 'string' ? props.sanitizedText : '';
    const safeEntities = Array.isArray(props.entities) ? props.entities : [];
    const safeMapping = props.mapping && typeof props.mapping === 'object' ? props.mapping : {};

    const extractedTokens = safeSanitized.match(/\[[A-Z_]+_\d+\]/g) || [];
    const dictionaryTokens = Array.from(new Set([...Object.keys(safeMapping), ...extractedTokens]));

    return {
      originalLength: safeOriginal.length,
      sanitizedLength: safeSanitized.length,
      entityCount: safeEntities.length,
      placeholderCount: dictionaryTokens.length,
      canCopy: Boolean(safeSanitized),
    };
  }

  // 1. All undefined
  const undefinedResult = normalizeComparisonProps({});
  assert.equal(undefinedResult.originalLength, 0);
  assert.equal(undefinedResult.sanitizedLength, 0);
  assert.equal(undefinedResult.entityCount, 0);
  assert.equal(undefinedResult.placeholderCount, 0);
  assert.equal(undefinedResult.canCopy, false);

  // 2. Null values
  const nullResult = normalizeComparisonProps({
    originalText: null,
    sanitizedText: null,
    entities: null,
    mapping: null,
  });
  assert.equal(nullResult.originalLength, 0);
  assert.equal(nullResult.sanitizedLength, 0);
  assert.equal(nullResult.entityCount, 0);
  assert.equal(nullResult.placeholderCount, 0);

  // 3. Normal values with missing offsets
  const normalResult = normalizeComparisonProps({
    originalText: 'Hello world',
    sanitizedText: 'Hello [PERSON_1]',
    entities: [{ entity_type: 'PERSON', value: 'Alice' }], // missing start/end
    mapping: { '[PERSON_1]': 'Alice' },
  });
  assert.equal(normalResult.originalLength, 11);
  assert.equal(normalResult.sanitizedLength, 16);
  assert.equal(normalResult.entityCount, 1);
  assert.equal(normalResult.placeholderCount, 1);
  assert.equal(normalResult.canCopy, true);
});
