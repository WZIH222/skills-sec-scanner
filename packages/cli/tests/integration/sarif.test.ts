/**
 * Integration tests for SARIF export functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFile, unlink, mkdir } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { convertToSarif, exportSarif } from '../../src/output/sarif.js'
import type { ScanResult } from '@skills-sec/scanner'

describe('SARIF Export Integration Tests', () => {
  const tempDir = join(tmpdir(), `s3-cli-sarif-test-${Date.now()}`)
  let mockResult: ScanResult

  beforeEach(async () => {
    // Create temp directory
    await mkdir(tempDir, { recursive: true })

    // Create mock scan result with various severity levels
    mockResult = {
      findings: [
        {
          ruleId: 'critical-rule',
          severity: 'critical',
          message: 'Critical security issue',
          location: { line: 10, column: 5 },
          code: 'eval(userInput)',
        },
        {
          ruleId: 'high-rule',
          severity: 'high',
          message: 'High severity issue',
          location: { line: 20, column: 1 },
        },
        {
          ruleId: 'medium-rule',
          severity: 'medium',
          message: 'Medium severity issue',
          location: { line: 30, column: 1 },
        },
        {
          ruleId: 'low-rule',
          severity: 'low',
          message: 'Low severity issue',
          location: { line: 40, column: 1 },
        },
        {
          ruleId: 'info-rule',
          severity: 'info',
          message: 'Informational issue',
          location: { line: 50, column: 1 },
        },
      ],
      score: 95,
      metadata: {
        scannedAt: new Date('2024-03-17T12:00:00Z'),
        scanDuration: 2000,
        aiAnalysis: true,
        aiProvider: 'openai',
      },
    }
  })

  afterEach(async () => {
    // Clean up temp files
    try {
      await unlink(join(tempDir, 'results.sarif'))
    } catch {
      // Ignore
    }
  })

  it('converts to SARIF 2.1.0 format', () => {
    const sarif = convertToSarif(mockResult, 'test.ts')

    // Verify SARIF structure
    expect(sarif.version).toBe('2.1.0')
    expect(sarif.$schema).toBe('https://json.schemastore.org/sarif-2.1.0.json')
    expect(sarif.runs).toBeInstanceOf(Array)
    expect(sarif.runs).toHaveLength(1)
  })

  it('maps severity to level', () => {
    const sarif = convertToSarif(mockResult, 'test.ts')
    const results = sarif.runs[0].results

    // Find results by ruleId
    const criticalResult = results.find(r => r.ruleId === 'critical-rule')
    const highResult = results.find(r => r.ruleId === 'high-rule')
    const mediumResult = results.find(r => r.ruleId === 'medium-rule')
    const lowResult = results.find(r => r.ruleId === 'low-rule')
    const infoResult = results.find(r => r.ruleId === 'info-rule')

    // Verify level mapping
    expect(criticalResult?.level).toBe('error')
    expect(highResult?.level).toBe('error')
    expect(mediumResult?.level).toBe('warning')
    expect(lowResult?.level).toBe('note')
    expect(infoResult?.level).toBe('note')
  })

  it('includes security-severity property', () => {
    const sarif = convertToSarif(mockResult, 'test.ts')
    const rules = sarif.runs[0].tool.driver.rules

    expect(rules).toBeDefined()
    expect(rules.length).toBeGreaterThan(0)

    // Check security-severity values
    const criticalRule = rules.find(r => r.id === 'critical-rule')
    const highRule = rules.find(r => r.id === 'high-rule')
    const mediumRule = rules.find(r => r.id === 'medium-rule')
    const lowRule = rules.find(r => r.id === 'low-rule')
    const infoRule = rules.find(r => r.id === 'info-rule')

    expect(criticalRule?.properties?.['security-severity']).toBe('9.0')
    expect(highRule?.properties?.['security-severity']).toBe('7.0')
    expect(mediumRule?.properties?.['security-severity']).toBe('5.0')
    expect(lowRule?.properties?.['security-severity']).toBe('3.0')
    expect(infoRule?.properties?.['security-severity']).toBe('1.0')
  })

  it('extracts unique rules from findings', () => {
    // Add duplicate ruleId
    mockResult.findings.push({
      ruleId: 'critical-rule',
      severity: 'critical',
      message: 'Another critical issue',
      location: { line: 60, column: 1 },
    })

    const sarif = convertToSarif(mockResult, 'test.ts')
    const rules = sarif.runs[0].tool.driver.rules

    // Should have unique rules only
    expect(rules.length).toBe(5) // critical, high, medium, low, info

    // Verify rule IDs are unique
    const ruleIds = rules.map(r => r.id)
    const uniqueRuleIds = new Set(ruleIds)
    expect(uniqueRuleIds.size).toBe(ruleIds.length)
  })

  it('includes artifact location in results', () => {
    const filename = 'test.ts'
    const sarif = convertToSarif(mockResult, filename)
    const results = sarif.runs[0].results

    expect(results.length).toBeGreaterThan(0)

    const firstResult = results[0]
    expect(firstResult.locations).toBeDefined()
    expect(firstResult.locations).toHaveLength(1)

    const location = firstResult.locations[0]
    expect(location.physicalLocation).toBeDefined()
    expect(location.physicalLocation.artifactLocation.uri).toBe(filename)
    expect(location.physicalLocation.region).toBeDefined()
    expect(location.physicalLocation.region.startLine).toBe(10)
  })

  it('exports SARIF to file', async () => {
    const outputPath = join(tempDir, 'results.sarif')
    const filename = 'test.ts'

    await exportSarif(mockResult, outputPath, filename)

    // Verify file exists
    const content = await readFile(outputPath, 'utf-8')
    expect(content).toBeTruthy()

    // Verify it's valid JSON
    const parsed = JSON.parse(content)
    expect(parsed.version).toBe('2.1.0')
  })
})
