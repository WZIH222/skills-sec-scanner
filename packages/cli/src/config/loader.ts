/**
 * Config File Loader
 *
 * Loads configuration from .skills-sec.yaml file.
 * Config file is optional - returns empty object if not found.
 */

import { readFile } from 'fs/promises'
import yaml from 'js-yaml'
import { z } from 'zod'
import { join } from 'path'

export interface CliConfig {
  aiEnabled?: boolean
  aiProvider?: 'openai' | 'anthropic'
  policyMode?: 'strict' | 'moderate' | 'permissive'
}

const CliConfigSchema = z.object({
  aiEnabled: z.boolean().optional(),
  aiProvider: z.enum(['openai', 'anthropic']).optional(),
  policyMode: z.enum(['strict', 'moderate', 'permissive']).optional(),
})

/**
 * Load config from .skills-sec.yaml file
 *
 * @param cwd - Current working directory (defaults to process.cwd())
 * @returns Parsed config object or empty object if file doesn't exist
 */
export async function loadConfig(cwd?: string): Promise<CliConfig> {
  const configPath = join(cwd || process.cwd(), '.skills-sec.yaml')

  try {
    const content = await readFile(configPath, 'utf-8')
    const config = yaml.load(content) as CliConfig

    // CONFIG-01: Validate config with Zod
    try {
      CliConfigSchema.parse(config)
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new Error(
          `Invalid CLI config: ${err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        )
      }
      throw err
    }

    return config || {}
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      // Config file is optional
      return {}
    }
    throw new Error(`Invalid config file: ${(error as any).message}`)
  }
}
