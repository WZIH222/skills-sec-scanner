/**
 * Taint Tracker for Data Flow Analysis
 *
 * Tracks sensitive data (user input, parameters) through the code
 * to detect when it reaches dangerous sinks (eval, fetch, fs operations, etc.)
 */

import { TSESTree } from '@typescript-eslint/typescript-estree'
import { Finding, Severity } from '../types'

/**
 * Safe paths allowlist - common config files that are safe to read
 */
const SAFE_PATHS = [
  'package.json',
  './package.json',
  './config.json',
  '.env',
  './.env',
  './credentials'
]

/**
 * Taint source - represents where sensitive data enters the system
 */
interface TaintSource {
  node: TSESTree.Node
  type: 'parameter' | 'env' | 'file-read' | 'dom-source'
  name: string
  functionName?: string
  filePath?: string  // For file-read sources
}

/**
 * Taint sink - represents dangerous operations that should not receive tainted data
 */
interface TaintSink {
  node: TSESTree.Node
  type: 'code-execution' | 'network' | 'file-access' | 'command-injection'
  name: string
  severity: Severity
}

/**
 * Flow graph - tracks variable dependencies
 * Maps variable name -> Set of variables it depends on (that are potentially tainted)
 */
type FlowGraph = Map<string, Set<string>>

/**
 * Safe variables - variables assigned from safe path.join() calls
 * Maps variable name -> true if safe
 */
type SafeVariables = Map<string, boolean>

/**
 * Taint Tracker
 *
 * Performs data flow analysis to detect when user input reaches dangerous sinks
 */
export class TaintTracker {
  /**
   * Analyze AST for taint flows
   *
   * @param ast - The AST to analyze
   * @returns Array of findings
   */
  analyze(ast: TSESTree.Program): Finding[] {
    const findings: Finding[] = []

    // Step 1: Find taint sources (function parameters)
    const sources = this.findTaintSources(ast)

    if (sources.length === 0) {
      return findings
    }

    // Step 1.5: Find safe variables (from path.join with safe built-ins)
    const safeVariables = this.findSafeVariables(ast)

    // Step 2: Find dangerous sinks
    const sinks = this.findDangerousSinks(ast, safeVariables)

    if (sinks.length === 0) {
      return findings
    }

    // Step 3: Build flow graph
    const graph = this.buildFlowGraph(ast, sources)

    // Step 4: Check if any source reaches any sink
    for (const source of sources) {
      for (const sink of sinks) {
        if (this.reachesSink(source, sink, graph)) {
          findings.push({
            ruleId: 'taint-data-flow',
            severity: sink.severity,
            message: this.createTaintMessage(source, sink),
            location: this.extractLocation(sink.node),
          })
        }
      }
    }

    return findings
  }

