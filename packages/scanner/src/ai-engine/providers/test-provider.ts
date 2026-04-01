/**
 * Test AI Provider
 *
 * Implements IAIProvider interface for integration testing of AI wiring.
 * Returns realistic mock AI responses without external API calls.
 *
 * This provider is for integration testing through the full pipeline,
 * unlike MockAIProvider which is for unit testing.
 */

import { AIAnalysisResultSchema, type AIAnalysisResult, type IAIProvider } from '../types'
import type { Finding } from '../../types'

/**
 * Suspicious patterns that trigger high-severity findings
 */
const SUSPICIOUS_PATTERNS = [
  { pattern: /\b(eval|exec|Function)\s*\(/gi, ruleId: 'AI-EXEC', severity: 'high' as const, message: 'Dynamic code execution detected', explanation: 'The use of eval(), exec(), or Function() constructor allows dynamic code execution which can be exploited by attackers to run arbitrary code. This pattern is commonly used in injection attacks and should be avoided in favor of safer alternatives.' },
  { pattern: /\bfetch\s*\(/gi, ruleId: 'AI-NETWORK', severity: 'high' as const, message: 'Network request detected', explanation: 'Direct network requests can be used for data exfiltration or to fetch malicious content. Ensure all network calls are validated and use HTTPS with proper certificate validation.' },
  { pattern: /\bprocess\.env\./gi, ruleId: 'AI-ENV', severity: 'medium' as const, message: 'Environment variable access detected', explanation: 'Accessing environment variables can expose sensitive configuration and secrets. Ensure only necessary environment variables are accessed and their values are properly sanitized before use.' },
  { pattern: /\bchild_process\./gi, ruleId: 'AI-SHELL', severity: 'critical' as const, message: 'Shell command execution detected', explanation: 'Direct shell command execution through child_process module is extremely dangerous and can lead to command injection attacks. Use parameterized commands or consider safer alternatives like node:child_process spawn with proper argument handling.' },
  { pattern: /\brequire\s*\(\s*['"]child_process['"]\s*\)/gi, ruleId: 'AI-SHELL-REQUIRE', severity: 'critical' as const, message: 'child_process module import detected', explanation: 'Importing the child_process module indicates potential for shell command execution. This is a critical security concern unless the imported module is used for legitimate, safe purposes like subprocess management.' },
  { pattern: /\b Buffer\.from\s*\([^)]*\)\.toString\s*\(\s*['"]base64['"]\s*\)/gi, ruleId: 'AI-ENCODING', severity: 'medium' as const, message: 'Base64 encoding detected', explanation: 'Base64 encoding is often used to obfuscate malicious content or to prepare data for exfiltration. While legitimate uses exist, this pattern combined with other suspicious activities warrants closer inspection.' },
  { pattern: /\bJSON\.parse\s*\([^)]*\)[^;]*\beval\s*\(/gi, ruleId: 'AI-INJECT', severity: 'critical' as const, message: 'Potential code injection via JSON.parse + eval', explanation: 'Combining JSON.parse with eval() is a common injection attack vector where attacker-controlled JSON content is executed as code. This should never be done with untrusted input.' },
]

/**
 * Prompt injection patterns
 */
const INJECTION_PATTERNS = [
  { pattern: /ignore\s+(previous|all)\s+(instructions?|orders?)/gi, jailbreakType: 'ignore-instructions' as const, confidence: 95 },
  { pattern: /\byou\s+are\s+(now|a|must\s+be)\b/gi, jailbreakType: 'role-reversal' as const, confidence: 85 },
  { pattern: /\bDAN\b/gi, jailbreakType: 'DAN' as const, confidence: 90 },
  { pattern: /forget\s+(everything|all\s+previous)/gi, jailbreakType: 'ignore-instructions' as const, confidence: 88 },
  { pattern: /new\s+instructions?/gi, jailbreakType: 'ignore-instructions' as const, confidence: 75 },
  { pattern: /\bsystem\s*prompt/gi, jailbreakType: 'system-prompt' as const, confidence: 80 },
]

export class TestAIProvider implements IAIProvider {
  /**
   * Analyze code for security threats
   * Returns realistic mock responses based on code patterns
   */
  async analyzeCode(params: {
    code: string
    filename?: string
    findings: Finding[]
  }): Promise<AIAnalysisResult | null> {
    const findings: AIAnalysisResult['findings'] = []

    // Check for suspicious patterns
    for (const { pattern, ruleId, severity, message, explanation } of SUSPICIOUS_PATTERNS) {
      if (pattern.test(params.code)) {
        findings.push({
          ruleId,
          severity,
          message,
          explanation,
          confidence: 85 + Math.floor(Math.random() * 15), // 85-100
        })
        // Reset regex state
        pattern.lastIndex = 0
      }
    }

    // If there are already static findings, provide AI-enhanced explanations
    for (const finding of params.findings) {
      // Avoid duplicate rule IDs
      if (!findings.some(f => f.ruleId === finding.ruleId)) {
        findings.push({
          ruleId: `${finding.ruleId}-AI`,
          severity: finding.severity,
          message: `AI-enhanced: ${finding.message}`,
          explanation: this.generateExplanation(finding),
          confidence: 70 + Math.floor(Math.random() * 25), // 70-95
        })
      }
    }

    const result: AIAnalysisResult = {
      findings,
      promptInjectionDetected: false,
      jailbreakType: 'none',
    }

    // Validate with schema
    return AIAnalysisResultSchema.parse(result)
  }

  /**
   * Detect prompt injection patterns
   */
  async detectPromptInjection(prompt: string): Promise<{
    detected: boolean
    jailbreakType?: string
    confidence: number
  }> {
    for (const { pattern, jailbreakType, confidence } of INJECTION_PATTERNS) {
      if (pattern.test(prompt)) {
        return {
          detected: true,
          jailbreakType,
          confidence,
        }
      }
    }

    return {
      detected: false,
      jailbreakType: 'none',
      confidence: 0,
    }
  }

  /**
   * Always available for testing
   */
  async isAvailable(): Promise<boolean> {
    return true
  }

  /**
   * Generate AI explanation for a finding
   */
  private generateExplanation(finding: Finding): string {
    const explanations: Record<string, string[]> = {
      critical: [
        'This represents an extremely severe security vulnerability that could allow an attacker to gain complete control over the system, execute arbitrary code, or exfiltrate sensitive data. Immediate remediation is required.',
        'The detected pattern indicates a critical weakness that attackers actively exploit. This vulnerability could lead to remote code execution, data breaches, or complete system compromise.',
        'A critical security flaw was identified that bypasses normal security controls. Exploitation could result in full system access, data theft, or service disruption.',
      ],
      high: [
        'This high-severity issue could allow attackers to escalate privileges, access restricted resources, or perform unauthorized actions. Prompt action should be taken to mitigate this risk.',
        'The identified pattern suggests a significant attack vector that could be leveraged for malicious purposes. While not immediately critical, this warrants careful attention.',
        'A serious security concern was detected that could compromise system integrity or confidentiality if exploited by a determined attacker.',
      ],
      medium: [
        'This pattern indicates a potential security concern that should be reviewed. While not immediately exploitable, it could become dangerous under certain conditions.',
        'A moderate risk was identified that might allow attackers to cause limited harm or gain partial access. Best practices suggest addressing this issue.',
        'The detected pattern could lead to security issues if combined with other vulnerabilities or if used in a malicious context.',
      ],
      low: [
        'This low-severity finding represents a minor security consideration. While unlikely to be exploited on its own, it should be noted for completeness.',
        'A minor code pattern was detected that has low exploitability but represents a departure from security best practices.',
        'This finding indicates a small potential for misuse, though in most contexts it poses minimal risk.',
      ],
      info: [
        'This is an informational alert about a code pattern that may warrant review, though it does not represent a direct security threat.',
        'An interesting pattern was detected that while not inherently dangerous, could provide useful context for security analysis.',
        'This informational finding helps provide a complete picture of the code security posture.',
      ],
    }

    const options = explanations[finding.severity] || explanations.info
    return options[Math.floor(Math.random() * options.length)]
  }
}

// Named exports for the factory
export const TestAIProviderInstance = new TestAIProvider()

export async function analyzeCode(params: {
  code: string
  filename?: string
  findings: Finding[]
}): Promise<AIAnalysisResult | null> {
  return TestAIProviderInstance.analyzeCode(params)
}

export async function detectPromptInjection(prompt: string): Promise<{
  detected: boolean
  jailbreakType?: string
  confidence: number
}> {
  return TestAIProviderInstance.detectPromptInjection(prompt)
}

export async function isAvailable(): Promise<boolean> {
  return TestAIProviderInstance.isAvailable()
}
