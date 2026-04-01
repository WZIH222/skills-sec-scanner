/**
 * Main Scanner Orchestrator
 *
 * Orchestrates the complete scanning pipeline:
 * 1. Check cache
 * 2. Parse file
 * 3. Load rules
 * 4. Pattern match
 * 5. Data flow analysis
 * 6. Merge findings
 * 7. Calculate score
 * 8. Store result
 * 9. Cache result
 *
 * All dependencies are explicitly injected for testability.
 */

import { createHash, randomBytes } from 'crypto'
import type { IParser } from './parser'
import { RuleLoader } from './rules'
import { PatternMatcher } from './analyzer'
import { TaintTracker } from './analyzer'
import { RiskScorer } from './analyzer'
import { CacheService } from './storage'
import { ScanRepository } from './storage'
import type { ScanResult, Finding, IParseResult, ScanOptions, Location } from './types'
import { readFile } from 'fs/promises'

/**
 * Scanner dependencies interface
 * All dependencies are explicitly typed for constructor injection
 */
export interface ScannerDeps {
  parser: IParser
  ruleLoader: RuleLoader
  patternMatcher: PatternMatcher
  taintTracker: TaintTracker
  scorer: RiskScorer
  cache: CacheService
  repository: ScanRepository
  // NEW: Optional AI components (Phase 2)
  aiEngine?: import('./ai-engine').IAIEngine
  aiCache?: import('./ai-engine').AICacheService
  // NEW: Optional false positive filter (Phase 3)
  falsePositiveFilter?: import('./storage').FalsePositiveFilter
  // NEW: Optional policy enforcer (Phase 3.4)
  policyEnforcer?: import('./policy').PolicyEnforcer
}

/**
 * Main Scanner class
 *
 * Orchestrates the complete static analysis pipeline with explicit dependency injection
 */
export class Scanner {
  constructor(private deps: ScannerDeps) {}

