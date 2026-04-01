/**
 * Parser module exports
 *
 * Provides unified interface for parsing different file formats
 */

export { TypeScriptParser, ParserOptions, type IParser } from './typescript-parser'
export { JSONParser } from './json-parser'
export { MarkdownParser } from './markdown-parser'
export { PythonParser } from './python-parser'
import { TypeScriptParser } from './typescript-parser'
import { JSONParser } from './json-parser'
import { MarkdownParser } from './markdown-parser'
import { PythonParser } from './python-parser'
import { type IParser } from './typescript-parser'

/**
 * Available parsers - ordered by specificity
 * TypeScript/JS must come before Python to handle .js correctly
 */
const parsers: IParser[] = [
  new TypeScriptParser(),
  new JSONParser(),
  new MarkdownParser(),
  new PythonParser(),
]

/**
 * Create appropriate parser for the given filename
 *
 * @param filename - File to parse
 * @returns Parser instance or null if no parser supports the file
 */
export function createParser(filename: string): IParser | null {
  for (const parser of parsers) {
    if (parser.supports(filename)) {
      return parser
    }
  }
  return null
}
