'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle2 } from 'lucide-react'

interface Policy {
  id: string
  mode: 'STRICT' | 'MODERATE' | 'PERMISSIVE'
  organizationId: string
}

interface PolicyResponse {
  policy: Policy
  canOverride: boolean
  isAdmin: boolean
}

interface PolicySelectorProps {
  organizationId?: string
  onSuccess?: () => void
}

const policyDescriptions = {
  STRICT: {
    title: 'Strict',
    description: 'Block all threats, AI confirmation required',
    detail: 'Maximum security. All potential threats are blocked and require AI confirmation before allowing any skill.',
  },
  MODERATE: {
    title: 'Moderate',
    description: 'Warn on threats, AI review for high-risk',
    detail: 'Balanced approach. Low-risk threats are allowed with warnings, high-risk threats require AI review.',
  },
  PERMISSIVE: {
    title: 'Permissive',
    description: 'Log only, no blocking',
    detail: 'Development mode. All threats are logged but no skills are blocked. Use with caution.',
  },
}

export default function PolicySelector({ organizationId, onSuccess }: PolicySelectorProps) {
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [canOverride, setCanOverride] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [selectedMode, setSelectedMode] = useState<string>('')

  useEffect(() => {
    fetchPolicy()
  }, [])

  const fetchPolicy = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/policies')
      if (!response.ok) {
        throw new Error('Failed to fetch policy')
      }

      const data: PolicyResponse = await response.json()
      setPolicy(data.policy)
      setIsAdmin(data.isAdmin)
      setCanOverride(data.canOverride)
      setSelectedMode(data.policy.mode)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load policy')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!policy || selectedMode === policy.mode) {
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      const endpoint = isAdmin ? '/api/policies' : '/api/policies/user'
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode: selectedMode }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update policy')
      }

      const data = await response.json()
      setPolicy(data.policy)
      setSuccess(true)

      setTimeout(() => {
        setSuccess(false)
        onSuccess?.()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update policy')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isAdmin ? 'Organization Security Policy' : 'Personal Security Preference'}
        </CardTitle>
        <CardDescription>
          {isAdmin
            ? 'Configure the default security policy for your organization'
            : 'Set your personal security preference (cannot be more permissive than organization policy)'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Policy updated successfully</span>
          </div>
        )}

        <RadioGroup value={selectedMode} onValueChange={setSelectedMode}>
          {(Object.keys(policyDescriptions) as Array<keyof typeof policyDescriptions>).map((mode) => (
            <div key={mode} className="space-y-2">
              <div className="flex items-start gap-3">
                <RadioGroupItem value={mode} id={mode} disabled={!isAdmin && !canOverride} />
                <div className="flex-1">
                  <Label htmlFor={mode} className="cursor-pointer font-medium">
                    {policyDescriptions[mode].title}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {policyDescriptions[mode].description}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {policyDescriptions[mode].detail}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </RadioGroup>

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {isAdmin ? (
              <>Changes apply to all users in your organization</>
            ) : (
              <>Your personal preference overrides the organization default</>
            )}
          </p>
          <Button
            onClick={handleSave}
            disabled={saving || selectedMode === policy?.mode || (!isAdmin && !canOverride)}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>

        {isAdmin && (
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <strong>Organization Default:</strong> Non-admin users can set personal preferences that are
            equal to or stricter than this policy, but not more permissive.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
