/**
 * POST /api/rules/test
 *
 * Rule testing endpoint (RULE-09).
 * Tests AI-generated rules against sample code before saving.
 * Uses isolated rule testing - only the candidate rule is evaluated.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { TypeScriptParser, PatternMatcher, validateRule } from '@skills-sec/scanner'
import { z } from 'zod'

const ALLOWED_PATTERN_TYPES = ['CallExpression', 'MemberExpression', 'Identifier', 'Literal', 'AssignmentExpression']

/**
 * Schema for rule test request
 * Note: rule is validated later by validateRule, so we use z.any() to pass it through
 */
const testSchema = z.object({
  code: z.string().min(1, 'Sample code is required'),
  rule: z.any(), // Must be z.any() to preserve the full object - z.object({}) strips all properties!
})

export async function POST(request: NextRequest) {
  try {
    // 1. Verify auth token (before parsing body - auth check first)
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // 2. Parse and validate request body
    const body = await request.json()
    const parseResult = testSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.errors },
        { status: 400 }
      )
    }

    const { code, rule } = parseResult.data

    // Debug: Log received data
    console.info('[RuleTest] Received code:', code)
    console.info('[RuleTest] Received rule keys:', Object.keys(rule || {}))

    // 3. Validate rule against RuleSchema

    // More lenient validation - extract what we need from the rule
    if (!rule) {
      return NextResponse.json(
        { error: 'Invalid rule data', details: ['Rule is null or undefined'] },
        { status: 400 }
      )
    }

    // Check required fields manually
    const requiredFields = ['name', 'pattern', 'message', 'severity', 'category']
    const missing = requiredFields.filter(f => !rule[f])
    if (missing.length > 0) {
      console.error('[RuleTest] Missing required fields:', missing)
      return NextResponse.json(
        { error: 'Invalid rule data', details: [`Missing fields: ${missing.join(', ')}`] },
        { status: 400 }
      )
    }

    // Validate pattern.type
    const allowedTypes = ['CallExpression', 'MemberExpression', 'Identifier', 'Literal', 'AssignmentExpression']
    if (!allowedTypes.includes(rule.pattern.type)) {
      return NextResponse.json(
        { error: 'Invalid pattern type', details: `Allowed: ${allowedTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const validation = validateRule(rule)
    if (!validation.success) {
      console.error('[RuleTest] Zod validation failed:', JSON.stringify(validation.error.errors, null, 2))
      // Return more helpful error with what was received
      return NextResponse.json(
        { error: 'Invalid rule data', details: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`) },
        { status: 400 }
      )
    }

    const validated = validation.data

    // 4. Validate pattern.type is one of the allowed types
    if (!ALLOWED_PATTERN_TYPES.includes(validated.pattern.type)) {
      return NextResponse.json(
        { error: 'Invalid pattern type', details: `Allowed: ${ALLOWED_PATTERN_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // 5. Parse the sample code using TypeScriptParser
    console.info('[RuleTest] About to parse code:', JSON.stringify(code))
    const parser = new TypeScriptParser()
    const parseOutput = await parser.parse(code, 'test-sample.ts')
    console.info('[RuleTest] Parse output ast:', !!parseOutput.ast, 'errors:', JSON.stringify(parseOutput.errors))

    if (!parseOutput.ast) {
      return NextResponse.json(
        { error: 'Failed to parse sample code', details: parseOutput.errors },
        { status: 400 }
      )
    }

    // 6. Create PatternMatcher with ONLY the candidate rule (isolated testing)
    // Critical: Not all user rules - only the candidate rule under test
    const candidateRule = {
      id: validated.id,
      severity: validated.severity,
      category: validated.category,
      pattern: validated.pattern,
      message: validated.message,
    }
    const matcher = new PatternMatcher([candidateRule], code)

    // 7. Run matching against the parsed AST
    const findings = matcher.findMatches(parseOutput.ast as any)

    // 8. Return findings with match count
    return NextResponse.json({
      findings: findings.map(f => ({
        ruleId: f.ruleId,
        severity: f.severity,
        message: f.message,
        location: f.location,
        code: f.code,
      })),
      matchCount: findings.length,
    })
  } catch (error) {
    console.error('Rule test error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: `Rule test failed: ${errorMessage}` },
      { status: 500 }
    )
  }
}