  /**
   * Step 1: Find taint sources (function parameters, env vars, file reads, DOM sources)
   */
  private findTaintSources(ast: TSESTree.Program): TaintSource[] {
    const sources: TaintSource[] = []

    this.traverse(ast, (node) => {
      // Find function declarations
      if (node.type === 'FunctionDeclaration') {
        const func = node as TSESTree.FunctionDeclaration
        if (func.params && func.id) {
          for (let i = 0; i < func.params.length; i++) {
            const param = func.params[i]
            if (param.type === 'Identifier') {
              // Skip callback parameters (error-first callbacks)
              if (this.isCallbackParameter(param, func, i)) {
                // This is a callback parameter like 'err', don't mark as taint source
                continue
              }
              sources.push({
                node: param,
                type: 'parameter',
                name: param.name,
                functionName: func.id.name,
              })
            }
          }
        }
      }

      // Find arrow function expressions
      if (node.type === 'ArrowFunctionExpression') {
        const arrowFunc = node as TSESTree.ArrowFunctionExpression
        if (arrowFunc.params) {
          for (let i = 0; i < arrowFunc.params.length; i++) {
            const param = arrowFunc.params[i]
            if (param.type === 'Identifier') {
              // Skip callback parameters (error-first callbacks)
              if (this.isCallbackParameter(param, arrowFunc, i)) {
                // This is a callback parameter like 'err', don't mark as taint source
                continue
              }
              sources.push({
                node: param,
                type: 'parameter',
                name: param.name,
                functionName: '(anonymous)',
              })
            }
          }
        }
      }

      // Find function expressions
      if (node.type === 'FunctionExpression') {
        const funcExpr = node as TSESTree.FunctionExpression
        if (funcExpr.params) {
          for (let i = 0; i < funcExpr.params.length; i++) {
            const param = funcExpr.params[i]
            if (param.type === 'Identifier') {
              // Skip callback parameters (error-first callbacks)
              if (this.isCallbackParameter(param, funcExpr, i)) {
                // This is a callback parameter like 'err', don't mark as taint source
                continue
              }
              sources.push({
                node: param,
                type: 'parameter',
                name: param.name,
                functionName: funcExpr.id?.name || '(anonymous)',
              })
            }
          }
        }
      }

      // Find process.env access (environment variables)
      if (node.type === 'MemberExpression') {
        const member = node as TSESTree.MemberExpression

        if (member.object.type === 'Identifier' &&
            member.object.name === 'process' &&
            member.property.type === 'Identifier' &&
            member.property.name === 'env') {
          sources.push({
            node: member,
            type: 'env',
            name: 'process.env'
          })
        }

        // Also detect specific env access like process.env.API_KEY
        // Check if this is a nested member expression (process.env.XXX)
        if (member.object.type === 'MemberExpression') {
          const innerMember = member.object as TSESTree.MemberExpression
          if (innerMember.object.type === 'Identifier' &&
              innerMember.object.name === 'process' &&
              innerMember.property.type === 'Identifier' &&
              innerMember.property.name === 'env' &&
              member.property.type === 'Identifier') {
            sources.push({
              node: member,
              type: 'env',
              name: `process.env.${(member.property as TSESTree.Identifier).name}`
            })
          }
        }
      }

      // Find fs.readFile from sensitive paths (file-read sources)
      if (node.type === 'CallExpression') {
        const call = node as TSESTree.CallExpression

        if (call.callee.type === 'MemberExpression') {
          const member = call.callee as TSESTree.MemberExpression

          if (member.object.type === 'Identifier' &&
              member.object.name === 'fs' &&
              member.property.type === 'Identifier') {
            const propName = member.property.name

            if (propName === 'readFile' || propName === 'readFileSync') {
              // Check if first argument is a sensitive path
              const firstArg = call.arguments[0]
              if (firstArg && firstArg.type === 'Literal') {
                const path = (firstArg as TSESTree.Literal).value as string
                const sensitivePaths = ['./config', './secrets', '.env', './credentials']

                if (sensitivePaths.some(sp => path.includes(sp))) {
                  sources.push({
                    node: call,
                    type: 'file-read',
                    name: `fs.${propName}`,
                    filePath: path
                  })
                }
              }
            }
          }
        }
      }

      // Find DOM XSS sources (location.search, location.hash, document.URL, document.cookie)
      if (node.type === 'MemberExpression') {
        const member = node as TSESTree.MemberExpression

        // location.search, location.hash
        if (member.object.type === 'Identifier' &&
            member.object.name === 'location' &&
            member.property.type === 'Identifier') {
          const propName = member.property.name
          if (propName === 'search' || propName === 'hash') {
            sources.push({
              node: member,
              type: 'dom-source',
              name: `location.${propName}`
            })
          }
        }

        // document.URL, document.cookie
        if (member.object.type === 'Identifier' &&
            member.object.name === 'document' &&
            member.property.type === 'Identifier') {
          const propName = member.property.name
          if (propName === 'URL' || propName === 'cookie') {
            sources.push({
              node: member,
              type: 'dom-source',
              name: `document.${propName}`
            })
          }
        }
      }
    })

    return sources
  }

