/**
 * POST /api/rules/generate
 *
 * AI-assisted rule generation endpoint (RULE-08).
 * Accepts natural language description, generates rule JSON via AI,
 * and stores with enabled=false for human review (RULE-10).
 */

import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@skills-sec/database'
import { RuleRepository } from '@skills-sec/scanner'
import { buildRuleGenerationPrompt } from '@skills-sec/scanner'
import { validateRule, stringifyReferences } from '@skills-sec/scanner'
import { getAISettings } from '@/lib/settings'

const ALLOWED_PATTERN_TYPES = ['CallExpression', 'MemberExpression', 'Identifier', 'Literal', 'AssignmentExpression']

export async function POST(request: NextRequest) {
  try {
    // 1. Verify auth token
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

    const userId = payload.userId

    // 2. Parse and validate request body
    const body = await request.json()
    const { description } = body

    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: description' },
        { status: 400 }
      )
    }

    if (description.length < 10) {
      return NextResponse.json(
        { error: 'Description must be at least 10 characters long' },
        { status: 400 }
      )
    }

    // 3. Resolve AI provider
    // Priority: Database settings > Environment variables
    let apiKey: string | undefined
    let providerType: string
    let baseURL: string | undefined
    let model: string

    try {
      const dbSettings = await getAISettings()
      if (dbSettings.apiKey) {
        apiKey = dbSettings.apiKey
        providerType = dbSettings.providerType
        baseURL = dbSettings.baseUrl || undefined
        model = dbSettings.model || 'gpt-4o'
        console.info('[RuleGenerate] Using AI config from database:', {
          providerType,
          baseURL,
          model,
        })
      }
    } catch (error) {
      console.warn('[RuleGenerate] Failed to read AI config from database:', error)
    }

    // Fallback to environment variables
    if (!apiKey) {
      apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
      providerType = process.env.AI_PROVIDER_TYPE ||
        (process.env.OPENAI_API_KEY ? 'openai' : process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai')
      baseURL = process.env.AI_BASE_URL || undefined
      model = process.env.AI_MODEL || 'gpt-4o'
      console.info('[RuleGenerate] Using AI config from environment:', {
        providerType,
        baseURL,
        model,
      })
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'No AI API key configured. Please configure AI settings in the Settings page.' },
        { status: 500 }
      )
    }

    // For Anthropic, we need to use the Anthropic SDK instead of OpenAI
    if (providerType === 'anthropic') {
      // Anthropic path - would need different client setup
      return NextResponse.json(
        { error: 'Anthropic provider not yet supported for rule generation. Use OpenAI-compatible provider.' },
        { status: 501 }
      )
    }

    const client = new OpenAI({
      apiKey,
      baseURL,
    })

    console.info('[RuleGenerate] Calling AI API...')
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a security rule generation expert. Return ONLY valid JSON.' },
        { role: 'user', content: buildRuleGenerationPrompt(description) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    })
    console.info('[RuleGenerate] AI API response received')

    const content = response.choices[0].message.content
    if (!content) {
      return NextResponse.json(
        { error: 'AI returned empty response' },
        { status: 500 }
      )
    }

    // 4. Parse AI response as JSON
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(content)
    } catch {
      console.error('[RuleGenerate] AI response was not valid JSON:', content)
      return NextResponse.json(
        { error: 'AI response was not valid JSON' },
        { status: 500 }
      )
    }

    console.info('[RuleGenerate] AI response parsed:', JSON.stringify(parsed, null, 2))

    // 5. Validate response against RuleSchema
    const validation = validateRule(parsed)
    if (!validation.success) {
      console.error('[RuleGenerate] Validation errors:', JSON.stringify(validation.error.errors, null, 2))
      return NextResponse.json(
        { error: 'AI response failed validation', details: validation.error.errors.map(e => e.message) },
        { status: 400 }
      )
    }

    const validated = validation.data

    // 6. Validate pattern.type is one of the allowed types
    if (!ALLOWED_PATTERN_TYPES.includes(validated.pattern.type)) {
      return NextResponse.json(
        { error: 'Invalid pattern type in AI response', details: `Allowed: ${ALLOWED_PATTERN_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // 7. Generate ruleId for AI-generated rule
    const ruleId = `ai-gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // 8. Create rule in database via Prisma with RULE-10 enforcement
    const userRule = await prisma.userRule.create({
      data: {
        userId,
        ruleId,
        name: validated.name,
        description: validated.description,
        severity: validated.severity,
        category: validated.category,
        pattern: JSON.stringify(validated.pattern),
        message: validated.message,
        enabled: false, // RULE-10: always disabled until human reviews
        references: stringifyReferences(validated.references || []),
        isAIGenerated: true,
      },
    })

    // 9. Return created rule
    return NextResponse.json(
      {
        rule: {
          id: userRule.id,
          userId: userRule.userId,
          ruleId: userRule.ruleId,
          name: userRule.name,
          description: userRule.description,
          severity: userRule.severity,
          category: userRule.category,
          pattern: JSON.parse(userRule.pattern),
          message: userRule.message,
          enabled: userRule.enabled,
          references: JSON.parse(userRule.references),
          createdAt: userRule.createdAt,
          updatedAt: userRule.updatedAt,
          isAIGenerated: userRule.isAIGenerated,
        },
        status: 'awaiting_review',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Rule generation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: `Rule generation failed: ${errorMessage}` },
      { status: 500 }
    )
  }
}