  /**
   * Scan code content
   *
   * @param content - Source code to scan
   * @param filename - Optional filename for format detection
   * @param options - Scan options (rule filtering, AI enablement)
   * @returns Scan result with findings and score
   */
  async scan(content: string, filename?: string, options?: ScanOptions): Promise<ScanResult> {
    const startTime = Date.now()

    // Step 1: Compute content hash for cache lookup
    const contentHash = this.computeHash(content)

    // Step 2: Check cache
    const cached = await this.deps.cache.get(content)
    if (cached) {
      return cached
    }

    // Step 3: Parse file
    const parseResult = await this.parse(content, filename)

    // Step 4: Pattern match (use pre-loaded rules from PatternMatcher)
    // Handle parse errors gracefully
    let patternFindings: Finding[] = []
    let dataFlowFindings: Finding[] = []

    if (parseResult.ast) {
      try {
        // Use the pre-loaded PatternMatcher from dependencies
        patternFindings = this.deps.patternMatcher.findMatches(parseResult.ast as any)
        dataFlowFindings = this.deps.taintTracker.analyze(parseResult.ast as any)
      } catch (error) {
        console.error('Error during analysis:', error)
        // Continue with empty findings
      }
    }

    // Fallback: If patternFindings is empty, check if parser embedded findings in ast.metadata
    // This handles parsers like PythonParser that detect patterns but don't use TSESTree format
    if (patternFindings.length === 0 && parseResult.ast) {
      const ast = parseResult.ast as any

      // Handle PythonParser's dangerousPatterns format
      if (ast.metadata?.dangerousPatterns) {
        const dangerousPatterns = ast.metadata.dangerousPatterns
        patternFindings = dangerousPatterns.map((dp: any) => ({
          ruleId: `python-${dp.name}`,
          severity: dp.severity,
          message: dp.message,
          location: { line: dp.line, column: dp.column },
          code: dp.matchedText,
        }))
      }

      // Handle MarkdownParser's injection patterns format
      // Markdown stores injection patterns in ast.body nodes with isInjectionPattern: true
      if (patternFindings.length === 0 && ast.body && ast.metadata?.hasInjectionPatterns) {
        const injectionNodes = ast.body.filter((node: any) => node.isInjectionPattern)
        patternFindings = injectionNodes.map((node: any) => {
          // Map injection type to a readable rule ID
          const typeToRuleId: Record<string, string> = {
            instruction_override: 'md-instruction-override',
            system_override: 'md-system-override',
            role_assignment: 'md-role-assignment',
            memory_wipe: 'md-memory-wipe',
          }
          const ruleId = typeToRuleId[node.injectionType] || `md-${node.injectionType}`

          // Map injection type to severity (use default from patterns)
          const typeToSeverity: Record<string, string> = {
            instruction_override: 'critical',
            system_override: 'high',
            role_assignment: 'medium',
            memory_wipe: 'high',
          }
          const severity = typeToSeverity[node.injectionType] || 'medium'

          return {
            ruleId,
            severity,
            message: `Prompt injection pattern detected: ${node.injectionType}`,
            location: { line: node.line, column: 1 },
            code: node.content,
          }
        })
      }
    }

    // Step 7: Merge findings
    let findings = this.mergeFindings(patternFindings, dataFlowFindings)

    // Step 7.25: Filter false positives (if filter is available and userId is provided)
    if (this.deps.falsePositiveFilter && options?.userId) {
      try {
        // Load user exclusions from database
        await this.deps.falsePositiveFilter.loadExclusions(options.userId)

        // Calculate codeHash for each finding and filter out exclusions
        const filteredFindings: Finding[] = []
        for (const finding of findings) {
          const codeHash = this.computeHash(finding.code || '')
          const isExcluded = this.deps.falsePositiveFilter.isExcluded(
            options.userId,
            finding.ruleId,
            codeHash
          )

          if (isExcluded) {
            // Log excluded finding for audit trail
            console.log(`Excluded ${finding.ruleId} for user ${options.userId} - false positive (hash: ${codeHash})`)
          } else {
            filteredFindings.push(finding)
          }
        }

        findings = filteredFindings
      } catch (error) {
        console.warn('Failed to filter false positives, continuing with all findings:', error)
        // Continue with all findings if filtering fails
      }
    }

    // Step 7.5: AI Analysis
    let aiFindings: Finding[] = []
    let aiAnalyzed = false
    let aiProvider: string | undefined

    // AI trigger: run AI if enabled and AI engine is available
    // Note: For cost optimization in production, you may want to add conditional triggers
    // like checking if new rules detected or if it's a prompt-type skill
    const shouldRunAI = options?.aiEnabled && this.deps.aiEngine

    if (shouldRunAI) {
      try {
        const isAvailable = await this.deps.aiEngine!.isAvailable()
        if (isAvailable) {
          // Check AI cache first
          let aiResult: import('./ai-engine').AIAnalysisResult | null = null
          if (this.deps.aiCache) {
            aiResult = await this.deps.aiCache.getAIAnalysis(content)
          }

          if (aiResult) {
            // Use cached AI result
            const defaultLocation = { line: 1, column: 1 }
            const firstFinding = findings[0]
            aiFindings = aiResult.findings.map((f: any) => ({
              ruleId: f.ruleId,
              severity: f.severity,
              message: f.message,
              location: firstFinding?.location || defaultLocation,
              code: firstFinding?.code,
              explanation: f.explanation,
              confidence: f.confidence,
              aiAnalyzed: true,
            }))
            aiAnalyzed = true
            aiProvider = 'cached'
          } else {
            // Perform AI analysis
            const result = await this.deps.aiEngine!.analyzeCode({
              code: content,
              filename,
              findings,
            })

            if (result) {
              const defaultLocation = { line: 1, column: 1 }
              const firstFinding = findings[0]
              aiFindings = result.findings.map((f: any) => ({
                ruleId: f.ruleId,
                severity: f.severity,
                message: f.message,
                location: firstFinding?.location || defaultLocation,
                code: firstFinding?.code,
                explanation: f.explanation,
                confidence: f.confidence,
                aiAnalyzed: true,
              }))
              aiAnalyzed = true
              aiProvider = 'ai-engine'

              // Cache the result
              if (this.deps.aiCache) {
                await this.deps.aiCache.setAIAnalysis(content, result)
              }
            }
          }

          // Prompt injection detection is handled by analyzeCode above
        } else {
          console.warn('AI analysis unavailable, using static-only')
        }
      } catch (error) {
        console.warn('AI analysis failed, falling back to static-only:', error)
        // Continue with static findings only
      }
    }

    // Step 8: Merge AI findings with static findings
    const mergedFindings = this.mergeFindings(findings, aiFindings)

    // Step 9: Deduplicate findings
    const deduplicatedFindings = this.deduplicateFindings(mergedFindings)

    // Step 10: Calculate score
    const score = await this.deps.scorer.calculateScore(deduplicatedFindings)

    // Step 10.5: Apply policy enforcement if policyEnforcer available and policyMode provided
    // IMPORTANT: This happens AFTER false positive filtering (execution order matters)
    let policyResult: import('./policy').PolicyResult | undefined
    if (this.deps.policyEnforcer && options?.policyMode) {
      try {
        policyResult = this.deps.policyEnforcer.enforce(deduplicatedFindings, score, options.policyMode)
        console.info(`[Scanner] Policy enforcement: ${policyResult.mode} - ${policyResult.blockDecision}`)
      } catch (error) {
        console.warn('[Scanner] Policy enforcement failed, continuing without enforcement:', error)
        // Continue without policy enforcement if it fails
      }
    }

    // Step 11: Build ScanResult with AI metadata
    const result: ScanResult = {
      findings: deduplicatedFindings,
      score,
      metadata: {
        scannedAt: new Date(),
        scanDuration: Date.now() - startTime,
        aiAnalysis: aiAnalyzed, // NEW: Track AI usage
        ...(aiProvider && { aiProvider }), // NEW: Track which provider was used (only if defined)
        ...(options?.userId && { userId: options.userId }), // Include userId for authorization
      },
      ...(policyResult && { policyResult }), // Include policyResult if enforcement was applied
    }

    // Step 12: Generate fileId and add to result
    const fileId = randomBytes(16).toString('hex')
    result.fileId = fileId

    // Step 13: Store result (skip if requested for folder child files)
    if (!options?.skipStorage) {
      try {
        await this.deps.repository.create({
          fileId,
          contentHash,
          filename: filename || 'unknown',
          result,
        })
      } catch (error) {
        console.error('Failed to store scan result:', error)
        // Continue even if storage fails
      }
    }

    // Step 14: Cache result
    await this.deps.cache.set(content, result)

    return result
  }

