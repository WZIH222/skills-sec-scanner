/**
 * Unit tests for Severity Classifier and Risk Scorer
 *
 * TDD RED phase: Failing tests for severity classification and risk scoring
 */

import { describe, it, expect } from 'vitest'
import { SeverityClassifier, RiskScorer } from '../../../src/analyzer/scorer'
import { Finding, Severity } from '../../../src/types'

describe('SeverityClassifier', () => {
  describe('classify()', () => {
    it('should group findings by severity level', () => {
      const findings: Finding[] = [
        {
          ruleId: 'rule-1',
          severity: 'critical',
          message: 'Critical issue',
          location: { line: 1, column: 1 },
        },
        {
          ruleId: 'rule-2',
          severity: 'high',
          message: 'High issue',
          location: { line: 2, column: 2 },
        },
        {
          ruleId: 'rule-3',
          severity: 'critical',
          message: 'Another critical',
          location: { line: 3, column: 3 },
        },
      ]

      const classifier = new SeverityClassifier()
      const classified = classifier.classify(findings)

      expect(classified.get('critical')).toHaveLength(2)
      expect(classified.get('high')).toHaveLength(1)
      expect(classified.get('medium')).toBeUndefined()
      expect(classified.get('low')).toBeUndefined()
      expect(classified.get('info')).toBeUndefined()
    })

    it('should handle empty findings array', () => {
      const findings: Finding[] = []
      const classifier = new SeverityClassifier()
      const classified = classifier.classify(findings)

      expect(classified.size).toBe(0)
    })

    it('should include all severity levels when present', () => {
      const findings: Finding[] = [
        { ruleId: 'rule-1', severity: 'critical', message: '', location: { line: 1, column: 1 } },
        { ruleId: 'rule-2', severity: 'high', message: '', location: { line: 1, column: 1 } },
        { ruleId: 'rule-3', severity: 'medium', message: '', location: { line: 1, column: 1 } },
        { ruleId: 'rule-4', severity: 'low', message: '', location: { line: 1, column: 1 } },
        { ruleId: 'rule-5', severity: 'info', message: '', location: { line: 1, column: 1 } },
      ]

      const classifier = new SeverityClassifier()
      const classified = classifier.classify(findings)

      expect(classified.size).toBe(5)
      expect(classified.get('critical')).toHaveLength(1)
      expect(classified.get('high')).toHaveLength(1)
      expect(classified.get('medium')).toHaveLength(1)
      expect(classified.get('low')).toHaveLength(1)
      expect(classified.get('info')).toHaveLength(1)
    })
  })
})

