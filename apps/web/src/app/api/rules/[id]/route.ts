import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@skills-sec/database'
import { RuleRepository } from '@skills-sec/scanner'
import { isValidSeverity, isValidCategory } from '@skills-sec/scanner'

/**
 * PUT /api/rules/[id]
 *
 * Update a custom rule (not built-in)
 */
export async function PUT(
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

    // Check if rule exists and is not built-in
    const ruleRepository = new RuleRepository(prisma)
    const existingRule = await ruleRepository.getRuleById(userId, ruleId)

    if (!existingRule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }

    if (existingRule.isBuiltIn) {
      return NextResponse.json(
        { error: 'Cannot modify built-in rules' },
        { status: 403 }
      )
    }

    // Parse request body for updates
    const body = await request.json()
    const { name, description, severity, category, pattern, message, references, enabled } = body

    // Build update data
    const updateData: Record<string, any> = {}

    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (severity !== undefined) {
      if (!isValidSeverity(severity)) {
        return NextResponse.json(
          { error: `Invalid severity value: ${severity}. Must be one of: critical, high, medium, low, info` },
          { status: 400 }
        )
      }
      updateData.severity = severity
    }
    if (category !== undefined) {
      if (!isValidCategory(category)) {
        return NextResponse.json(
          { error: `Invalid category value: ${category}` },
          { status: 400 }
        )
      }
      updateData.category = category
    }
    if (pattern !== undefined) {
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
      updateData.pattern = patternObj
    }
    if (message !== undefined) updateData.message = message
    if (references !== undefined) updateData.references = references
    if (enabled !== undefined) updateData.enabled = enabled

    // Update the rule
    const updatedRule = await ruleRepository.updateRule(userId, ruleId, updateData)

    return NextResponse.json(
      { rule: updatedRule },
      { status: 200 }
    )
  } catch (error) {
    console.error('Rule update error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/rules/[id]
 *
 * Delete a custom rule (not built-in)
 */
export async function DELETE(
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

    // Check if rule exists and is not built-in
    const ruleRepository = new RuleRepository(prisma)
    const existingRule = await ruleRepository.getRuleById(userId, ruleId)

    if (!existingRule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 }
      )
    }

    if (existingRule.isBuiltIn) {
      return NextResponse.json(
        { error: 'Cannot delete built-in rules' },
        { status: 403 }
      )
    }

    // Delete the rule
    await ruleRepository.deleteRule(userId, ruleId)

    return NextResponse.json(
      { success: true },
      { status: 200 }
    )
  } catch (error) {
    console.error('Rule deletion error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/rules/[id]
 *
 * Toggle rule enabled/disabled state
 * Body: { enabled: boolean }
 */
export async function PATCH(
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

    // Parse body
    const body = await request.json()
    const { enabled } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Body must contain { enabled: boolean }' },
        { status: 400 }
      )
    }

    // Toggle the rule
    const ruleRepository = new RuleRepository(prisma)
    const updatedRule = await ruleRepository.toggleRule(userId, ruleId, enabled)

    return NextResponse.json(
      { rule: updatedRule },
      { status: 200 }
    )
  } catch (error) {
    console.error('Rule toggle error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'

    if (errorMessage.includes('not found')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
