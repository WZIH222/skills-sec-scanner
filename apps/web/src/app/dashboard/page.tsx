'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppHeader } from '@/components/layout'
import { useTranslations } from 'next-intl'

interface StatsResponse {
  totalScans: number
  scansToday: number
  scansThisWeek: number
  threatDistribution: {
    critical: number
    high: number
    medium: number
    low: number
    info: number
  }
  trendData: Array<{ date: string; count: number }>
  topThreats: Array<{ ruleId: string; count: number; severity: string }>
}

interface DonutSegment {
  label: string
  value: number
  color: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const t = useTranslations('Dashboard')

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/stats', {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch statistics')
      }

      const data = await response.json()
      setStats(data)
      setError(null)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
      setError('Failed to load statistics')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch stats on mount
  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Re-fetch on window focus (auto-refresh per DASH-04)
  useEffect(() => {
    const handleFocus = () => {
      fetchStats()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchStats])

  // Calculate donut chart segments
  const getDonutSegments = (): DonutSegment[] => {
    if (!stats) return []
    const { critical, high, medium, low } = stats.threatDistribution
    const segments: DonutSegment[] = []
    if (critical > 0) segments.push({ label: t('critical'), value: critical, color: '#dc2626' })
    if (high > 0) segments.push({ label: t('high'), value: high, color: '#f97316' })
    if (medium > 0) segments.push({ label: t('medium'), value: medium, color: '#eab308' })
    if (low > 0) segments.push({ label: t('low'), value: low, color: '#22c55e' })
    return segments
  }

  // Calculate SVG path for donut chart
  const getDonutPath = (segments: DonutSegment[], total: number, radius: number, thickness: number) => {
    if (total === 0) return []
    const centerX = 100
    const centerY = 100
    let currentAngle = -90 // Start from top

    return segments.map((segment) => {
      const percentage = segment.value / total
      const angle = percentage * 360
      const startAngle = currentAngle
      const endAngle = currentAngle + angle

      const startRad = (startAngle * Math.PI) / 180
      const endRad = (endAngle * Math.PI) / 180

      const x1 = centerX + radius * Math.cos(startRad)
      const y1 = centerY + radius * Math.sin(startRad)
      const x2 = centerX + radius * Math.cos(endRad)
      const y2 = centerY + radius * Math.sin(endRad)

      const innerRadius = radius - thickness
      const x3 = centerX + innerRadius * Math.cos(endRad)
      const y3 = centerY + innerRadius * Math.sin(endRad)
      const x4 = centerX + innerRadius * Math.cos(startRad)
      const y4 = centerY + innerRadius * Math.sin(startRad)

      const largeArc = angle > 180 ? 1 : 0

      const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4} Z`

      currentAngle = endAngle

      return { ...segment, d }
    })
  }

  const totalFindings = stats ? stats.threatDistribution.critical + stats.threatDistribution.high + stats.threatDistribution.medium + stats.threatDistribution.low + stats.threatDistribution.info : 0
  const segments = getDonutSegments()
  const donutPaths = getDonutPath(segments, totalFindings, 80, 30)

  // Calculate max for trend chart
  const maxTrendCount = stats?.trendData ? Math.max(...stats.trendData.map(d => d.count), 1) : 1

  // Get severity badge color
  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      case 'info': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />

      {loading ? (
        <main className="container mx-auto px-4 py-12">
          <div className="max-w-5xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
                ))}
              </div>
            </div>
          </div>
        </main>
      ) : error ? (
        <main className="container mx-auto px-4 py-12">
          <div className="max-w-5xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
              <p className="text-red-800">{error}</p>
              <button onClick={fetchStats} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                Retry
              </button>
            </div>
          </div>
        </main>
      ) : (
        <>
          {/* Main Content */}
          <main className="container mx-auto px-4 py-8">
            <div className="max-w-5xl mx-auto">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
                <p className="text-gray-600 mt-1">{t('subtitle')}</p>
              </div>

          {/* Stats Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Total Scans Card */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="text-sm font-medium text-gray-500 mb-1">{t('totalScans')}</div>
              <div className="text-3xl font-bold text-gray-900">{stats?.totalScans ?? 0}</div>
              <div className="text-sm text-gray-500 mt-1">{t('allTime')}</div>
            </div>

            {/* Scans Today Card */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="text-sm font-medium text-gray-500 mb-1">{t('scansToday')}</div>
              <div className="text-3xl font-bold text-gray-900">{stats?.scansToday ?? 0}</div>
              <div className="text-sm text-gray-500 mt-1">{t('last24Hours')}</div>
            </div>

            {/* Scans This Week Card */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="text-sm font-medium text-gray-500 mb-1">{t('scansThisWeek')}</div>
              <div className="text-3xl font-bold text-gray-900">{stats?.scansThisWeek ?? 0}</div>
              <div className="text-sm text-gray-500 mt-1">{t('last7Days')}</div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Threat Distribution Donut Chart */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('threatDistribution')}</h3>
              {totalFindings === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                  </svg>
                  <p>{t('noThreats')}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <svg width="200" height="200" viewBox="0 0 200 200">
                    {/* Donut chart paths */}
                    {donutPaths.map((path, index) => (
                      <path
                        key={index}
                        d={path.d}
                        fill={path.color}
                        stroke="white"
                        strokeWidth="2"
                      />
                    ))}
                    {/* Center text */}
                    <text x="100" y="95" textAnchor="middle" className="text-2xl font-bold fill-gray-900">
                      {totalFindings}
                    </text>
                    <text x="100" y="115" textAnchor="middle" className="text-sm fill-gray-500">
                      {t('findings')}
                    </text>
                  </svg>
                  {/* Legend */}
                  <div className="flex flex-wrap justify-center gap-4 mt-4">
                    {segments.map((segment, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: segment.color }}
                        />
                        <span className="text-sm text-gray-600">
                          {segment.label}: {segment.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 7-Day Trend Chart */}
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('sevenDayTrend')}</h3>
              {stats?.trendData && stats.trendData.length > 0 ? (
                <div className="flex items-end justify-between h-48 gap-2">
                  {stats.trendData.map((day, index) => (
                    <div key={index} className="flex flex-col items-center flex-1">
                      <div className="relative w-full flex items-end justify-center" style={{ height: '160px' }}>
                        <div
                          className="w-full max-w-8 bg-blue-600 rounded-t transition-all hover:bg-blue-700"
                          style={{ height: `${(day.count / maxTrendCount) * 100}%` }}
                          title={`${day.count} scans`}
                        />
                      </div>
                      <span className="text-xs text-gray-500 mt-2">{formatDate(day.date)}</span>
                      <span className="text-xs font-medium text-gray-700">{day.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                  <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                  <p>{t('noData')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Threats List */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('topThreats')}</h3>
            {stats?.topThreats && stats.topThreats.length > 0 ? (
              <div className="space-y-3">
                {stats.topThreats.map((threat, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-gray-300">{index + 1}</span>
                      <div>
                        <div className="font-medium text-gray-900">{threat.ruleId}</div>
                        <div className="text-sm text-gray-500">{threat.count} {t('occurrences')}</div>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(threat.severity)}`}>
                      {threat.severity}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <p>{t('noThreats')}</p>
              </div>
            )}
          </div>
        </div>
      </main>
        </>
      )}
    </div>
  )
}