describe('RiskScorer', () => {
  describe('calculateScore()', () => {
    it('should calculate aggregate score using weighted sum (Critical×5 + High×3 + Medium×2 + Low×1)', () => {
      const findings: Finding[] = [
        { ruleId: 'rule-1', severity: 'critical', message: '', location: { line: 1, column: 1 } },
        { ruleId: 'rule-2', severity: 'critical', message: '', location: { line: 2, column: 2 } },
        { ruleId: 'rule-3', severity: 'high', message: '', location: { line: 3, column: 3 } },
        { ruleId: 'rule-4', severity: 'high', message: '', location: { line: 4, column: 4 } },
        { ruleId: 'rule-5', severity: 'medium', message: '', location: { line: 5, column: 5 } },
      ]

      const scorer = new RiskScorer()
      const score = scorer.calculateScore(findings)

      // 2 critical × 5 = 10
      // 2 high × 3 = 6
      // 1 medium × 2 = 2
      // Total = 18
      expect(score).toBe(18)
    })

    it('should cap score at 100', () => {
      const findings: Finding[] = Array(30).fill(null).map((_, i) => ({
        ruleId: `rule-${i}`,
        severity: 'critical' as Severity,
        message: '',
        location: { line: i + 1, column: 1 },
      }))

      const scorer = new RiskScorer()
      const score = scorer.calculateScore(findings)

      // 30 critical × 5 = 150, but should be capped at 100
      expect(score).toBe(100)
    })

    it('should deduplicate findings (same location + same rule = merge)', () => {
      const findings: Finding[] = [
        {
          ruleId: 'rule-1',
          severity: 'critical',
          message: 'First',
          location: { line: 10, column: 5 },
        },
        {
          ruleId: 'rule-1',
          severity: 'critical',
          message: 'Duplicate',
          location: { line: 10, column: 5 },
        },
        {
          ruleId: 'rule-2',
          severity: 'high',
          message: 'Different rule',
          location: { line: 10, column: 5 },
        },
      ]

      const scorer = new RiskScorer()
      const score = scorer.calculateScore(findings)

      // Should deduplicate the two rule-1 findings at same location
      // 1 critical × 5 = 5
      // 1 high × 3 = 3
      // Total = 8 (not 13 which would be with duplicates)
      expect(score).toBe(8)
    })

    it('should return 0 for empty findings array', () => {
      const findings: Finding[] = []
      const scorer = new RiskScorer()
      const score = scorer.calculateScore(findings)

      expect(score).toBe(0)
    })

    it('should not count info severity in score', () => {
      const findings: Finding[] = [
        { ruleId: 'rule-1', severity: 'info', message: '', location: { line: 1, column: 1 } },
        { ruleId: 'rule-2', severity: 'info', message: '', location: { line: 2, column: 2 } },
        { ruleId: 'rule-3', severity: 'info', message: '', location: { line: 3, column: 3 } },
      ]

      const scorer = new RiskScorer()
      const score = scorer.calculateScore(findings)

      // Info has weight 0
      expect(score).toBe(0)
    })

    it('should calculate score for mixed severity findings', () => {
      const findings: Finding[] = [
        { ruleId: 'rule-1', severity: 'critical', message: '', location: { line: 1, column: 1 } },
        { ruleId: 'rule-2', severity: 'high', message: '', location: { line: 2, column: 2 } },
        { ruleId: 'rule-3', severity: 'high', message: '', location: { line: 3, column: 3 } },
        { ruleId: 'rule-4', severity: 'medium', message: '', location: { line: 4, column: 4 } },
        { ruleId: 'rule-5', severity: 'low', message: '', location: { line: 5, column: 5 } },
        { ruleId: 'rule-6', severity: 'low', message: '', location: { line: 6, column: 6 } },
        { ruleId: 'rule-7', severity: 'low', message: '', location: { line: 7, column: 7 } },
        { ruleId: 'rule-8', severity: 'info', message: '', location: { line: 8, column: 8 } },
      ]

      const scorer = new RiskScorer()
      const score = scorer.calculateScore(findings)

      // 1 critical × 5 = 5
      // 2 high × 3 = 6
      // 1 medium × 2 = 2
      // 3 low × 1 = 3
      // 1 info × 0 = 0
      // Total = 16
      expect(score).toBe(16)
    })
  })

  describe('getSeverityLevel()', () => {
    it('should return critical for score 90+', () => {
      const scorer = new RiskScorer()
      expect(scorer.getSeverityLevel(90)).toBe('critical')
      expect(scorer.getSeverityLevel(95)).toBe('critical')
      expect(scorer.getSeverityLevel(100)).toBe('critical')
    })

    it('should return high for score 70-89', () => {
      const scorer = new RiskScorer()
      expect(scorer.getSeverityLevel(70)).toBe('high')
      expect(scorer.getSeverityLevel(80)).toBe('high')
      expect(scorer.getSeverityLevel(89)).toBe('high')
    })

    it('should return medium for score 40-69', () => {
      const scorer = new RiskScorer()
      expect(scorer.getSeverityLevel(40)).toBe('medium')
      expect(scorer.getSeverityLevel(55)).toBe('medium')
      expect(scorer.getSeverityLevel(69)).toBe('medium')
    })

    it('should return low for score 10-39', () => {
      const scorer = new RiskScorer()
      expect(scorer.getSeverityLevel(10)).toBe('low')
      expect(scorer.getSeverityLevel(25)).toBe('low')
      expect(scorer.getSeverityLevel(39)).toBe('low')
    })

    it('should return info for score 0-9', () => {
      const scorer = new RiskScorer()
      expect(scorer.getSeverityLevel(0)).toBe('info')
      expect(scorer.getSeverityLevel(5)).toBe('info')
      expect(scorer.getSeverityLevel(9)).toBe('info')
    })

    it('should handle edge cases correctly', () => {
      const scorer = new RiskScorer()
      expect(scorer.getSeverityLevel(69)).toBe('medium') // Upper bound of medium
      expect(scorer.getSeverityLevel(70)).toBe('high') // Lower bound of high
      expect(scorer.getSeverityLevel(89)).toBe('high') // Upper bound of high
      expect(scorer.getSeverityLevel(90)).toBe('critical') // Lower bound of critical
    })
  })
})
