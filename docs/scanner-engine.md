# Scanner Engine Architecture

## Overview

The scanner engine performs security threat detection on AI Skill files through a multi-stage pipeline combining static analysis, data flow tracking, and optional AI-powered semantic analysis.

## Scanning Pipeline

When `scanner.scan(code, filename, options?)` is called, the following stages execute in order:

```
Code Input
    │
    ├─ 1. Content Hash (SHA-256)
    │     └─► Redis cache check → [hit] return cached result immediately
    │
    ├─ 2. Parser Selection
    │     .ts/.tsx → TypeScriptParser
    │     .json   → JSONParser
    │     .py     → PythonParser
    │     .md     → MarkdownParser
    │
    ├─ 3. Static Analysis — PatternMatcher
    │     Traverses AST, matches nodes against loaded rules
    │     Returns Finding[] with ruleId, severity, message, location
    │
    ├─ 4. Data Flow Analysis — TaintTracker
    │     Identifies taint sources (params, env, file-read, DOM)
    │     Traces propagation to dangerous sinks (eval, fetch, fs.*, innerHTML)
    │     Returns Finding[] for confirmed source→sink flows
    │
    ├─ 5. False Positive Filter
    │     If userId provided: loads user exclusions from database
    │     Filters findings by codeHash match
    │
    ├─ 6. AI Semantic Analysis (conditional)
    │     ├── Check Redis AI cache (key = content SHA-256, TTL = 24h)
    │     ├── [miss] → call AI provider (OpenAI / Anthropic / Custom)
    │     └── Merge AI findings with static findings
    │
    ├─ 7. Deduplication (by line:column:ruleId)
    │
    ├─ 8. Risk Score Calculation
    │     Weighted sum: Critical×5 + High×3 + Medium×2 + Low×1, capped at 100
    │
    ├─ 9. Policy Enforcement
    │     Applies organization policy (STRICT / MODERATE / PERMISSIVE)
    │     Determines block/allow/warn outcome
    │
    ├─ 10. Persist to Database (ScanRepository)
    │
    ├─ 11. Cache Result in Redis
    │
    └─► Return ScanResult { findings, score, metadata }
```

## Rule Engine

### Rule Structure

Rules are defined in JSON files under `packages/scanner/src/rules/core/`:

```json
{
  "id": "injection-detect-eval",
  "name": "Eval Injection Detection",
  "severity": "critical",
  "category": "injection",
  "pattern": {
    "type": "CallExpression",
    "callee": { "type": "Identifier", "name": "eval" }
  },
  "message": "Use of eval() detected — potential code injection risk",
  "enabled": true,
  "references": ["https://owasp.org/www-community/attacks/Code_injection"]
}
```

**Schema validation** uses Zod (`RuleSchema`) to validate all fields on load.

### Rule Categories

| Category | Examples |
|----------|----------|
| `injection` | eval, Function constructor, child_process |
| `file-access` | fs.writeFile, fs.readFile path traversal |
| `credentials` | AWS keys, Google keys, GitHub tokens |
| `network` | fetch, axios HTTP calls |
| `prototype-pollution` | Object.assign merge, constructor manipulation |
| `dom-xss` | innerHTML, document.write |
| `deserialization` | unsafe deserialization calls |
| `path-traversal` | path.join with user input |

### Rule Loading (Phase 12 Change)

**Before Phase 12**: Rules loaded directly from JSON files at runtime via `RuleLoader`.

**After Phase 12**: Rules are seeded from JSON into the database on first startup, then read from `prisma.rule` table.

```
JSON files (rules/core/*.json)
        │
        ▼
   RuleSeeder.seed()
   (one-time, idempotent upsert)
        │
        ▼
   Database table: rules
        │
        ▼
   RuleRepository.loadBuiltInRules()
   (reads from prisma.rule.findMany)
```

This enables:
- Built-in rules are immutable (deletion blocked)
- Future: rule management APIs (enable/disable built-in rules)
- JSON files remain as backup/seed data

### Pattern Matching

`PatternMatcher` traverses the AST and matches nodes against rule patterns. Supported AST node types:

| Pattern Type | Matches |
|--------------|---------|
| `CallExpression` | Function calls with callee + arguments |
| `MemberExpression` | Property access (e.g., `process.env`) |
| `Identifier` | Variable references |
| `Literal` | String/number literals with optional prefix |
| `AssignmentExpression` | Variable assignments |
| `ObjectExpression` | Object literals with property matching |

## AI Engine

### Configuration

AI engine is created in `factory.ts` when:
1. `aiProvider` config is provided
2. `skipAI !== true`

Supported providers: `openai`, `anthropic`, `custom`, `test`

### How AI Analysis Works

AI is **additive** — it enhances static findings, never replaces them:

```
Static Findings ──► AI Engine.analyzeCode()
                              │
                              ├─► Check cache (Redis)
                              │     [hit] ──► return cached result
                              │
                              ├─► [miss] ──► Call AI Provider
                              │     (semantic analysis, intent understanding)
                              │
                              └─► Return AIAnalysisResult
                                       { findings, promptInjectionDetected }
                                           │
                                           ▼
AI Findings ──► Merge ──► Deduplicate ──► Score ──► Result
```

### AI Caching

- **Cache key**: `ai-analysis:v1:` + SHA-256(content)
- **TTL**: 24 hours
- **Purpose**: Avoid repeated API calls for same code, reduce cost

### Circuit Breaker

- Opens after **5 consecutive failures**
- Recovers after **60 seconds** (half-open state allows one test request)

### When AI Runs

| Condition | AI Behavior |
|-----------|-------------|
| `options.aiEnabled = true` + AI provider configured | Full AI analysis |
| `options.aiEnabled = false` | Skipped entirely |
| AI provider not configured | Skipped, static-only |
| Circuit breaker open | Skipped, returns null |

## Factory Pattern

`createScanner(options?)` builds a Scanner with all dependencies resolved:

```
createScanner()
    │
    ├─► Redis/Prisma singletons
    │
    ├─► RuleSeeder.seed() — one-time on first call
    │
    ├─► CacheService + ScanRepository (cached)
    │
    ├─► Parser (new instance per file, not cached)
    │
    ├─► RuleLoader → PatternMatcher (cached at module level)
    │
    ├─► TaintTracker (cached)
    │
    ├─► RiskScorer (cached)
    │
    ├─► AI Engine (if configured)
    │
    ├─► FalsePositiveFilter (if database available)
    │
    ├─► PolicyEnforcer (if database available)
    │
    └─► Inject into Scanner instance
```

Module-level caching ensures heavy objects (rules, pattern matcher, AI engine) are reused across scanner instances without recreation.

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Static always runs | Reliable baseline detection, no API dependency |
| AI is additive | AI enhances, never replaces static findings |
| Cache-first | Avoid repeated work (rules, scans, AI calls) |
| Parser per file | AST parsers hold state, cannot be safely shared |
| Seeder idempotent | Safe to run multiple times via upsert semantics |
