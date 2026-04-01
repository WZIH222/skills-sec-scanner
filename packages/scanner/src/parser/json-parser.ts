/**
 * JSON Skill Format Parser
 *
 * Parses JSON-based skill files including OpenAI GPTs, Claude tool schemas,
 * and other skill configuration formats.
 */

import { IParseResult, ParseMetadata } from '../types'
import { IParser } from './typescript-parser'

/**
 * Supported JSON skill formats
 */
type SkillFormat = 'openai-gpt' | 'claude-tool' | 'skill-config' | 'unknown'

/**
 * JSON skill file parser
 *
 * Detects format type and creates AST-like structure for JSON skill files
 */
export class JSONParser implements IParser {
  /**
   * Check if this parser supports the given file
   */
  supports(filename: string): boolean {
    return filename.endsWith('.json')
  }

  /**
   * Parse JSON skill file
   *
   * @param content - JSON content to parse
   * @param filename - Optional filename
   * @returns Parse result with AST-like structure
   */
  async parse(content: string, filename?: string): Promise<IParseResult> {
    const errors: any[] = []

    try {
      const parsed = JSON.parse(content)
      const format = this.detectFormat(parsed)

      // Create AST-like structure for JSON
      const ast = this.createASTLikeStructure(parsed, format)

      const metadata: ParseMetadata = {
        language: 'json',
        format,
      }

      return {
        ast,
        metadata,
        errors,
        dependencies: [], // JSON files don't have dependencies in the traditional sense
      }
    } catch (error) {
      // Handle parse errors
      const parseError = {
        message: error instanceof Error ? error.message : 'Invalid JSON',
      }

      errors.push(parseError)

      return {
        ast: null,
        metadata: {
          language: 'json',
        },
        errors,
        dependencies: [],
      }
    }
  }

  /**
   * Detect the format type from JSON structure
   */
  private detectFormat(parsed: any): SkillFormat {
    // OpenAI GPTs format
    if (parsed.actions && Array.isArray(parsed.actions)) {
      return 'openai-gpt'
    }

    // Claude tool schema
    if (parsed.tool && typeof parsed.tool === 'object') {
      return 'claude-tool'
    }

    // Generic skill config
    if (parsed.name && parsed.description) {
      return 'skill-config'
    }

    return 'unknown'
  }

  /**
   * Create AST-like structure for JSON content
   *
   * This creates a structure similar to ESTree for consistency
   * in the analysis pipeline.
   */
  private createASTLikeStructure(parsed: any, format: SkillFormat): any {
    return {
      type: 'Program',
      body: [
        {
          type: 'SkillMetadata',
          properties: parsed,
          format,
        },
      ],
    }
  }
}
