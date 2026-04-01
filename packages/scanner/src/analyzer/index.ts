/**
 * Analyzer Module Exports
 *
 * Exports all static analysis components including
 * pattern matching, taint tracking, severity classification, and risk scoring
 */

export { PatternMatcher } from './pattern-matcher'
export { TaintTracker } from './data-flow'
export { SeverityClassifier, RiskScorer } from './scorer'

export type { PatternRule } from './pattern-matcher'
