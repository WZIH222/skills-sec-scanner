/**
 * Rule Generation Prompt Builder
 *
 * Builds formatted prompts for AI-assisted rule generation.
 * Ensures AI returns valid JSON matching RuleSchema.
 */

import type { Finding } from '../../types'

/**
 * Build rule generation prompt for AI security rule creation
 *
 * @param description - Natural language description of the rule to generate
 * @returns Formatted prompt string for AI rule generation
 */
export function buildRuleGenerationPrompt(description: string): string {
  return `You are a security rule generation expert. Given a natural language description
of a security rule, generate a JSON rule object.

INPUT DESCRIPTION:
${description}

OUTPUT FORMAT (return ONLY valid JSON, no markdown, no explanation):
{
  "id": "ai-gen-{timestamp}",
  "name": "Brief rule name",
  "description": "Optional longer description of what this rule detects",
  "severity": "critical|high|medium|low|info",
  "category": "injection|file-access|credentials|network|prototype-pollution|dom-xss|deserialization|path-traversal",
  "pattern": {
    "type": "CallExpression|MemberExpression|Identifier|Literal|AssignmentExpression",
    "callee": { "type": "Identifier|MemberExpression", "name": "...", "object": "...", "property": "..." }
  },
  "message": "Brief alert message when this pattern is found",
  "references": ["https://example.com/advisory"]
}

CRITICAL RULES:
- pattern.type MUST be one of: CallExpression, MemberExpression, Identifier, Literal, AssignmentExpression
- For CallExpression: include callee with type and name/object/property
- For MemberExpression: include object and property
- severity must match actual risk level
- Return ONLY the JSON object, no markdown, no explanation`
}
