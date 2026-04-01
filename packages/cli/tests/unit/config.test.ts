/**
 * Unit tests for config loading
 *
 * Tests verify:
 * - loadConfig returns empty object when .skills-sec.yaml doesn't exist
 * - loadConfig parses YAML file when exists
 * - loadConfig throws friendly error for invalid YAML
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFile } from 'fs/promises'
import { loadConfig } from '../../src/config/loader.js'

vi.mock('fs/promises')

describe('Config Loader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return empty object when .skills-sec.yaml doesn\'t exist', async () => {
    const error = new Error('File not found') as any
    error.code = 'ENOENT'
    vi.mocked(readFile).mockRejectedValue(error)

    const config = await loadConfig()
    expect(config).toEqual({})
  })

  it('should parse YAML file when exists', async () => {
    const yamlContent = `
aiEnabled: true
aiProvider: openai
policyMode: strict
`
    vi.mocked(readFile).mockResolvedValue(yamlContent)

    const config = await loadConfig()
    expect(config.aiEnabled).toBe(true)
    expect(config.aiProvider).toBe('openai')
    expect(config.policyMode).toBe('strict')
  })

  it('should throw friendly error for invalid YAML', async () => {
    vi.mocked(readFile).mockResolvedValue('invalid: yaml: content: [')

    await expect(loadConfig()).rejects.toThrow('Invalid config file')
  })
})
