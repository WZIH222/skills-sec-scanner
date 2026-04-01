/**
 * Python Parser for AI Skills Files
 *
 * Parses Python files to detect code execution risks including:
 * - os.system() and subprocess calls
 * - eval() and exec() usage
 * - pickle deserialization
 * - File I/O with user-controlled paths
 * - Network requests via urllib/requests
 */

import { IParseResult, ParseMetadata, ParseError } from '../types'
import { IParser } from './typescript-parser'

/**
 * Dangerous pattern definitions with severity levels
 */
const DANGEROUS_PATTERNS = [
  {
    name: 'os.system',
    pattern: /os\.system\s*\(/g,
    type: 'code_execution',
    severity: 'critical',
    message: 'os.system() can execute arbitrary shell commands',
  },
  {
    name: 'subprocess.call',
    pattern: /subprocess\.(call|run|Popen)\s*\(/g,
    type: 'code_execution',
    severity: 'critical',
    message: 'subprocess calls can execute arbitrary commands',
  },
  {
    name: 'eval',
    pattern: /\beval\s*\(/g,
    type: 'code_execution',
    severity: 'critical',
    message: 'eval() executes arbitrary Python code from strings',
  },
  {
    name: 'exec',
    pattern: /\bexec\s*\(/g,
    type: 'code_execution',
    severity: 'critical',
    message: 'exec() can execute arbitrary Python code',
  },
  {
    name: 'pickle.loads',
    pattern: /pickle\.loads?\s*\(/g,
    type: 'deserialization',
    severity: 'high',
    message: 'pickle.loads() can deserialize malicious data',
  },
  {
    name: 'open_user_path',
    pattern: /open\s*\([^)]*\)/g,
    type: 'file_access',
    severity: 'medium',
    message: 'File open with potentially user-controlled path',
  },
  {
    name: 'urllib_request',
    pattern: /(urllib\.request|requests\.(get|post|put|delete|patch)|http\.client\.(HTTPConnection|HTTPSConnection))\s*\(/g,
    type: 'network',
    severity: 'medium',
    message: 'Network request can exfiltrate data or download malicious content',
  },
  {
    name: 'eval_input',
    pattern: /input\s*\(/g,
    type: 'user_input',
    severity: 'low',
    message: 'input() can be used to inject code via user interaction',
  },
  {
    name: 'exec_globals',
    pattern: /exec\s*\([^,]+,\s*\{/g,
    type: 'code_execution',
    severity: 'critical',
    message: 'exec with globals dict can modify builtins and execute code',
  },
  {
    name: 'compile_exec',
    pattern: /compile\s*\([^)]+\)\s*;?\s*exec\s*\(/g,
    type: 'code_execution',
    severity: 'critical',
    message: 'compile followed by exec can execute arbitrary code',
  },
  {
    name: 'subprocess_shell',
    pattern: /subprocess\.(call|run|Popen)\s*\([^)]*shell\s*=\s*True/g,
    type: 'code_execution',
    severity: 'critical',
    message: 'subprocess with shell=True is a command injection risk',
  },
  {
    name: 'os_popen',
    pattern: /os\.popen\s*\(/g,
    type: 'code_execution',
    severity: 'high',
    message: 'os.popen() executes shell commands',
  },
  {
    name: 'osspawn',
    pattern: /os\.spawnl?|os\.exec/g,
    type: 'code_execution',
    severity: 'high',
    message: 'os spawn functions execute external programs',
  },
  {
    name: '__import__',
    pattern: /__import__\s*\(/g,
    type: 'code_execution',
    severity: 'medium',
    message: '__import__ can import arbitrary modules including code execution',
  },
  {
    name: 'importlib',
    pattern: /importlib\.load_module|importlib\.import_module\s*\(/g,
    type: 'code_execution',
    severity: 'medium',
    message: 'Dynamic module loading can execute arbitrary code',
  },
]

/**
 * Represents a dangerous pattern match
 */
interface DangerousPatternMatch {
  name: string
  line: number
  column: number
  matchedText: string
  type: string
  severity: string
  message: string
}

/**
 * Python parser for security analysis
 *
 * Detects dangerous patterns using regex-based analysis.
 * For more complex analysis, an AST-based approach could be added
 * using a library like `python-estree` or `ast` module.
 */
export class PythonParser implements IParser {
  /**
   * Check if this parser supports the given file
   */
  supports(filename: string): boolean {
    return filename.endsWith('.py')
  }

  /**
   * Parse Python content for security analysis
   *
   * @param content - Python code to parse
   * @param filename - Optional filename for context
   * @returns Parse result with AST-like structure and dangerous pattern detection
   */
  async parse(content: string, filename?: string): Promise<IParseResult> {
    const errors: ParseError[] = []
    const dependencies: string[] = []

    try {
      const lines = content.split('\n')
      const body: any[] = []
      const dangerousPatterns: DangerousPatternMatch[] = []
      let hasDangerousPatterns = false

      // Extract imports for dependency tracking
      const imports = this.extractImports(content)
      dependencies.push(...imports)

      // Process each line for dangerous patterns
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lineNumber = i + 1

        // Check each dangerous pattern
        for (const dp of DANGEROUS_PATTERNS) {
          // Reset lastIndex for global patterns
          dp.pattern.lastIndex = 0

          let match
          while ((match = dp.pattern.exec(line)) !== null) {
            hasDangerousPatterns = true
            dangerousPatterns.push({
              name: dp.name,
              line: lineNumber,
              column: match.index,
              matchedText: match[0],
              type: dp.type,
              severity: dp.severity,
              message: dp.message,
            })
          }
        }

        // Create AST-like node for this line
        if (line.trim() && !line.trim().startsWith('#')) {
          const expressionType = this.classifyLine(line)
          body.push({
            type: 'Expression',
            expressionType,
            line: lineNumber,
            code: line,
            hasDangerousPattern: dangerousPatterns.some(p => p.line === lineNumber),
          })
        }
      }

      // Calculate severity summary
      const severityCounts = {
        critical: dangerousPatterns.filter(p => p.severity === 'critical').length,
        high: dangerousPatterns.filter(p => p.severity === 'high').length,
        medium: dangerousPatterns.filter(p => p.severity === 'medium').length,
        low: dangerousPatterns.filter(p => p.severity === 'low').length,
      }

      const metadata: ParseMetadata = {
        language: 'python',
        format: 'python',
      }

      // Extend metadata with danger info
      const extendedMetadata = {
        ...metadata,
        hasDangerousPatterns,
        dangerousPatternCount: dangerousPatterns.length,
        severityCounts,
        patternNames: [...new Set(dangerousPatterns.map(p => p.name))],
      } as ParseMetadata & {
        hasDangerousPatterns: boolean
        dangerousPatternCount: number
        severityCounts: typeof severityCounts
        patternNames: string[]
      }

      return {
        ast: {
          type: 'PythonProgram',
          body,
          metadata: {
            hasDangerousPatterns,
            dangerousPatterns,
            severityCounts,
            totalLines: lines.length,
            importCount: imports.length,
          },
        },
        metadata: extendedMetadata,
        errors,
        dependencies,
      }
    } catch (error) {
      const parseError: ParseError = {
        message: error instanceof Error ? error.message : 'Failed to parse Python',
      }
      errors.push(parseError)

      return {
        ast: null,
        metadata: {
          language: 'python',
        },
        errors,
        dependencies: [],
      }
    }
  }

  /**
   * Extract import statements from Python code
   */
  private extractImports(content: string): string[] {
    const imports = new Set<string>()
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()

      // Standard import: import x, import x as y, from x import y
      if (/^import\s+/.test(trimmed)) {
        const match = trimmed.match(/^import\s+([\w,\s]+)/)
        if (match) {
          match[1].split(',').forEach(m => {
            const module = m.trim().split(/\s+/)[0]
            if (module) imports.add(module)
          })
        }
      }

      // From import: from x import y
      if (/^from\s+/.test(trimmed)) {
        const match = trimmed.match(/^from\s+([\w.]+)\s+import/)
        if (match && match[1]) {
          imports.add(match[1])
        }
      }
    }

    return Array.from(imports)
  }

  /**
   * Classify a line of Python code
   */
  private classifyLine(line: string): string {
    const trimmed = line.trim()

    if (/^(def|class|async\s+def)\s+/.test(trimmed)) return 'definition'
    if (/^(if|elif|else)\s+/.test(trimmed)) return 'conditional'
    if (/^(for|while)\s+/.test(trimmed)) return 'loop'
    if (/^(try|except|finally|with)\s+/.test(trimmed)) return 'block'
    if (/^(return|yield|raise)\s+/.test(trimmed)) return 'statement'
    if (/^@/.test(trimmed)) return 'decorator'
    if (/^#/.test(trimmed)) return 'comment'
    if (/^"""|'''/.test(trimmed)) return 'docstring'
    if (/^import\s+|^from\s+/.test(trimmed)) return 'import'
    if (/=/.test(trimmed) && !/==|!=|>=|<=|=>|=<|->/.test(trimmed)) return 'assignment'

    return 'expression'
  }
}
