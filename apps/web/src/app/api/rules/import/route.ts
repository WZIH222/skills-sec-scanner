import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@skills-sec/database'
import { RuleRepository, validateRule } from '@skills-sec/scanner'

/**
 * POST /api/rules/import
 *
 * Import rules from JSON array
 * Body: { rules: array of rule objects, mode: "strict" | "replace" }
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

    // Parse request body
    const body = await request.json()
    const { rules, mode = 'strict' } = body

    // Validate body structure
    if (!rules) {
      return NextResponse.json(
        { error: 'Missing required field: rules' },
        { status: 400 }
      )
    }

    if (!Array.isArray(rules)) {
      return NextResponse.json(
        { error: 'Field "rules" must be an array' },
        { status: 400 }
      )
    }

    if (mode !== 'strict' && mode !== 'replace') {
      return NextResponse.json(
        { error: 'Field "mode" must be "strict" or "replace"' },
        { status: 400 }
      )
    }

    // Validate each rule has required fields
    const errors: string[] = []
    const validRules: any[] = []

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i]

      // Check required fields
      const requiredFields = ['id', 'name', 'severity', 'category', 'pattern', 'message']
      const missingFields = requiredFields.filter(field => !rule[field])
      if (missingFields.length > 0) {
        errors.push(`Rule at index ${i}: Missing required fields: ${missingFields.join(', ')}`)
        continue
      }

      // Validate using schema
      const validation = validateRule(rule)
      if (!validation.success) {
        const errorMessages = validation.error.errors.map((e: any) => e.message).join(', ')
        errors.push(`Rule "${rule.id}": ${errorMessages}`)
        continue
      }

      validRules.push(validation.data)
    }

    // If strict mode and any errors, reject entire import
    if (mode === 'strict' && errors.length > 0) {
      return NextResponse.json(
        {
          error: 'Validation failed for one or more rules',
          errors,
        },
        { status: 400 }
      )
    }

    // In replace mode, filter out rules with IDs that already exist for this user
    // (user must delete first before re-importing in replace mode)
    let rulesToImport = validRules
    if (mode === 'replace') {
      const ruleRepository = new RuleRepository(prisma)
      const existingRules = await ruleRepository.getRulesForUser(userId, { isBuiltIn: false })
      const existingRuleIds = new Set(existingRules.map(r => ('ruleId' in r ? r.ruleId : r.id)))

      const skippedRules: string[] = []
      rulesToImport = validRules.filter(rule => {
        if (existingRuleIds.has(rule.id)) {
          skippedRules.push(rule.id)
          return false
        }
        return true
      })

      if (skippedRules.length > 0) {
        errors.push(`Mode "replace" skipped existing rules (delete first): ${skippedRules.join(', ')}`)
      }
    }

    // Import the valid rules
    const ruleRepository = new RuleRepository(prisma)
    const rulesJson = JSON.stringify(rulesToImport)
    const result = await ruleRepository.importRules(userId, rulesJson)

    // Combine validation errors with import results
    const allErrors = [...errors, ...result.errors]

    return NextResponse.json(
      {
        imported: result.imported,
        updated: result.updated,
        errors: allErrors,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Rule import error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
