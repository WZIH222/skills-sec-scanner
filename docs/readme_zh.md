# Skills Security Scanner (S³)

<div align="center">

**AI Skills 安全检测平台 / Security Scanner for AI Skills**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://docker.com/)

</div>

---

## 项目简介

随着 AI Agents 和 openclaw 的普及，**AI Skills**（技能插件）已成为扩展 AI 能力的主流方式。然而，Skills 文件可能包含恶意代码或恶意提示词，对用户系统安全和数据安全构成严重威胁。

**Skills Security Scanner (S³)** 是一个专注于 AI Skills 安全检测的平台，结合静态分析、数据流追踪和 AI 语义分析，提供多层次的安全检测和风险评估能力。

![首页](docs/uat_pic/home.png)

---

## 核心功能

### 1. 自动化安全扫描

上传任意 AI Skill 文件，系统自动完成解析、分析、评分，返回结构化报告。

内置**静态分析 + AI 语义分析**双引擎：
- 静态分析基于 AST 解析与模式匹配，快速识别已知威胁模式
- AI 引擎（可配置 OpenAI 或 Claude API）进一步理解代码意图，检测 Prompt 注入、零日漏洞等静态规则无法覆盖的风险

扫描结果智能去重合并，Redis 缓存加速重复扫描。

扫描引擎详细说明：[docs/scanner-engine_zh.md](docs/scanner-engine_zh.md)。

支持上传单文件或整个文件夹，批量分析多个 Skill。

### 2. 全面的威胁检测覆盖

系统内置 **18+ 条检测规则**，覆盖 AI Skill 最常见的安全威胁：

| 威胁类型 | 说明 |
|---------|------|
| 代码注入 | eval / Function 构造器 / 子进程执行 |
| 文件系统访问 | 任意文件读写、路径遍历攻击 |
| 凭证泄露 | API Key、环境变量中的敏感凭据外发 |
| 网络请求 | 无限制的 HTTP 请求外发 |
| 原型污染 | Object.assign 合并导致的属性注入 |
| Prompt 注入 | 恶意指令覆盖、对话劫持 |

每条检测包含精确的代码位置（行号/列号）、问题描述和修复建议。

### 3. 安全态势可视化

仪表板实时展示团队 AI Skill 安全状况：

![看板](docs/uat_pic/dashboard_zh.png)

- 扫描总量与高危文件分布
- 7 天 / 30 天威胁趋势
- 可疑文件的发现与处理状态

### 4. 可扩展的规则体系

- **内置规则**：开箱即用，持续更新
- **自定义规则**：支持编写业务特定检测逻辑
- **AI 辅助生成**：描述需求，AI 自动生成规则（需人工审核激活）

![AI 规则生成](docs/uat_pic/ai_gen_rules.png)

### 5. 多级安全策略

根据不同场景选择合适的检测严格程度：

| 策略级别 | 行为 |
|---------|------|
| **STRICT** | 阻断所有高风险操作，需人工确认后放行 |
| **MODERATE** | 记录告警，AI 辅助审查，不自动阻断 |
| **PERMISSIVE** | 仅记录，不干预，适合测试环境 |

---

## 技术架构

![架构图](docs/architecture.png)

### 技术栈

| 层级 | 技术选型 |
|------|---------|
| 前端 | Next.js 15, React 18, TailwindCSS, Shadcn/ui |
| 后端 | NestJS, TypeScript, Prisma ORM |
| 数据库 | PostgreSQL 16, Redis 7 |
| 消息队列 | BullMQ (Redis-based) |
| 规则存储 | PostgreSQL (Phase 12) + JSON 文件 |
| AI 集成 | OpenAI SDK, Anthropic SDK |
| 测试 | Vitest (前端), Jest (后端), Playwright (E2E) |
| 部署 | Docker Compose |

### 核心模块（Monorepo）

```
packages/
├── scanner/           # 核心扫描引擎
│   └── src/
│       ├── ai-engine/     # AI 语义分析、缓存、熔断器
│       ├── analyzer/      # PatternMatcher、TaintTracker、RiskScorer
│       ├── factory.ts     # Scanner 实例工厂
│       ├── parser/        # TypeScript、JSON、Python 文件解析器
│       ├── policy/        # 策略执行、FalsePositive 过滤
│       ├── queue/         # BullMQ 任务队列
│       ├── rules/         # 规则加载、Schema 验证、Seeder
│       ├── scanner.ts     # 扫描器主类
│       ├── storage/       # 数据库/Redis 客户端与 Repository
│       ├── types/         # TypeScript 类型定义
│       └── workers/       # 后台 Worker（扫描、文件夹批量处理）
├── database/          # Prisma ORM + 数据库客户端
│   └── prisma/           # Schema、Migration
└── cli/               # 命令行扫描工具
```

---

## 快速启动

### 正式环境（Docker Compose）

```bash
# 1. 配置 docker-compose.yml 中的环境变量
#    - JWT_SECRET（API 与 Web 必须一致）
#    - DATABASE_URL
#    - REDIS_URL

# 2. 构建并启动
docker-compose up --build

# 3. 初始化数据库（首次）
docker-compose exec api npx prisma db push
docker-compose exec api npx prisma db seed
```

### 开发环境

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env

# 3. 初始化数据库
npm run db:migrate
npm run db:seed

# 4. 启动开发服务器
npm run dev
# 前端 → http://localhost:3000
# API  → http://localhost:3001
```

详细说明请参考 [docs/how_to_use_zh.md](docs/how_to_use_zh.md)。

---

## API 示例

### 扫描文件

```bash
curl -X POST http://localhost:3001/api/scan \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "fileId": "unique-file-id",
    "content": "eval(userInput)",
    "filename": "skill.js"
  }'
```

### 获取规则列表

```bash
curl http://localhost:3001/api/rules \
  -H "Authorization: Bearer <token>"
```

---

## 威胁检测范围

| 分类 | 示例威胁 |
|------|---------|
| 代码注入 | `eval()`, `Function()`, `child_process.exec()` |
| 文件访问 | `fs.writeFile()`, 路径遍历 |
| 凭证泄露 | AWS Key, Google API Key, GitHub Token |
| 网络请求 | `fetch()`, `axios` 无限制调用 |
| 原型污染 | `Object.assign()` merge, `__proto__` 注入 |
| DOM XSS | `innerHTML`, `document.write()` |
| 不安全反序列化 | `JSON.parse()` 配合恶意 payload |

---

## 项目路线图

| Phase | 内容 | 状态 |
|-------|------|------|
| 1-4 | 核心扫描引擎 + Web UI | ✅ 完成 |
| 5-7 | 规则引擎 + AI 增强分析 | ✅ 完成 |
| 8-10 | 仪表板 + 多语言支持 | ✅ 完成 |
| 11 | Docker Compose 部署 | ✅ 完成 |
| **12** | **数据库驱动规则** | ✅ 完成 |
| 13+ | 沙箱隔离、执行行为监控 | 规划中 |

---

## 许可证

MIT License — 详见 [LICENSE](./LICENSE)

---

**让 AI Skills 更安全 / Making AI Skills Safer**
