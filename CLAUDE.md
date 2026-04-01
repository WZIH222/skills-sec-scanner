# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Skills Security Scanner (S³)** is a Node.js-based web platform for detecting security threats in AI Skills files. The platform combines static analysis, AI-powered semantic analysis, and optional sandbox execution for comprehensive threat detection.

## Architecture

```
skills-sec/
├── apps/
│   ├── web/              # React Frontend (Next.js/Vite)
│   └── api/              # NestJS Backend API
├── packages/
│   ├── scanner/          # Core scanning engine
│   ├── sandbox/          # Docker-based isolation
│   ├── ai-engine/        # AI provider integrations
│   ├── policy/           # Security policy engine
│   └── cli/              # Command-line tool
├── community-rules/      # Community-contributed detection rules
└── docker/
    ├── postgresql/
    └── redis/
```

## Development Commands

```bash
# Install dependencies (root monorepo)
npm install

# Development (all services)
npm run dev

# Individual services
npm run dev:web          # Frontend only
npm run dev:api          # Backend only

# Testing
npm run test             # All tests
npm run test:e2e         # End-to-end tests
npm run test:coverage    # With coverage report

# Linting & Type Checking
npm run lint
npm run type-check

# Database
npm run db:migrate       # Run migrations
npm run db:seed          # Seed database
npm run db:studio        # Open Prisma Studio

# Build
npm run build            # Production build
```

## Key Technologies

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, TailwindCSS, shadcn/ui |
| Backend | NestJS, Express, TypeScript |
| Database | PostgreSQL 16 (Prisma ORM), Redis 7 |
| Queue | BullMQ (job scheduling) |
| Sandbox | Docker, optional Firecracker |
| AI SDK | OpenAI SDK, Anthropic SDK, LangChain |

## Core Concepts

### Scanning Pipeline

1. **File Upload** → User uploads skill file via Web UI or API
2. **Static Analysis** → AST parsing, pattern matching, data flow analysis
3. **AI Analysis** → Semantic analysis, intent understanding, prompt injection detection
4. **Sandbox Execution** → (Optional) Isolated execution with time/memory limits
5. **Behavior Monitoring** → (Optional) System call tracing, network monitoring
6. **Threat Scoring** → Aggregate risk assessment
7. **Report Generation** → Detailed findings + recommendations

### Detection Rules

Rules are defined in JSON schema and can be:
- **Static patterns**: Regex/AST-based code patterns
- **AI-enhanced**: LLM-validated for complex threats (prompt injection, semantic analysis)
- **Dynamic behaviors**: (Optional) Runtime behaviors (network, file access)

### Security Policies

- **Strict**: Block all unknown skills, require AI confirmation
- **Moderate**: Allow with warnings, AI review for high-risk
- **Permissive**: Log only, no blocking

## Environment Configuration

Required environment variables (see `.env.example`):

```bash
# AI Providers (at least one required)
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx

# Database
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Security
JWT_SECRET=...
SANDBOX_TIMEOUT=30000
DEFAULT_POLICY=strict
```

## AI Integration Notes

- The scanner supports both OpenAI and Anthropic APIs
- AI analysis is **optional** per-scan (user-controlled)
- Cost optimization: batch analysis, cache results, use local LLM when possible
- Fallback: static analysis works without AI

## Adding New Detection Rules

1. Create rule in `community-rules/` following schema
2. Add tests in `packages/scanner/tests/rules/`
3. Submit PR with description of threat model
4. Rules are reviewed before inclusion in core engine

## Deployment

```bash
# Docker Compose (development)
docker-compose up -d

# Production build
npm run build:prod

# Kubernetes (Helm)
helm install s3 ./helm-chart
```

## Important Architecture Decisions

1. **Monorepo Structure**: Enables code sharing between scanner, CLI, and API
2. **Queue-Based**: Scanning jobs run asynchronously via BullMQ
3. **Sandbox Isolation**: Every skill runs in isolated Docker container
4. **Policy as Code**: Security policies are version-controlled
5. **Community Extensible**: Third-party rules can be added without core changes

## Testing Strategy

- **Unit Tests**: Individual rule validation, parser tests
- **Integration Tests**: Full pipeline with test skill files
- **E2E Tests**: Web UI workflow testing with Playwright
- **Security Tests**: Adversarial skill samples, evasion attempts
