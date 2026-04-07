/**
 * User Code Sanitization for AI Prompt Safety
 *
 * Sanitizes user-provided code before inclusion in AI analysis prompts.
 * Uses delimiter-based quarantine with injection pattern neutralization.
 *
 * Security measures:
 * 1. Neutralize known injection phrases (DAN, role-reversal, instruction override)
 * 2. Escape delimiter markers that appear in user code (null-byte placeholders)
 * 3. Wrap in quarantine delimiters to signal context boundary to AI
 */

const DELIMITER_START = '### USER_CODE ###'
const DELIMITER_END = '### END_USER_CODE ###'

// Injection patterns to neutralize (from PromptInjectionDetector patterns)
const INJECTION_PATTERNS = [
  /do anything now|ignore\s+all\s+instructions/gi,
  /act\s+as|pretend\s+you\s+are|you\s+are\s+now/gi,
  /ignore\s+previous|disregard\s+earlier|forget\s+everything/gi,
  /show\s+your\s+instructions|print\s+your\s+prompt|what\s+are\s+you\s+programmed/gi,
  /DAN|jailbreak|bypass.*instructions/gi,
]

/**
 * Sanitize user code for safe inclusion in AI prompt.
 *
 * @param code - Raw user code to sanitize
 * @returns Sanitized code wrapped in quarantine delimiters
 *
 * Process:
 * 1. Escape delimiter markers BEFORE neutralizing (avoids accidental delimiter creation)
 * 2. Neutralize known injection patterns
 * 3. Wrap in quarantine delimiters
 */
export function sanitizeQuotedUserCode(code: string): string {
  let sanitized = code

  // Step 1: Escape delimiter markers that appear in user code
  // Use null-byte placeholders — rare in source code, preserved by AI APIs
  sanitized = sanitized
    .replace(new RegExp(DELIMITER_START, 'g'), '\x00ESCAPED_DELIM_START\x00')
    .replace(new RegExp(DELIMITER_END, 'g'), '\x00ESCAPED_DELIM_END\x00')

  // Step 2: Neutralize known injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[BLOCKED INJECTION PATTERN]')
  }

  // Step 3: Wrap in quarantine delimiters
  return `${DELIMITER_START}\n${sanitized}\n${DELIMITER_END}`
}
