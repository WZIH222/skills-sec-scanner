# Contributing to Skills Security Scanner (S³)

Thank you for contributing! This guide covers how to add detection rules, run tests, and submit changes.

## Quick Start

```bash
# Fork and clone
git clone https://github.com/WZIH222/skills-sec-scanner.git
cd skills-sec-scanner

# Install dependencies
pnpm install

# Start development
pnpm dev

# Run tests
pnpm test
```

## Project Structure

```
skills-sec/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/           # NestJS backend
├── packages/
│   ├── scanner/       # Core scanning engine
│   ├── database/      # Prisma schema & client
│   └── cli/          # CLI tool
├── community-rules/  # Community detection rules
└── docker/           # Docker deployment
```

## Development

### Prerequisites

- Node.js 20+
- PNPM 8+
- Docker (for full stack development)

### Commands

```bash
pnpm dev          # Start all services
pnpm dev:web       # Frontend only (http://localhost:3000)
pnpm dev:api       # Backend only (http://localhost:3001)
pnpm test          # Run all tests
pnpm build         # Production build
pnpm lint          # Lint code
pnpm type-check    # TypeScript check
```

## Adding Detection Rules

Rules detect security threats in AI Skills files. Built-in rules live in `packages/scanner/src/rules/core/*.json`.

### Rule Format

```json
{
  "id": "my-custom-rule",
  "name": "Detect Dangerous Pattern",
  "description": "Detects when user input is passed to a dangerous function",
  "severity": "high",
  "category": "injection",
  "pattern": {
    "type": "CallExpression",
    "callee": {
      "type": "Identifier",
      "name": "dangerousFunction"
    }
  },
  "message": "dangerousFunction() with user input may lead to code injection",
  "references": ["https://example.com/advisory"],
  "enabled": true
}
```

### Severity Levels

| Level | Meaning |
|-------|---------|
| `critical` | Remote code execution, known exploits |
| `high` | Data exfiltration, authentication bypass |
| `medium` | Context-dependent, needs verification |
| `low` | Best practice violations |
| `info` | Informational findings |

### Categories

`injection` | `file-access` | `credentials` | `network` | `prototype-pollution` | `dom-xss` | `deserialization` | `path-traversal`

### False Positive Guidelines

- **Target**: <10% false positive rate on safe codebases (lodash, express, etc.)
- Rules that trigger on safe patterns (e.g., `Object.assign` for cloning) should use `low` or `info` severity
- Document context-dependent rules clearly

## Testing

```bash
pnpm test                  # All tests
pnpm test packages/scanner  # Scanner package tests only
```

## Pull Request Checklist

- [ ] Code follows project style (`pnpm lint`)
- [ ] TypeScript compiles cleanly (`pnpm type-check`)
- [ ] Tests pass (`pnpm test`)
- [ ] New rules have acceptable false positive rate
- [ ] Documentation updated if needed

## License

By contributing, you agree your work will be licensed under the MIT License.
