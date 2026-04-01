import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@skills-sec/database'

/**
 * GET /api/stats
 *
 * Retrieve aggregated scan statistics for dashboard
 * Returns: totalScans, scansToday, scansThisWeek, threatDistribution, trendData, topThreats
 */
export async function GET(request: NextRequest) {
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : request.cookies.get('auth-token')?.value

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

    // Get start of today (00:00:00)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get start of 7 days ago
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6) // Include today, so 6 days back

    // Build user filter - only show scans created by this user
    // Note: Scans are filtered by userId in metadata
    const userMetadataFilter = {
      OR: [
        { metadata: { contains: `"userId":"${userId}"` } },
        { metadata: { contains: `"userId": "${userId}"` } },
      ],
      status: 'completed',
    }

    // 1. Total scans count
    const totalScans = await prisma.scan.count({
      where: {
        ...userMetadataFilter,
      },
    })

    // 2. Scans today
    const scansToday = await prisma.scan.count({
      where: {
        ...userMetadataFilter,
        scannedAt: {
          gte: today,
        },
      },
    })

    // 3. Scans this week (last 7 days including today)
    const scansThisWeek = await prisma.scan.count({
      where: {
        ...userMetadataFilter,
        scannedAt: {
          gte: sevenDaysAgo,
        },
      },
    })

    // 4. Threat distribution - count findings by severity
    // We need to join scans with findings and filter by user
    const scansWithFindings = await prisma.scan.findMany({
      where: {
        ...userMetadataFilter,
      },
      select: {
        id: true,
        findings: {
          select: {
            severity: true,
          },
        },
      },
    })

    const threatDistribution = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    }

    for (const scan of scansWithFindings) {
      for (const finding of scan.findings) {
        const severity = finding.severity.toLowerCase()
        if (severity in threatDistribution) {
          threatDistribution[severity as keyof typeof threatDistribution]++
        }
      }
    }

    // 5. Trend data - scans per day for last 7 days
    const trendData: Array<{ date: string; count: number }> = []

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD format

      const dayStart = new Date(date)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(date)
      dayEnd.setHours(23, 59, 59, 999)

      const count = await prisma.scan.count({
        where: {
          ...userMetadataFilter,
          scannedAt: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      })

      trendData.push({ date: dateStr, count })
    }

    // 6. Top threats - top 5 most frequent ruleIds
    const allFindings = await prisma.finding.findMany({
      where: {
        scan: userMetadataFilter,
      },
      select: {
        ruleId: true,
        severity: true,
      },
    })

    // Count occurrences of each ruleId
    const ruleCounts = new Map<string, { count: number; severity: string }>()
    for (const finding of allFindings) {
      const existing = ruleCounts.get(finding.ruleId)
      if (existing) {
        existing.count++
      } else {
        ruleCounts.set(finding.ruleId, { count: 1, severity: finding.severity })
      }
    }

    // Sort by count descending and take top 5
    const topThreats = Array.from(ruleCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([ruleId, data]) => ({
        ruleId,
        count: data.count,
        severity: data.severity,
      }))

    return NextResponse.json(
      {
        totalScans,
        scansToday,
        scansThisWeek,
        threatDistribution,
        trendData,
        topThreats,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Stats retrieval error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
