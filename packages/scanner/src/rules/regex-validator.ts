/**
 * Regex Complexity Validator
 *
 * Validates regex patterns during rule loading to prevent ReDoS attacks.
 * Rejects patterns with excessive nesting depth, length, or dangerous quantifier patterns.
 */

const MAX_NESTING_DEPTH = 3
const MAX_PATTERN_LENGTH = 500

/**
 * Validate a regex pattern for complexity that could cause ReDoS.
 *
 * @param pattern - The regex pattern string to validate
 * @returns Object with valid boolean and optional reason string
 */
export function validateRegexComplexity(pattern: string): { valid: boolean; reason?: string } {
  // 1. Length check: reject patterns > 500 chars
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return {
      valid: false,
      reason: `Pattern length ${pattern.length} exceeds ${MAX_PATTERN_LENGTH} limit`,
    }
  }

  // 2. Nesting depth check: count ( without closing )
  let maxNesting = 0
  let currentNesting = 0
  for (const char of pattern) {
    if (char === '(') {
      currentNesting++
      maxNesting = Math.max(maxNesting, currentNesting)
    } else if (char === ')') {
      currentNesting = Math.max(0, currentNesting - 1)
    }
  }
  if (maxNesting > MAX_NESTING_DEPTH) {
    return {
      valid: false,
      reason: `Nesting depth ${maxNesting} exceeds limit of ${MAX_NESTING_DEPTH}`,
    }
  }

  // 3. Dangerous quantifier pattern: nested quantifiers like (a+)+
  if (/\([^)]*[+*][^)]*\)[+*]/.test(pattern)) {
    return { valid: false, reason: 'Pattern contains nested quantifiers (ReDoS risk)' }
  }

  return { valid: true }
}
