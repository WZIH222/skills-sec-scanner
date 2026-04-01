# Contributing to Skills Security Scanner (S³)

Thank you for your interest in contributing to the Skills Security Scanner! This document provides guidelines for contributing detection rules, testing procedures, and maintaining code quality.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Adding New Detection Rules](#adding-new-detection-rules)
- [False Positive Testing](#false-positive-testing)
- [Severity Calibration Guidelines](#severity-calibration-guidelines)
- [Testing](#testing)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow:
- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js 20+
- PNPM package manager
- Git
- Docker (for sandbox testing, optional)

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/skills-sec.git
   cd skills-sec
   ```

3. Install dependencies:
   ```bash
   pnpm install
   ```

4. Build the project:
   ```bash
   pnpm build
   ```

5. Run tests:
   ```bash
   pnpm test
   ```

## Development Workflow

1. Create a new branch for your contribution:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the guidelines below

3. Test your changes thoroughly:
   ```bash
   pnpm test
   pnpm lint
   pnpm type-check
   ```

4. Commit your changes with a clear message:
   ```bash
   git commit -m "feat: add new rule for detecting XYZ vulnerability"
   ```

5. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

6. Create a pull request

## Adding New Detection Rules

Detection rules are the core of the scanner. They define patterns to identify security threats in AI Skills files.

### Rule Structure

Rules are defined as JSON objects with the following structure:

```json
{
  "id": "rule-unique-id",
  "name": "Human-readable rule name",
  "description": "Detailed description of what the rule detects",
  "severity": "high",
  "category": "injection",
  "patterns": [
    {
      "type": "ast",
      "pattern": "CallExpression[callee.name='eval']",
      "where": "argument.0.type Identifier"
    }
  ],
  "message": "eval() with user input can lead to code injection",
  "references": [
    "https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2021-1234"
  ],
  "enabled": true
}
```

### Rule Categories

- **injection**: Code injection, command injection, SQL injection
- **file-access**: Unsafe file operations, path traversal
- **network**: Unsafe network operations, SSRF
- **credential**: Hardcoded credentials, API keys
- **data-flow**: Tainted data flow to sensitive sinks
- **prototype**: Prototype pollution vulnerabilities
- **xss**: Cross-site scripting (DOM XSS, reflected XSS)
- **deserialization**: Unsafe deserialization
- **crypto**: Weak cryptography, missing encryption

### Testing New Rules

1. Create unit tests in `packages/scanner/tests/rules/`
2. Create test fixtures in `packages/scanner/tests/fixtures/`
3. Test against adversarial samples
4. Test against safe code to measure false positive rate (see below)
5. Update documentation

## False Positive Testing

When contributing new detection rules, measure false positive rate to ensure alert fatigue doesn't impact usability.

### Manual Testing Procedure

1. **Select known-safe codebase**: Use mature, well-audited libraries (lodash, express, axios) as test subjects

2. **Run scanner on safe code**:
   ```bash
   s3-cli scan path/to/safe/library --output results.json
   ```

3. **Count findings**: Review all findings with severity 'high' or 'critical'

4. **Calculate FP rate**: (false positives / total files scanned) * 100

5. **Adjust if needed**: If FP rate > 5%, refine rule patterns or reduce severity to 'info' or 'low'

### Example

```bash
# Test new rule on lodash (safe utility library)
s3-cli scan node_modules/lodash --output lodash-results.json

# Review findings
cat lodash-results.json | jq '.findings[] | select(.severity == "high" or .severity == "critical")'

# If >5% of files trigger high/critical findings, rule is too broad
```

### Acceptable Thresholds

- **Target FP rate**: < 5% for high/critical findings
- **Maximum FP rate**: < 10% for any severity level
- **Context-dependent threats** (DOM XSS, path traversal): May have higher FP rate at 'medium' severity, but must have clear documentation

### Common FP Sources

- **Safe Object.assign**: Data cloning, object composition (not prototype pollution)
- **Safe fs.readFile**: Reading configuration from known paths (package.json, static assets)
- **Safe process.env**: Environment variable access for configuration (not injection)
- **Safe innerHTML**: Server-side rendering with trusted data (not DOM XSS)

If your rule triggers on these patterns, consider adding context checks or reducing severity.

## Severity Calibration Guidelines

Severity levels indicate exploitability and impact. Choose appropriate severity to reduce false positives while catching real threats.

### Severity Levels

- **Critical**: Remote code execution without user interaction, known CVE exploits
  - Examples: eval() with user input, prototype pollution via Object.assign, child_process.exec with tainted data

- **High**: Data exfiltration, authentication bypass, privilege escalation
  - Examples: Hardcoded API keys, unsafe deserialization with user data, fetch() with tainted URL

- **Medium**: Context-dependent threats that may be exploitable
  - Examples: innerHTML with potential user input, fs.readFile with parameter, path operations with variable

- **Low**: Best practice violations, low-risk exposures
  - Examples: console.log with sensitive data, missing input validation (no clear exploit)

- **Info**: Informational findings, potential issues
  - Examples: Hardcoded credentials in test files, debug code, overly permissive CORS

### Calibration Process

1. **Research threat**: Check CVE database, security advisories for exploit examples
2. **Test on safe code**: Run rule on lodash, express, axios - if >5% FP, reduce severity
3. **Test on malicious code**: Verify rule catches real attack patterns
4. **Document rationale**: Add comment explaining why this severity was chosen

### Examples

**Good - Critical severity for clear RCE:**
```json
{
  "id": "prototype-pollution-assign",
  "severity": "critical",
  "message": "Object.assign() with user input can lead to prototype pollution (RCE)",
  "references": ["https://github.com/advisories/GHSA-wf6x-7x77-mvgw"]
}
```

**Good - Medium severity for context-dependent threat:**
```json
{
  "id": "dom-xss-innerhtml",
  "severity": "medium",
  "message": "innerHTML with potential user input can lead to DOM XSS (verify data source)"
}
```

### Policy-Based Overrides

Organizations can override rule severity via policy settings (see Phase 3.4). Default severity should reflect worst-case scenario, allowing organizations to reduce sensitivity for their use case.

## Testing

### Unit Tests

Unit tests should cover individual functions and components:

```typescript
import { describe, it, expect } from 'vitest'
import { yourFunction } from './your-module'

describe('yourFunction', () => {
  it('should do something', () => {
    const result = yourFunction('input')
    expect(result).toBe('expected output')
  })
})
```

### Integration Tests

Integration tests should test the interaction between components:

```typescript
import { describe, it, expect } from 'vitest'
import { createScanner } from '@skills-sec/scanner'

describe('Scanner Integration', () => {
  it('should detect injection vulnerabilities', async () => {
    const scanner = await createScanner()
    const result = await scanner.scan('eval(userInput)', 'test.js')
    expect(result.findings.length).toBeGreaterThan(0)
  })
})
```

### E2E Tests

E2E tests should test the complete workflow:

```typescript
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Detection Rate Benchmark', () => {
  it('should achieve >80% detection rate', async () => {
    // Test against adversarial samples
    const samples = ['sample1.js', 'sample2.js', 'sample3.js']
    let detectedCount = 0

    for (const sample of samples) {
      const code = readFileSync(join(__dirname, 'fixtures', sample), 'utf8')
      const result = await scanner.scan(code, sample)
      if (result.findings.length > 0) detectedCount++
    }

    const detectionRate = (detectedCount / samples.length) * 100
    expect(detectionRate).toBeGreaterThanOrEqual(80)
  })
})
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run specific test file
pnpm test packages/scanner/tests/rules/injection.test.ts
```

## Documentation

### Code Documentation

Use JSDoc comments for public APIs:

```typescript
/**
 * Scans a JavaScript file for security threats
 * @param code - The source code to scan
 * @param filename - The filename for reporting
 * @param options - Scan options (AI enabled, cache enabled, etc.)
 * @returns Scan result with findings and metadata
 */
async scan(code: string, filename: string, options?: ScanOptions): Promise<ScanResult>
```

### README Documentation

Update README.md if you're adding:
- New command-line options
- New configuration options
- New features
- Breaking changes

## Pull Request Process

1. Ensure your code follows the project's coding standards
2. Update documentation if needed
3. Add tests for new functionality
4. Ensure all tests pass
5. Update the CHANGELOG.md
6. Submit a pull request with:
   - Clear description of changes
   - Link to related issues
   - Screenshots for UI changes (if applicable)
   - Test results showing detection rate and FP rate

### PR Review Criteria

- Code quality and clarity
- Test coverage (unit, integration, E2E)
- Detection rate (must be >= 80% for new rules)
- False positive rate (must be < 10% for new rules)
- Documentation completeness
- Backward compatibility

## Getting Help

- **Documentation**: Check the project README and docs folder
- **Issues**: Search existing issues or create a new one
- **Discussions**: Ask questions in GitHub Discussions
- **Discord**: Join our community Discord server

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.
