'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, AlertCircle, Sparkles } from 'lucide-react'

interface RuleGenerateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerateComplete: () => void
}

interface GeneratedRule {
  id?: string
  name: string
  description?: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  category: string
  pattern: unknown
  message: string
  references?: string[]
}

interface TestResult {
  findings: Array<{
    ruleId: string
    severity: string
    message: string
    location: { line: number; column: number }
    code?: string
  }>
  matchCount: number
}

export default function RuleGenerateDialog({
  open,
  onOpenChange,
  onGenerateComplete,
}: RuleGenerateDialogProps) {
  const [description, setDescription] = useState('')
  const [generatedRule, setGeneratedRule] = useState<GeneratedRule | null>(null)
  const [testCode, setTestCode] = useState('')
  const [testResults, setTestResults] = useState<TestResult | null>(null)

  const [generating, setGenerating] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleClose = () => {
    setDescription('')
    setGeneratedRule(null)
    setTestCode('')
    setTestResults(null)
    setError(null)
    setSuccessMessage(null)
    onOpenChange(false)
  }

  const handleGenerate = async () => {
    if (!description.trim() || description.length < 10) {
      setError('Description must be at least 10 characters')
      return
    }

    try {
      setGenerating(true)
      setError(null)

      const response = await fetch('/api/rules/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate rule')
      }

      // Validate that the API returned a proper rule object
      if (!data.rule || !data.rule.name || !data.rule.pattern || !data.rule.message) {
        console.error('[RuleGenerate] Invalid rule data from API:', data)
        throw new Error('Invalid rule data received from API')
      }

      console.info('[RuleGenerate] Rule generated successfully:', JSON.stringify(data.rule, null, 2))
      console.info('[RuleGenerate] Setting generatedRule state...')
      setGeneratedRule(data.rule)
      console.info('[RuleGenerate] generatedRule state set, current state:', JSON.stringify(data.rule, null, 2))
      setSuccessMessage('Rule generated! Review the rule below and test it with sample code.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate rule')
    } finally {
      setGenerating(false)
    }
  }

  const handleTest = async () => {
    if (!generatedRule || !generatedRule.name || !generatedRule.pattern) {
      setError('No valid rule to test. Please generate a rule first.')
      return
    }
    if (!testCode.trim()) {
      setError('Please provide sample code to test')
      return
    }

    try {
      setTesting(true)
      setError(null)

      console.info('[RuleGenerateDialog] Testing rule:', JSON.stringify(generatedRule, null, 2))
      console.info('[RuleGenerateDialog] Test code:', testCode)
      const response = await fetch('/api/rules/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: testCode.trim(),
          rule: generatedRule,
        }),
      })
      console.info('[RuleGenerateDialog] Test response status:', response.status)

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to test rule')
      }

      setTestResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test rule')
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!generatedRule) {
      setError('No rule to save')
      return
    }

    try {
      setSaving(true)
      setError(null)

      // Generate ruleId for the rule
      const ruleId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      const response = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: generatedRule.name,
          description: generatedRule.description,
          severity: generatedRule.severity,
          category: generatedRule.category,
          pattern: generatedRule.pattern,
          message: generatedRule.message,
          references: generatedRule.references || [],
          isAIGenerated: true,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save rule')
      }

      setSuccessMessage('Rule created and awaiting review. Enable it in the rules list when ready.')
      setTimeout(() => {
        onGenerateComplete()
        handleClose()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule')
    } finally {
      setSaving(false)
    }
  }

  // Debug: log generatedRule on every render
  console.info('[RuleGenerateDialog] Render, generatedRule:', JSON.stringify(generatedRule, null, 2), 'testCode:', testCode.substring(0, 50))

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Generate AI Rule
          </DialogTitle>
          <DialogDescription>
            Describe the security pattern you want to detect in natural language.
            The AI will generate a rule that you can test before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
              {successMessage}
            </div>
          )}

          {/* Step 1: Description Input */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Describe the security pattern <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Detect when code uses eval() with user input, or flag hardcoded API keys"
              rows={3}
              disabled={generating || !!generatedRule}
            />
            <p className="text-xs text-muted-foreground">
              Be specific about what to detect and why it is a security concern.
            </p>
          </div>

          {/* Generate Button */}
          {!generatedRule && (
            <Button onClick={handleGenerate} disabled={generating || !description.trim()}>
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Rule
                </>
              )}
            </Button>
          )}

          {/* Step 2: Generated Rule Display */}
          {generatedRule && (
            <>
              <div className="space-y-2">
                <Label>Generated Rule (Preview)</Label>
                <Textarea
                  value={JSON.stringify(generatedRule, null, 2)}
                  readOnly
                  rows={10}
                  className="font-mono text-sm bg-muted"
                />
              </div>

              {/* Step 3: Test Area */}
              <div className="space-y-2">
                <Label htmlFor="testCode">Test with Sample Code</Label>
                <Textarea
                  id="testCode"
                  value={testCode}
                  onChange={(e) => setTestCode(e.target.value)}
                  placeholder="Enter code to test the rule against, e.g., eval(userInput)"
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>

              {/* Test Results */}
              {testResults && (
                <div className="rounded-lg bg-muted p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Test Results:</span>
                    <span className="text-sm">
                      <span className={testResults.matchCount > 0 ? 'text-red-500 font-medium' : 'text-green-500'}>
                        {testResults.matchCount} match{testResults.matchCount !== 1 ? 'es' : ''}
                      </span>
                      {' '}found
                    </span>
                  </div>
                  {testResults.findings.length > 0 ? (
                    <div className="space-y-1">
                      {testResults.findings.map((finding, idx) => (
                        <div key={idx} className="text-sm border-l-2 border-red-500 pl-2">
                          <span className="font-medium">{finding.severity}:</span> {finding.message}
                          {finding.code && (
                            <code className="ml-2 text-xs bg-muted-foreground/20 px-1 rounded">
                              {finding.code}
                            </code>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No issues detected in sample code.</p>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={testing || !testCode.trim()}
                >
                  {testing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Rule'
                  )}
                </Button>

                <Button
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Rule'
                  )}
                </Button>

                <Button
                  variant="ghost"
                  onClick={handleClose}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Saved rules will be disabled by default. Enable them in the rules list after review.
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={generating || saving}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