  /**
   * Step 1.5: Find safe variables (from path.join with safe built-ins)
   */
  private findSafeVariables(ast: TSESTree.Program): SafeVariables {
    const safeVars = new Map<string, boolean>()

    this.traverse(ast, (node) => {
      if (node.type === 'VariableDeclaration') {
        const varDecl = node as TSESTree.VariableDeclaration

        for (const declarator of varDecl.declarations) {
          if (declarator.type === 'VariableDeclarator' &&
              declarator.id.type === 'Identifier' &&
              declarator.init &&
              declarator.init.type === 'CallExpression') {

            const call = declarator.init as TSESTree.CallExpression

            // Check if this is path.join()
            if (this.isPathJoin(call.callee)) {
              const args = call.arguments

              // Check if all arguments are safe (Literals or safe built-ins)
              const allSafe = args.every(arg =>
                arg.type === 'Literal' || this.isSafeBuiltin(arg)
              )

              if (allSafe) {
                // Mark this variable as safe
                const varName = (declarator.id as TSESTree.Identifier).name
                safeVars.set(varName, true)
              }
            }
          }
        }
      }
    })

    return safeVars
  }

  /**
   * Check if callee is path.join
   */
  private isPathJoin(callee: TSESTree.Node): boolean {
    if (callee.type !== 'MemberExpression') {
      return false
    }
    const member = callee as TSESTree.MemberExpression
    return member.object.type === 'Identifier' &&
           member.object.name === 'path' &&
           member.property.type === 'Identifier' &&
           member.property.name === 'join'
  }

