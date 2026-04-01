import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@skills-sec/database'
import { RuleRepository } from '@skills-sec/scanner'

/**
 * GET /api/rules/[id]/export
 *
 * Export a single rule as downloadable JSON
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id: ruleId } = await params

    // Get the rule
    const ruleRepository = new RuleRepository(prisma)
    const rule = await ruleRepository.getRuleById(userId, ruleId)

    if (!rule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }

    // Construct exportable rule JSON (full metadata without internal fields)
    const exportData = {
      id: rule.isBuiltIn ? rule.id : (rule as { ruleId?: string }).ruleId || rule.id,
      name: rule.name,
      description: rule.description,
      severity: rule.severity,
      category: rule.category,
      pattern: rule.pattern,
      message: rule.message,
      enabled: rule.enabled,
      references: rule.references,
    }

    // Return as downloadable JSON
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="rule-${ruleId}.json"`,
      },
    })
  } catch (error) {
    console.error('Rule export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
