import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@skills-sec/database'
import { RuleRepository } from '@skills-sec/scanner'
import { isValidSeverity, isValidCategory } from '@skills-sec/scanner'

// Module-level seeder flag - runs once when module first loads
let seederRan = false

async function ensureRulesSeeded() {
  if (seederRan) return
  seederRan = true
  try {
    const { RuleSeeder } = await import('@skills-sec/scanner')
    await RuleSeeder.seed(prisma)
    console.log('[rules/api] RuleSeeder completed')
  } catch (err) {
    console.warn('[rules/api] RuleSeeder failed:', err)
  }
}

/**
 * GET /api/rules
 *
 * Retrieve all rules for current user (built-in + custom)
 * Query params: severity, category, enabled (all|enabled|disabled)
 */
export async function GET(request: NextRequest) {
  try {
    // Extract and verify JWT token
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
    const organizationId = payload.organizationId || ''

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const severity = searchParams.get('severity')
    const category = searchParams.get('category')
    const enabledParam = searchParams.get('enabled') || 'all'

    // Build filters
    const filters: Record<string, any> = {}
    if (severity) {
      if (!isValidSeverity(severity)) {
        return NextResponse.json(
          { error: `Invalid severity value: ${severity}. Must be one of: critical, high, medium, low, info` },
          { status: 400 }
        )
      }
      filters.severity = severity
    }
    if (category) {
      if (!isValidCategory(category)) {
        return NextResponse.json(
          { error: `Invalid category value: ${category}` },
          { status: 400 }
        )
      }
      filters.category = category
    }
    if (enabledParam === 'enabled') {
      filters.enabled = true
    } else if (enabledParam === 'disabled') {
      filters.enabled = false
    }

    // Create RuleRepository and fetch rules
    await ensureRulesSeeded()
    const ruleRepository = new RuleRepository(prisma)
    const rules = await ruleRepository.getRulesForUser(userId, organizationId, filters)

    return NextResponse.json(
      { rules },
      { status: 200 }
    )
  } catch (error) {
    console.error('Rules retrieval error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/rules
 *
 * Create a new custom rule for current user
 * Body: { name, description?, severity, category, pattern, message, references? }
 */
export async function POST(request: NextRequest) {
  try {
    // Extract and verify JWT token
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
    const organizationId = payload.organizationId || ''

    // Parse request body
    const body = await request.json()
    const { name, description, severity, category, pattern, message, references } = body

    // Validate required fields
    const requiredFields = ['name', 'severity', 'category', 'pattern', 'message']
    const missingFields = requiredFields.filter(field => !body[field])
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate severity
    if (!isValidSeverity(severity)) {
      return NextResponse.json(
        { error: `Invalid severity value: ${severity}. Must be one of: critical, high, medium, low, info` },
        { status: 400 }
      )
    }

    // Validate category
    if (!isValidCategory(category)) {
      return NextResponse.json(
        { error: `Invalid category value: ${category}` },
        { status: 400 }
      )
    }

    // Validate pattern is valid JSON object
    let patternObj: any
    if (typeof pattern === 'string') {
      try {
        patternObj = JSON.parse(pattern)
      } catch {
        return NextResponse.json(
          { error: 'Pattern must be a valid JSON object' },
          { status: 400 }
        )
      }
    } else if (typeof pattern === 'object' && pattern !== null) {
      patternObj = pattern
    } else {
      return NextResponse.json(
        { error: 'Pattern must be a JSON object' },
        { status: 400 }
      )
    }

    // Generate ruleId for custom rule
    const ruleId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // Create RuleRepository and create rule
    const ruleRepository = new RuleRepository(prisma)
    const rule = await ruleRepository.createRule(userId, organizationId, {
      ruleId,
      name,
      description,
      severity,
      category,
      pattern: patternObj,
      message,
      references: references || [],
    })

    return NextResponse.json(
      { rule },
      { status: 201 }
    )
  } catch (error) {
    console.error('Rule creation error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