  /**
   * Step 2: Find dangerous sinks
   */
  private findDangerousSinks(ast: TSESTree.Program, safeVariables: SafeVariables): TaintSink[] {
    const sinks: TaintSink[] = []

    this.traverse(ast, (node) => {
      if (node.type === 'CallExpression') {
        const call = node as TSESTree.CallExpression

        // Check callee
        const callee = call.callee

        // Code execution: eval(), Function() constructor, vm module calls
        if (callee.type === 'Identifier') {
          const name = callee.name

          if (name === 'eval') {
            sinks.push({
              node: call,
              type: 'code-execution',
              name: 'eval',
              severity: 'critical',
            })
          } else if (name === 'Function') {
            sinks.push({
              node: call,
              type: 'code-execution',
              name: 'Function',
              severity: 'critical',
            })
          }
        }

        // Network: fetch(), http.request, axios calls
        if (callee.type === 'Identifier' && callee.name === 'fetch') {
          sinks.push({
            node: call,
            type: 'network',
            name: 'fetch',
            severity: 'high',
          })
        }

        // Command execution: exec(), spawn(), fork() - could be destructured from child_process
        if (callee.type === 'Identifier') {
          const name = callee.name
          if (name === 'exec' || name === 'execSync' || name === 'spawn' ||
              name === 'spawnSync' || name === 'fork') {
            sinks.push({
              node: call,
              type: 'command-injection',
              name: name,
              severity: 'critical',
            })
          }
        }

        // MemberExpression calls (fs.*, child_process.*, etc.)
        if (callee.type === 'MemberExpression') {
          const memberExpr = callee as TSESTree.MemberExpression

          if (memberExpr.object.type === 'Identifier') {
            const objName = (memberExpr.object as TSESTree.Identifier).name

            // Check for fs.* calls
            if (objName === 'fs' && memberExpr.property.type === 'Identifier') {
              const propName = (memberExpr.property as TSESTree.Identifier).name

              if (propName === 'writeFile' || propName === 'writeFileSync' ||
                  propName === 'readFile' || propName === 'readFileSync' ||
                  propName === 'appendFile' || propName === 'appendFileSync' ||
                  propName === 'unlink' || propName === 'unlinkSync') {
                // Check if first argument is a hardcoded path (string literal)
                // Hardcoded paths are safe, only flag variable/tainted paths
                const firstArg = call.arguments[0]

                // Skip if no argument or if it's a Literal (hardcoded path)
                if (!firstArg || firstArg.type === 'Literal') {
                  // Safe - hardcoded path
                } else if (firstArg.type === 'Identifier') {
                  // Check if it's a safe variable (from path.join with safe built-ins)
                  const varName = (firstArg as TSESTree.Identifier).name
                  if (!safeVariables.has(varName)) {
                    // Not a safe variable - flag as sink
                    sinks.push({
                      node: call,
                      type: 'file-access',
                      name: `fs.${propName}`,
                      severity: 'high',
                    })
                  }
                  // If safeVariables.has(varName), skip - it's safe
                } else {
                  // Variable or tainted data - unsafe, flag as sink
                  sinks.push({
                    node: call,
                    type: 'file-access',
                    name: `fs.${propName}`,
                    severity: 'high',
                  })
                }
              }
            }

            // Check for child_process.* calls
            if (objName === 'child_process' && memberExpr.property.type === 'Identifier') {
              const propName = (memberExpr.property as TSESTree.Identifier).name

              if (propName === 'exec' || propName === 'execSync' ||
                  propName === 'spawn' || propName === 'spawnSync' ||
                  propName === 'fork') {
                sinks.push({
                  node: call,
                  type: 'command-injection',
                  name: `child_process.${propName}`,
                  severity: 'critical',
                })
              }
            }
          }

          // Check for direct exec calls (e.g., after destructuring: const { exec } = require('child_process'))
          // Only flag if it's a simple identifier call that could be exec from child_process
          if (memberExpr.object.type === 'Identifier' && memberExpr.property.type === 'Identifier') {
            const objName = (memberExpr.object as TSESTree.Identifier).name
            const propName = (memberExpr.property as TSESTree.Identifier).name

            // Be more specific - only flag exec/spawn when object might be child_process
            // or when it's a simple identifier call
            if (propName === 'exec' || propName === 'spawn' || propName === 'fork') {
              sinks.push({
                node: call,
                type: 'command-injection',
                name: propName,
                severity: 'critical',
              })
            }
          }
        }
      }

      // DOM XSS sinks: innerHTML, outerHTML assignments
      if (node.type === 'AssignmentExpression') {
        const assign = node as TSESTree.AssignmentExpression

        if (assign.left.type === 'MemberExpression') {
          const member = assign.left as TSESTree.MemberExpression

          if (member.property.type === 'Identifier') {
            const propName = member.property.name

            if (propName === 'innerHTML' || propName === 'outerHTML') {
              sinks.push({
                node: assign,
                type: 'code-execution',
                name: propName,
                severity: 'critical',
              })
            }
          }
        }
      }

      // DOM XSS sinks: document.write() calls
      if (node.type === 'CallExpression') {
        const call = node as TSESTree.CallExpression

        if (call.callee.type === 'MemberExpression') {
          const member = call.callee as TSESTree.MemberExpression

          if (member.object.type === 'Identifier' &&
              member.object.name === 'document' &&
              member.property.type === 'Identifier' &&
              member.property.name === 'write') {
            sinks.push({
              node: call,
              type: 'code-execution',
              name: 'document.write',
              severity: 'critical',
            })
          }
        }
      }
    })

    return sinks
  }

