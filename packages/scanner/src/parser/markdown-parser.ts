/**
 * Markdown Parser for AI Skills Files
 *
 * Parses Markdown files to detect prompt injection threats and extract
 * code blocks for separate analysis. Markdown is a primary threat vector
 * for AI Skills since instructions can be hidden in documentation.
 */

import { IParseResult, ParseMetadata, ParseError } from '../types'
import { IParser } from './typescript-parser'

/**
 * Prompt injection patterns commonly found in malicious Markdown files
 */
const INJECTION_PATTERNS = [
  {
    pattern: /ignore\s+previous\s+instructions?/gi,
    type: 'instruction_override',
    severity: 'critical',
  },
  {
    pattern: /disregard\s+all\s+(previous\s+)?(instructions?|rules?|guidelines?)/gi,
    type: 'instruction_override',
    severity: 'critical',
  },
  {
    pattern: /ignore\s+all\s+(previous\s+)?(instructions?|rules?|guidelines?)/gi,
    type: 'instruction_override',
    severity: 'critical',
  },
  {
    pattern: /override\s+system\s+(prompt|instruction|settings?)/gi,
    type: 'system_override',
    severity: 'high',
  },
  {
    pattern: /you\s+are\s+now\s+(a\s+)?/gi,
    type: 'role_assignment',
    severity: 'medium',
  },
  {
    pattern: /forget\s+(everything|all|previous)/gi,
    type: 'memory_wipe',
    severity: 'high',
  },
  {
    pattern: /new\s+system\s+prompt/gi,
    type: 'system_override',
    severity: 'medium',
  },
  {
    pattern: /ignore\s+(all\s+)?(prior|previous|earlier)/gi,
    type: 'instruction_override',
    severity: 'high',
  },
  {
    pattern: /act\s+as\s+(if\s+you\s+were|a|an)/gi,
    type: 'role_assignment',
    severity: 'low',
  },
  {
    pattern: /pretend\s+(you\s+are|to\s+be|that\s+you)/gi,
    type: 'role_assignment',
    severity: 'low',
  },
]

/**
 * Represents a node in the Markdown AST-like structure
 */
interface MarkdownNode {
  type: 'heading' | 'paragraph' | 'code_block' | 'list' | 'list_item' | 'blockquote' | 'table' | 'link' | 'image' | 'html' | 'thematic_break'
  content: string
  line: number
  language?: string // For code blocks
  children?: MarkdownNode[]
  isInjectionPattern?: boolean
  injectionType?: string
}

/**
 * Markdown parser for security analysis
 *
 * Detects prompt injection patterns and extracts code blocks
 * for separate security analysis.
 */
export class MarkdownParser implements IParser {
  /**
   * Check if this parser supports the given file
   */
  supports(filename: string): boolean {
    return /\.(md|markdown)$/i.test(filename)
  }

