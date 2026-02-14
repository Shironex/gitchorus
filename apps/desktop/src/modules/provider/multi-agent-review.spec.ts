import type { ReviewFinding, SubAgentScore } from '@gitchorus/shared';
import {
  deduplicateFindings,
  calculateWeightedScore,
  applySeverityCaps,
} from './multi-agent-utils';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createFinding(overrides: Partial<ReviewFinding> = {}): ReviewFinding {
  return {
    severity: 'minor',
    category: 'logic',
    file: 'src/app.ts',
    line: 10,
    codeSnippet: 'const x = 1;',
    explanation: 'Test finding',
    suggestedFix: 'const x = 2;',
    title: 'Test finding title',
    ...overrides,
  };
}

function createSubAgentScore(overrides: Partial<SubAgentScore> = {}): SubAgentScore {
  return {
    agent: 'code-quality',
    score: 7,
    weight: 0.25,
    summary: 'Code quality is good',
    findingCount: 2,
    severityCounts: { critical: 0, major: 0, minor: 1, nit: 1 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// deduplicateFindings
// ---------------------------------------------------------------------------

describe('deduplicateFindings', () => {
  it('should return findings as-is when no duplicates', () => {
    const findings = [
      createFinding({ file: 'a.ts', line: 10, category: 'logic' }),
      createFinding({ file: 'b.ts', line: 20, category: 'security' }),
    ];

    const result = deduplicateFindings(findings);
    expect(result).toHaveLength(2);
  });

  it('should deduplicate findings with same file, line group, and category', () => {
    const findings = [
      createFinding({
        file: 'a.ts',
        line: 1,
        category: 'logic',
        severity: 'minor',
        explanation: 'Short',
        agentSource: 'code-quality',
      }),
      createFinding({
        file: 'a.ts',
        line: 3,
        category: 'logic',
        severity: 'minor',
        explanation: 'Longer explanation with more detail',
        agentSource: 'code-patterns',
      }),
    ];

    const result = deduplicateFindings(findings);
    expect(result).toHaveLength(1);
  });

  it('should bump severity when different agents flag the same area', () => {
    const findings = [
      createFinding({
        file: 'a.ts',
        line: 1,
        category: 'logic',
        severity: 'minor',
        agentSource: 'code-quality',
      }),
      createFinding({
        file: 'a.ts',
        line: 2,
        category: 'logic',
        severity: 'minor',
        agentSource: 'code-patterns',
      }),
    ];

    const result = deduplicateFindings(findings);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('major'); // bumped from minor
  });

  it('should keep the finding with higher severity', () => {
    const findings = [
      createFinding({
        file: 'a.ts',
        line: 1,
        category: 'logic',
        severity: 'nit',
        title: 'Nit finding',
        agentSource: 'code-quality',
      }),
      createFinding({
        file: 'a.ts',
        line: 2,
        category: 'logic',
        severity: 'major',
        title: 'Major finding',
        agentSource: 'code-patterns',
      }),
    ];

    const result = deduplicateFindings(findings);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Major finding');
    // Already major, bumped to critical because different agents
    expect(result[0].severity).toBe('critical');
  });

  it('should not bump severity beyond critical', () => {
    const findings = [
      createFinding({
        file: 'a.ts',
        line: 1,
        category: 'security',
        severity: 'critical',
        agentSource: 'code-quality',
      }),
      createFinding({
        file: 'a.ts',
        line: 2,
        category: 'security',
        severity: 'major',
        agentSource: 'security-performance',
      }),
    ];

    const result = deduplicateFindings(findings);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('critical');
  });

  it('should not bump severity when same agent produces both findings', () => {
    const findings = [
      createFinding({
        file: 'a.ts',
        line: 1,
        category: 'logic',
        severity: 'minor',
        agentSource: 'code-quality',
      }),
      createFinding({
        file: 'a.ts',
        line: 2,
        category: 'logic',
        severity: 'minor',
        agentSource: 'code-quality',
      }),
    ];

    const result = deduplicateFindings(findings);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('minor'); // not bumped — same agent
  });

  it('should keep findings with different line groups separate', () => {
    const findings = [
      createFinding({ file: 'a.ts', line: 1, category: 'logic' }),
      createFinding({ file: 'a.ts', line: 10, category: 'logic' }), // line group 6-10
    ];

    const result = deduplicateFindings(findings);
    expect(result).toHaveLength(2);
  });

  it('should keep findings with different categories separate', () => {
    const findings = [
      createFinding({ file: 'a.ts', line: 1, category: 'logic' }),
      createFinding({ file: 'a.ts', line: 1, category: 'security' }),
    ];

    const result = deduplicateFindings(findings);
    expect(result).toHaveLength(2);
  });

  it('should handle empty findings array', () => {
    expect(deduplicateFindings([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// calculateWeightedScore
// ---------------------------------------------------------------------------

describe('calculateWeightedScore', () => {
  it('should calculate weighted score from sub-agent scores', () => {
    const scores: SubAgentScore[] = [
      createSubAgentScore({ agent: 'code-quality', score: 8, weight: 0.25 }),
      createSubAgentScore({ agent: 'code-patterns', score: 6, weight: 0.25 }),
      createSubAgentScore({ agent: 'security-performance', score: 9, weight: 0.5 }),
    ];

    const result = calculateWeightedScore(scores);
    // (8*0.25 + 6*0.25 + 9*0.5) / (0.25 + 0.25 + 0.5) = (2 + 1.5 + 4.5) / 1 = 8
    expect(result).toBe(8);
  });

  it('should ignore zero-weight agents (context)', () => {
    const scores: SubAgentScore[] = [
      createSubAgentScore({ agent: 'context', score: 0, weight: 0 }),
      createSubAgentScore({ agent: 'code-quality', score: 10, weight: 0.25 }),
      createSubAgentScore({ agent: 'code-patterns', score: 10, weight: 0.25 }),
      createSubAgentScore({ agent: 'security-performance', score: 10, weight: 0.5 }),
    ];

    const result = calculateWeightedScore(scores);
    expect(result).toBe(10);
  });

  it('should return 5 when no weights', () => {
    expect(calculateWeightedScore([])).toBe(5);
  });

  it('should round to one decimal place', () => {
    const scores: SubAgentScore[] = [
      createSubAgentScore({ agent: 'code-quality', score: 7, weight: 0.25 }),
      createSubAgentScore({ agent: 'code-patterns', score: 8, weight: 0.25 }),
      createSubAgentScore({ agent: 'security-performance', score: 6, weight: 0.5 }),
    ];

    const result = calculateWeightedScore(scores);
    // (7*0.25 + 8*0.25 + 6*0.5) / 1 = (1.75 + 2 + 3) = 6.75
    expect(result).toBe(6.8); // rounded
  });
});

// ---------------------------------------------------------------------------
// applySeverityCaps
// ---------------------------------------------------------------------------

describe('applySeverityCaps', () => {
  it('should cap score at 5 when critical findings exist', () => {
    const findings = [createFinding({ severity: 'critical' })];
    expect(applySeverityCaps(8, findings)).toBe(5);
  });

  it('should cap score at 7 when major findings exist', () => {
    const findings = [createFinding({ severity: 'major' })];
    expect(applySeverityCaps(9, findings)).toBe(7);
  });

  it('should not cap score when only minor/nit findings', () => {
    const findings = [createFinding({ severity: 'minor' }), createFinding({ severity: 'nit' })];
    expect(applySeverityCaps(9, findings)).toBe(9);
  });

  it('should not cap score when no findings', () => {
    expect(applySeverityCaps(10, [])).toBe(10);
  });

  it('should not increase score that is already below cap', () => {
    const findings = [createFinding({ severity: 'critical' })];
    expect(applySeverityCaps(3, findings)).toBe(3);
  });

  it('should prioritize critical cap over major cap', () => {
    const findings = [
      createFinding({ severity: 'critical' }),
      createFinding({ severity: 'major' }),
    ];
    expect(applySeverityCaps(8, findings)).toBe(5);
  });
});