  /**
   * Step 3: Build flow graph
   * Tracks variable assignments and their dependencies
   * Handles all source types: parameter, env, file-read, dom-source
   */
  private buildFlowGraph(ast: TSESTree.Program, sources: TaintSource[]): FlowGraph {
    const graph = new Map<string, Set<string>>()

    // Collect all source names as initially tainted (works for all source types)
    const taintedParams = new Set(sources.map(s => s.name))

    // Initialize graph with all sources as self-tainted
    for (const source of sources) {
      graph.set(source.name, new Set([source.name]))
    }

    this.traverse(ast, (node) => {
      // Track variable declarations
      if (node.type === 'VariableDeclaration') {
        const varDecl = node as TSESTree.VariableDeclaration

        for (const declarator of varDecl.declarations) {
          if (declarator.type === 'VariableDeclarator' &&
              declarator.id.type === 'Identifier') {

            const varName = (declarator.id as TSESTree.Identifier).name

            // Initialize dependency set
            if (!graph.has(varName)) {
              graph.set(varName, new Set())
            }

            // Check if initialized with tainted value
            if (declarator.init) {
              const dependencies = this.extractDependencies(declarator.init, taintedParams, graph)
              dependencies.forEach(dep => graph.get(varName)!.add(dep))
            }
          }
        }
      }
    })

    // Track assignment expressions
    this.traverse(ast, (node) => {
      if (node.type === 'ExpressionStatement') {
        const exprStmt = node as TSESTree.ExpressionStatement

        if (exprStmt.expression.type === 'AssignmentExpression') {
          const assign = exprStmt.expression as TSESTree.AssignmentExpression

          if (assign.left.type === 'Identifier') {
            const varName = (assign.left as TSESTree.Identifier).name

            if (!graph.has(varName)) {
              graph.set(varName, new Set())
            }

            const dependencies = this.extractDependencies(assign.right, taintedParams, graph)
            dependencies.forEach(dep => graph.get(varName)!.add(dep))
          }
        }
      }
    })

    return graph
  }

  /**
   * Extract dependencies from an expression node
   */
  private extractDependencies(
    node: TSESTree.Node,
    taintedParams: Set<string>,
    graph: FlowGraph
  ): Set<string> {
    const deps = new Set<string>()

    if (node.type === 'Identifier') {
      const name = (node as TSESTree.Identifier).name

      // If it's a tainted parameter, add it
      if (taintedParams.has(name)) {
        deps.add(name)
      }

      // Also propagate any dependencies from the graph
      const existingDeps = graph.get(name)
      if (existingDeps) {
        existingDeps.forEach(dep => deps.add(dep))
      }
    } else if (node.type === 'MemberExpression') {
      const member = node as TSESTree.MemberExpression

      // Check if this MemberExpression itself is a taint source
      // (e.g., process.env.API_KEY, location.search, document.cookie)
      // We need to generate a unique key for this member expression
      const memberKey = this.getMemberExpressionKey(member)
      if (taintedParams.has(memberKey)) {
        deps.add(memberKey)
      }

      // Also recursively check the object
      const objDeps = this.extractDependencies(member.object, taintedParams, graph)
      objDeps.forEach(dep => deps.add(dep))
    } else if (node.type === 'CallExpression') {
      const call = node as TSESTree.CallExpression

      // Check all arguments
      for (const arg of call.arguments) {
        const argDeps = this.extractDependencies(arg, taintedParams, graph)
        argDeps.forEach(dep => deps.add(dep))
      }

      // For member expression calls like data.toUpperCase(), check the object
      if (call.callee.type === 'MemberExpression') {
        const member = call.callee as TSESTree.MemberExpression
        const objDeps = this.extractDependencies(member.object, taintedParams, graph)
        objDeps.forEach(dep => deps.add(dep))
      }
    }

    return deps
  }

  /**
   * Generate a unique key for a MemberExpression
   * Used to track taint sources like process.env.XXX, location.search, etc.
   */
  private getMemberExpressionKey(member: TSESTree.MemberExpression): string {
    if (member.property.type === 'Identifier') {
      const propName = member.property.name

      if (member.object.type === 'Identifier') {
        const objName = member.object.name
        return `${objName}.${propName}`
      }

      // Handle nested member expressions like process.env.XXX
      if (member.object.type === 'MemberExpression') {
        const innerKey = this.getMemberExpressionKey(member.object as TSESTree.MemberExpression)
        return `${innerKey}.${propName}`
      }
    }

    // Fallback: can't determine key
    return ''
  }