  /**
   * Parse Markdown content for security analysis
   *
   * @param content - Markdown content to parse
   * @param filename - Optional filename for context
   * @returns Parse result with AST-like structure and injection detection
   */
  async parse(content: string, filename?: string): Promise<IParseResult> {
    const errors: ParseError[] = []
    const dependencies: string[] = []

    try {
      const lines = content.split('\n')
      const nodes: MarkdownNode[] = []
      const codeBlocks: string[] = []
      let hasInjectionPatterns = false
      const injectionTypes: string[] = []

      let currentNode: MarkdownNode | null = null
      let inCodeBlock = false
      let codeBlockLanguage = ''
      let codeBlockContent = ''
      let codeBlockStartLine = 0

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lineNumber = i + 1

        // Check for code block delimiters
        if (/^```/.test(line)) {
          if (!inCodeBlock) {
            // Starting a code block
            inCodeBlock = true
            codeBlockStartLine = lineNumber
            codeBlockLanguage = line.slice(3).trim().toLowerCase()
            codeBlockContent = ''
          } else {
            // Ending a code block
            inCodeBlock = false
            codeBlocks.push(codeBlockContent)
            nodes.push({
              type: 'code_block',
              content: codeBlockContent,
              line: codeBlockStartLine,
              language: codeBlockLanguage,
            })
            codeBlockContent = ''
            codeBlockLanguage = ''
          }
          continue
        }

        if (inCodeBlock) {
          codeBlockContent += line + '\n'
          continue
        }

        // Check for injection patterns in regular content
        for (const { pattern, type, severity } of INJECTION_PATTERNS) {
          if (pattern.test(line)) {
            hasInjectionPatterns = true
            if (!injectionTypes.includes(type)) {
              injectionTypes.push(type)
            }
            // Create a node marking the injection
            nodes.push({
              type: 'paragraph',
              content: line,
              line: lineNumber,
              isInjectionPattern: true,
              injectionType: type,
            })
            break
          }
        }

        // Parse regular Markdown elements
        if (/^#+ /.test(line)) {
          // Heading
          nodes.push({
            type: 'heading',
            content: line.replace(/^#+\s*/, ''),
            line: lineNumber,
          })
        } else if (/^(-|\*|\d+\.)\s/.test(line)) {
          // List item
          if (!currentNode || currentNode.type !== 'list') {
            currentNode = {
              type: 'list',
              content: '',
              line: lineNumber,
              children: [],
            }
            nodes.push(currentNode)
          }
          currentNode.children!.push({
            type: 'list_item',
            content: line.replace(/^(-|\*|\d+\.)\s*/, ''),
            line: lineNumber,
          })
        } else if (/^>/.test(line)) {
          // Blockquote
          nodes.push({
            type: 'blockquote',
            content: line.replace(/^>\s*/, ''),
            line: lineNumber,
          })
        } else if (/^\|/.test(line)) {
          // Table row
          nodes.push({
            type: 'table',
            content: line,
            line: lineNumber,
          })
        } else if (/^```|^~~~/.test(line)) {
          // Already handled above
          continue
        } else if (/^<!DOCTYPE|^<html|^<\?xml/.test(line)) {
          // HTML-like content
          nodes.push({
            type: 'html',
            content: line,
            line: lineNumber,
          })
        } else if (/^---$|^___\s*$/.test(line)) {
          // Thematic break
          nodes.push({
            type: 'thematic_break',
            content: line,
            line: lineNumber,
          })
        } else if (/^\[.+\]\(.+\)/.test(line)) {
          // Link
          nodes.push({
            type: 'link',
            content: line,
            line: lineNumber,
          })
        } else if (/^!\[.+\]\(.+\)/.test(line)) {
          // Image
          nodes.push({
            type: 'image',
            content: line,
            line: lineNumber,
          })
        } else if (line.trim()) {
          // Paragraph
          nodes.push({
            type: 'paragraph',
            content: line,
            line: lineNumber,
          })
        }
      }

      // Handle unclosed code block
      if (inCodeBlock) {
        codeBlocks.push(codeBlockContent)
        nodes.push({
          type: 'code_block',
          content: codeBlockContent,
          line: codeBlockStartLine,
          language: codeBlockLanguage,
        })
      }

      const metadata: ParseMetadata = {
        language: 'markdown',
        format: 'markdown',
      }

      // Extend metadata with injection info
      const extendedMetadata = {
        ...metadata,
        hasInjectionPatterns,
        injectionTypes,
        codeBlocks,
      } as ParseMetadata & {
        hasInjectionPatterns: boolean
        injectionTypes: string[]
        codeBlocks: string[]
      }

      return {
        ast: {
          type: 'MarkdownProgram',
          body: nodes,
          metadata: {
            hasInjectionPatterns,
            injectionTypes,
            codeBlockCount: codeBlocks.length,
            totalLines: lines.length,
          },
        },
        metadata: extendedMetadata,
        errors,
        dependencies,
      }
    } catch (error) {
      const parseError: ParseError = {
        message: error instanceof Error ? error.message : 'Failed to parse Markdown',
      }
      errors.push(parseError)

      return {
        ast: null,
        metadata: {
          language: 'markdown',
        },
        errors,
        dependencies: [],
      }
    }
  }
}
