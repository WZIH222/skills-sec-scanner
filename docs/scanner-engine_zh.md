# 扫描引擎架构

## 概述

扫描引擎通过对 AI Skill 文件进行多阶段检测，结合静态分析、数据流追踪和可选的 AI 语义分析，发现安全威胁。

## 扫描流水线

调用 `scanner.scan(code, filename, options?)` 时，各阶段按顺序执行：

```
代码输入
    │
    ├─ 1. 内容Hash (SHA-256)
    │     └─► 检查Redis缓存 → 有则直接返回缓存结果
    │
    ├─ 2. 选择解析器
    │     .ts/.tsx → TypeScriptParser
    │     .json   → JSONParser
    │     .py     → PythonParser
    │     .md     → MarkdownParser
    │
    ├─ 3. 静态分析 — PatternMatcher
    │     遍历AST，根据规则模式匹配节点
    │     返回 Finding[] (ruleId, severity, message, location)
    │
    ├─ 4. 数据流分析 — TaintTracker
    │     识别污染源 (params, env, file-read, DOM)
    │     追踪到危险sink (eval, fetch, fs.*, innerHTML)
    │     返回确认的 source→sink 流向 Finding[]
    │
    ├─ 5. 误报过滤
    │     有userId时：从数据库加载用户排除规则
    │     按 codeHash 匹配过滤 findings
    │
    ├─ 6. AI语义分析（条件触发）
    │     ├── 检查Redis AI缓存 (key = 内容SHA-256, TTL = 24h)
    │     ├── [未命中] → 调用AI Provider (OpenAI / Anthropic / Custom)
    │     └── 将AI findings与静态 findings合并
    │
    ├─ 7. 去重（按 line:column:ruleId）
    │
    ├─ 8. 风险评分计算
    │     加权和：Critical×5 + High×3 + Medium×2 + Low×1，上限100
    │
    ├─ 9. 策略执行
    │     应用组织策略 (STRICT / MODERATE / PERMISSIVE)
    │     决定 block / allow / warn 结果
    │
    ├─ 10. 存入数据库 (ScanRepository)
    │
    ├─ 11. Redis缓存扫描结果
    │
    └─► 返回 ScanResult { findings, score, metadata }
```

## 规则引擎

### 规则结构

规则定义在 `packages/scanner/src/rules/core/` 下的 JSON 文件中：

```json
{
  "id": "injection-detect-eval",
  "name": "Eval 注入检测",
  "severity": "critical",
  "category": "injection",
  "pattern": {
    "type": "CallExpression",
    "callee": { "type": "Identifier", "name": "eval" }
  },
  "message": "检测到 eval() 使用 — 可能存在代码注入风险",
  "enabled": true,
  "references": ["https://owasp.org/www-community/attacks/Code_injection"]
}
```

**Schema验证** 使用 Zod (`RuleSchema`) 在加载时验证所有字段。

### 规则分类

| 分类 | 示例 |
|------|------|
| `injection` | eval, Function constructor, child_process |
| `file-access` | fs.writeFile, fs.readFile 路径遍历 |
| `credentials` | AWS密钥, Google密钥, GitHub Token |
| `network` | fetch, axios HTTP调用 |
| `prototype-pollution` | Object.assign merge, constructor操作 |
| `dom-xss` | innerHTML, document.write |
| `deserialization` | 不安全的反序列化调用 |
| `path-traversal` | path.join 配合用户输入 |

### 规则加载（Phase 12 变更）

**Phase 12 之前**：规则在运行时直接从 JSON 文件加载（`RuleLoader`）。

**Phase 12 之后**：规则在首次启动时从 JSON 导入数据库，之后从 `prisma.rule` 表读取。

```
JSON文件 (rules/core/*.json)
        │
        ▼
   RuleSeeder.seed()
   (一次性，幂等 upsert)
        │
        ▼
   数据库表: rules
        │
        ▼
   RuleRepository.loadBuiltInRules()
   (通过 prisma.rule.findMany 读取)
```

这使得：
- 内置规则不可变（禁止删除）
- 未来可扩展：规则管理API（启用/禁用内置规则）
- JSON 文件保留为备份/种子数据

### 模式匹配

`PatternMatcher` 遍历 AST 并将节点与规则模式进行匹配。支持以下 AST 节点类型：

| 模式类型 | 匹配内容 |
|----------|----------|
| `CallExpression` | 函数调用，包含 callee 和参数 |
| `MemberExpression` | 属性访问（如 `process.env`） |
| `Identifier` | 变量引用 |
| `Literal` | 字符串/数字字面量，可选前缀匹配 |
| `AssignmentExpression` | 变量赋值 |
| `ObjectExpression` | 对象字面量，属性匹配 |

## AI 引擎

### 配置

在以下条件满足时，`factory.ts` 中创建 AI 引擎：
1. 提供了 `aiProvider` 配置
2. `skipAI !== true`

支持的 Provider：`openai`、`anthropic`、`custom`、`test`

### AI 分析如何工作

AI 是**增量增强**——它丰富静态分析结果，而非替代：

```
静态Findings ──► AI Engine.analyzeCode()
                              │
                              ├─► 检查缓存 (Redis)
                              │     [命中] ──► 返回缓存结果
                              │
                              ├─► [未命中] ──► 调用AI Provider
                              │     (语义分析，意图理解)
                              │
                              └─► 返回 AIAnalysisResult
                                       { findings, promptInjectionDetected }
                                           │
                                           ▼
AI Findings ──► 合并 ──► 去重 ──► 评分 ──► 最终结果
```

### AI 缓存

- **缓存Key**：`ai-analysis:v1:` + SHA-256(内容)
- **TTL**：24小时
- **目的**：避免对相同代码重复调用API，降低成本

### 熔断器

- 连续 **5 次失败**后断开
- **60秒**后进入半开状态，允许一个测试请求

### AI 何时运行

| 条件 | AI行为 |
|------|--------|
| `options.aiEnabled = true` + AI Provider已配置 | 完整AI分析 |
| `options.aiEnabled = false` | 完全跳过 |
| 未配置AI Provider | 跳过，仅静态分析 |
| 熔断器断开 | 跳过，返回null |

## 工厂模式

`createScanner(options?)` 构建一个完整注入所有依赖的 Scanner 实例：

```
createScanner()
    │
    ├─► Redis/Prisma 单例
    │
    ├─► RuleSeeder.seed() — 首次调用时执行一次
    │
    ├─► CacheService + ScanRepository (缓存)
    │
    ├─► Parser (每个文件新实例，不缓存)
    │
    ├─► RuleLoader → PatternMatcher (模块级缓存)
    │
    ├─► TaintTracker (缓存)
    │
    ├─► RiskScorer (缓存)
    │
    ├─► AI Engine (如果已配置)
    │
    ├─► FalsePositiveFilter (如果有数据库)
    │
    ├─► PolicyEnforcer (如果有数据库)
    │
    └─► 注入到 Scanner 实例
```

模块级缓存确保重量级对象（规则、模式匹配器、AI引擎）在多个 Scanner 实例间复用，无需重复创建。

## 关键设计决策

| 决策 | 原因 |
|------|------|
| 静态分析始终运行 | 可靠的基线检测，不依赖API |
| AI是增量增强 | AI丰富结果，不替代静态分析 |
| 缓存优先 | 避免重复计算（规则、扫描、AI调用） |
| 解析器按文件创建 | AST解析器持有状态，无法安全共享 |
| Seeder幂等设计 | 多次运行安全（upsert语义） |
