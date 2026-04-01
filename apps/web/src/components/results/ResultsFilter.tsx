'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { severityColors, type FilterState, type Severity } from '@/types/scan'

interface ResultsFilterProps {
  findings: any[]
  onFilterChange: (filter: FilterState) => void
  initialFilter?: FilterState
  className?: string
}

const ALL_SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info']

export function ResultsFilter({
  findings,
  onFilterChange,
  initialFilter,
  className
}: ResultsFilterProps) {
  const t = useTranslations('ScanDetail')
  // Initialize from URL params or initialFilter
  const [severities, setSeverities] = useState<Severity[]>(
    initialFilter?.severities || ALL_SEVERITIES
  )
  const [search, setSearch] = useState(initialFilter?.search || '')
  const [debouncedSearch, setDebouncedSearch] = useState(search)
  const [isExpanded, setIsExpanded] = useState(false)

  // Sync with URL params on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const severityParam = params.get('severities')
      const searchParam = params.get('search')

      if (severityParam) {
        const parsedSeverities = severityParam.split(',') as Severity[]
        setSeverities(parsedSeverities)
      }

      if (searchParam) {
        setSearch(searchParam)
        setDebouncedSearch(searchParam)
      }
    }
  }, [])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)

    return () => clearTimeout(timer)
  }, [search])

  // Update URL params when filter changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      const params = new URLSearchParams(url.search)

      if (severities.length === ALL_SEVERITIES.length) {
        params.delete('severities')
      } else {
        params.set('severities', severities.join(','))
      }

      if (debouncedSearch) {
        params.set('search', debouncedSearch)
      } else {
        params.delete('search')
      }

      const newUrl = `${window.location.pathname}${
        params.toString() ? '?' + params.toString() : ''
      }`
      window.history.replaceState({}, '', newUrl)
    }
  }, [severities, debouncedSearch])

  // Notify parent of filter changes
  useEffect(() => {
    onFilterChange({ severities, search: debouncedSearch })
  }, [severities, debouncedSearch, onFilterChange])

  const handleSeverityToggle = (severity: Severity) => {
    setSeverities(prev => {
      if (prev.includes(severity)) {
        // Don't allow deselecting all severities
        if (prev.length === 1) return prev
        return prev.filter(s => s !== severity)
      } else {
        return [...prev, severity]
      }
    })
  }

  const handleShowAll = () => {
    setSeverities(ALL_SEVERITIES)
  }

  const handleHideAll = () => {
    // Keep at least one severity selected
    setSeverities(['info'])
  }

  const handleClearSearch = () => {
    setSearch('')
  }

  const handleClearAll = () => {
    setSeverities(ALL_SEVERITIES)
    setSearch('')
  }

  const hasActiveFilters =
    severities.length !== ALL_SEVERITIES.length || debouncedSearch.length > 0

  // Count findings by severity
  const severityCounts = findings.reduce((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const filteredCount = findings.filter(finding =>
    severities.includes(finding.severity) &&
    (debouncedSearch === '' ||
     finding.ruleId.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
     finding.message.toLowerCase().includes(debouncedSearch.toLowerCase()))
  ).length

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 pr-10"
        />
        {search && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={handleClearSearch}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Severity Filters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm font-medium hover:text-foreground text-foreground/80 transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {t('severityFilter')}
          </button>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="h-8 text-xs"
              >
                {t('clearAll')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={isExpanded ? handleHideAll : handleShowAll}
              className="h-8 text-xs"
            >
              {isExpanded ? t('hideAll') : t('showAll')}
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="space-y-2 pt-2">
            {ALL_SEVERITIES.map(severity => {
              const colors = severityColors[severity]
              const count = severityCounts[severity] || 0

              return (
                <label
                  key={severity}
                  className={cn(
                    'flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800',
                    !severities.includes(severity) && 'opacity-50'
                  )}
                >
                  <Checkbox
                    checked={severities.includes(severity)}
                    onCheckedChange={() => handleSeverityToggle(severity)}
                  />
                  <Badge
                    variant="outline"
                    className={cn('capitalize', colors.border, colors.text)}
                  >
                    {severity}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    ({count})
                  </span>
                </label>
              )
            })}
          </div>
        )}

        {!isExpanded && (
          <div className="flex flex-wrap gap-2 pt-2">
            {ALL_SEVERITIES.filter(s => severities.includes(s)).map(severity => {
              const colors = severityColors[severity]
              return (
                <Badge
                  key={severity}
                  variant="outline"
                  className={cn('capitalize', colors.border, colors.text)}
                >
                  {severity}
                </Badge>
              )
            })}
            {severities.length < ALL_SEVERITIES.length && (
              <Badge variant="secondary" className="text-muted-foreground">
                +{ALL_SEVERITIES.length - severities.length} {t('more')}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Filter Count */}
      <div className="text-sm text-muted-foreground">
        {t('showingOf', { count: filteredCount, total: findings.length })}
      </div>
    </div>
  )
}