  /**
   * Step 4: Check if source reaches sink
   */
  private reachesSink(
    source: TaintSource,
    sink: TaintSink,
    graph: FlowGraph
  ): boolean {
    // Handle CallExpression sinks (eval, fetch, exec, fs operations, etc.)
    if (sink.node.type === 'CallExpression') {
      const call = sink.node as TSESTree.CallExpression

      // Check if any argument is tainted
      for (const arg of call.arguments) {
        if (this.isTainted(arg, source.name, graph)) {
          return true
        }
      }

      return false
    }

    // Handle AssignmentExpression sinks (innerHTML, outerHTML)
    if (sink.node.type === 'AssignmentExpression') {
      const assign = sink.node as TSESTree.AssignmentExpression

      // Check if the right-hand side (value being assigned) is tainted
      return this.isTainted(assign.right, source.name, graph)
    }

    return false
  }

  /**
   * Check if an expression is tainted (depends on source parameter)
   */
  private isTainted(
    node: TSESTree.Node,
    sourceName: string,
    graph: FlowGraph
  ): boolean {
    // Direct reference to source parameter
    if (node.type === 'Identifier') {
      const name = (node as TSESTree.Identifier).name

      if (name === sourceName) {
        return true
      }

      // Check if this variable depends on source through flow graph
      const deps = graph.get(name)
      if (deps && deps.has(sourceName)) {
        return true
      }

      return false
    }

    // Check call expressions
    if (node.type === 'CallExpression') {
      const call = node as TSESTree.CallExpression

      // Check all arguments
      for (const arg of call.arguments) {
        if (this.isTainted(arg, sourceName, graph)) {
          return true
        }
      }

      // Check function name (for method calls like data.toUpperCase())
      if (call.callee.type === 'MemberExpression') {
        const member = call.callee as TSESTree.MemberExpression
        if (this.isTainted(member.object, sourceName, graph)) {
          return true
        }
      }

      return false
    }

    // Check member expressions
    if (node.type === 'MemberExpression') {
      const member = node as TSESTree.MemberExpression
      return this.isTainted(member.object, sourceName, graph)
    }

    // Recursively check child nodes
    const keys = Object.keys(node)
    for (const key of keys) {
      const child = (node as any)[key]
      if (child && typeof child === 'object' && child.type) {
        if (this.isTainted(child, sourceName, graph)) {
          return true
        }
      } else if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && item.type) {
            if (this.isTainted(item, sourceName, graph)) {
              return true
            }
          }
        }
      }
    }

    return false
  }

  /**
   * Create taint finding message
   * Generates appropriate messages for each source type
   */
  private createTaintMessage(source: TaintSource, sink: TaintSink): string {
    switch (source.type) {
      case 'env':
        return `Environment variable '${source.name}' reaches dangerous sink '${sink.name}'`

      case 'file-read':
        return `File read from '${source.filePath}' reaches dangerous sink '${sink.name}'`

      case 'dom-source':
        return `DOM source '${source.name}' reaches dangerous sink '${sink.name}'`

      case 'parameter':
        const funcName = source.functionName ? ` in function '${source.functionName}'` : ''
        return `Taint data flow detected: Parameter '${source.name}'${funcName} reaches dangerous sink '${sink.name}' (${sink.type})`

      default:
        return `Taint data flow detected: '${source.name}' reaches dangerous sink '${sink.name}'`
    }
  }

  /**
   * Extract location from AST node
   */
  private extractLocation(node: TSESTree.Node) {
    if (!node.loc) {
      return { line: 0, column: 0 }
    }

    return {
      line: node.loc.start.line,
      column: node.loc.start.column,
    }
  }

  /**
   * Check if node is a safe built-in (like __dirname, __filename)
   * Safe built-ins are constants that don't represent user input
   */
  private isSafeBuiltin(node: TSESTree.Node): boolean {
    if (node.type === 'Identifier') {
      const identifier = node as TSESTree.Identifier
      return ['__dirname', '__filename'].includes(identifier.name)
    }
    return false
  }

  /**
   * Check if a parameter is a callback parameter (error-first callback pattern)
   *
   * In Node.js, error-first callbacks have the form (err, data) => {...}
   * The 'err' or 'error' parameter is the first parameter and is NOT user input.
   * This helper identifies such parameters to exclude them from taint sources.
   *
   * Note: This is a simplified version that checks the parameter name and context.
   * Full implementation would require parent tracking which isn't available in
   * the default AST parser. We use heuristics instead.
   *
   * @param param - The parameter node to check (Identifier)
   * @param parentNode - The parent function node (FunctionDeclaration, FunctionExpression, or ArrowFunctionExpression)
   * @param paramIndex - The index of this parameter in the parent's params array
   * @returns true if this is an error callback parameter, false otherwise
   */
  private isCallbackParameter(
    param: TSESTree.Node,
    parentNode: TSESTree.Node | null,
    paramIndex: number
  ): boolean {
    // Must be an Identifier
    if (param.type !== 'Identifier') {
      return false
    }

    const identifier = param as TSESTree.Identifier
    const paramName = identifier.name

    // Check if parameter name is 'err' or 'error' (common Node.js error-first callback pattern)
    if (paramName !== 'err' && paramName !== 'error') {
      return false
    }

    // Check if parameter is first parameter (index 0)
    if (paramIndex !== 0) {
      return false
    }

    // Check if parent is a callback function (ArrowFunctionExpression or FunctionExpression)
    // FunctionDeclaration parameters are typically NOT callbacks
    if (!parentNode) {
      return false
    }

    const parentType = parentNode.type
    if (parentType === 'ArrowFunctionExpression' || parentType === 'FunctionExpression') {
      // This is likely a callback - first parameter named 'err' or 'error' is a callback parameter
      return true
    }

    // FunctionDeclaration with 'err' as first parameter is NOT a callback
    // (it's a regular function that happens to have an 'err' parameter)
    return false
  }

  /**
   * Check if path is in the safe paths allowlist
   */
  private isSafePath(path: string): boolean {
    return SAFE_PATHS.includes(path)
  }

  /**
   * Traverse AST recursively and visit each node
   */
  private traverse(node: TSESTree.Node, visitor: (node: TSESTree.Node) => void): void {
    visitor(node)

    // Get visitor keys from typescript-estree
    const visitorKeys = (node as any).visitorKeys || this.getDefaultVisitorKeys(node.type)

    for (const key of visitorKeys) {
      const child = (node as any)[key]

      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && item.type) {
            this.traverse(item, visitor)
          }
        }
      } else if (child && typeof child === 'object' && child.type) {
        this.traverse(child, visitor)
      }
    }
  }

  /**
   * Get default visitor keys for a node type
   */
  private getDefaultVisitorKeys(nodeType: string): string[] {
    const keyMap: Record<string, string[]> = {
      Program: ['body'],
      ExpressionStatement: ['expression'],
      CallExpression: ['callee', 'arguments'],
      MemberExpression: ['object', 'property'],
      Identifier: [],
      Literal: [],
      VariableDeclaration: ['declarations'],
      VariableDeclarator: ['id', 'init'],
      FunctionDeclaration: ['id', 'params', 'body'],
      BlockStatement: ['body'],
      ReturnStatement: ['argument'],
      IfStatement: ['test', 'consequent', 'alternate'],
      AssignmentExpression: ['left', 'right'],
      ArrowFunctionExpression: ['params', 'body'],
    }

    return keyMap[nodeType] || []
  }
}
