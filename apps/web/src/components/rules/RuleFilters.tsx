'use client'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface RuleFiltersProps {
  severity: string
  category: string
  status: 'all' | 'enabled' | 'disabled'
  onSeverityChange: (v: string) => void
  onCategoryChange: (v: string) => void
  onStatusChange: (v: 'all' | 'enabled' | 'disabled') => void
  onClearFilters: () => void
}

const SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low', 'info']

const CATEGORIES = [
  'injection',
  'file-access',
  'credentials',
  'network',
  'code-execution',
  'data-exposure',
  'malicious-ai-behavior',
  'other',
]

export default function RuleFilters({
  severity,
  category,
  status,
  onSeverityChange,
  onCategoryChange,
  onStatusChange,
  onClearFilters,
}: RuleFiltersProps) {
  const hasActiveFilters = severity !== 'all' || category !== 'all' || status !== 'all'

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Severity Filter */}
      <Select value={severity} onValueChange={onSeverityChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Severity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Severities</SelectItem>
          {SEVERITY_LEVELS.map((level) => (
            <SelectItem key={level} value={level}>
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Category Filter */}
      <Select value={category} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {CATEGORIES.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {cat.charAt(0).toUpperCase() + cat.slice(1).replace(/-/g, ' ')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status Filter - Button Group */}
      <div className="flex items-center rounded-md border">
        <Button
          variant={status === 'all' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-none border-0 px-3 h-9"
          onClick={() => onStatusChange('all')}
        >
          All
        </Button>
        <div className="h-9 w-px bg-border" />
        <Button
          variant={status === 'enabled' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-none border-0 px-3 h-9"
          onClick={() => onStatusChange('enabled')}
        >
          Enabled
        </Button>
        <div className="h-9 w-px bg-border" />
        <Button
          variant={status === 'disabled' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-none border-0 px-3 h-9"
          onClick={() => onStatusChange('disabled')}
        >
          Disabled
        </Button>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-muted-foreground">
          Clear Filters
        </Button>
      )}
    </div>
  )
}