  /**
   * Scan a file from disk
   *
   * @param filePath - Path to the file
   * @param options - Scan options
   * @returns Scan result
   */
  async scanFile(filePath: string, options?: ScanOptions): Promise<ScanResult> {
    const content = await readFile(filePath, 'utf-8')
    const filename = filePath.split(/[/\\]/).pop() || filePath
    return this.scan(content, filename, options)
  }

  /**
   * Parse code only (no analysis)
   *
   * @param content - Source code
   * @param filename - Optional filename
   * @returns Parse result
   */
  async parse(content: string, filename?: string): Promise<IParseResult> {
    return this.deps.parser.parse(content, filename)
  }

  /**
   * Analyze parsed code (no parsing, no scoring)
   *
   * @param parseResult - Result from parsing
   * @param options - Scan options
   * @returns Array of findings
   */
  async analyze(parseResult: IParseResult, options?: ScanOptions): Promise<Finding[]> {
    // Get rules from PatternMatcher (already loaded during scanner creation)
    // Use the pre-loaded rules instead of loading again
    const patternFindings = this.deps.patternMatcher.findMatches(parseResult.ast as any)

    // Data flow analysis
    const dataFlowFindings = this.deps.taintTracker.analyze(parseResult.ast as any)

    // Merge and deduplicate
    const merged = this.mergeFindings(patternFindings, dataFlowFindings)
    return this.deduplicateFindings(merged)
  }

  /**
   * Merge findings from multiple sources
   */
  private mergeFindings(...findingArrays: Finding[][]): Finding[] {
    return findingArrays.flat()
  }

  /**
   * Deduplicate findings by location and rule ID
   */
  private deduplicateFindings(findings: Finding[]): Finding[] {
    const seen = new Set<string>()
    const deduplicated: Finding[] = []

    for (const finding of findings) {
      const key = `${finding.location.line}:${finding.location.column}:${finding.ruleId}`
      if (!seen.has(key)) {
        seen.add(key)
        deduplicated.push(finding)
      }
    }

    return deduplicated
  }

  /**
   * Compute SHA-256 hash of content
   */
  private computeHash(content: string): string {
    return createHash('sha256').update(content).digest('hex')
  }
}
