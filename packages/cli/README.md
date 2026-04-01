# Skills Security Scanner CLI

Command-line interface for scanning AI Skills files for security threats.

## Installation

### Global Install

```bash
npm install -g @skills-sec/cli
```

### Local Install

```bash
npm install @skills-sec/cli
```

### Verify Installation

```bash
s3-cli --version
# Output: 0.1.0

s3-cli scan --help
# Output: Usage: s3-cli scan [options] <file>
```

## Usage

### Basic Scan

```bash
s3-cli scan myfile.ts
```

### Scan with AI Analysis

```bash
s3-cli scan myfile.ts --ai
```

### Export JSON Results

```bash
s3-cli scan myfile.ts --output results.json
```

### Export SARIF Format

```bash
s3-cli scan myfile.ts --output results.sarif --format sarif
```

### Verbose Mode

```bash
s3-cli scan myfile.ts --verbose
```

### Combined Options

```bash
s3-cli scan myfile.ts --ai --output results.json --verbose
```

## Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--ai` | `-a` | Enable AI analysis | disabled |
| `--output <file>` | `-o` | Export results to file | none |
| `--format <type>` | | Export format (json, sarif) | json |
| `--verbose` | `-v` | Show detailed output | disabled |
| `--help` | `-h` | Show help message | - |
| `--version` | | Show version number | - |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | No security findings detected |
| `1` | Security findings found or error occurred |

## CI/CD Integration

### GitHub Actions

```yaml
name: Security Scan

on: [push, pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install CLI
        run: npm install -g @skills-sec/cli

      - name: Scan Skills files
        run: s3-cli scan src/skills/*.ts --output results.sarif --format sarif

      - name: Upload SARIF to GitHub Security Tab
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: results.sarif
```

### GitLab CI

```yaml
security-scan:
  stage: test
  script:
    - npm install -g @skills-sec/cli
    - s3-cli scan src/skills/*.ts --output results.json
  artifacts:
    paths:
      - results.json
    expire_in: 1 week
```

### Jenkins Pipeline

```groovy
pipeline {
    stages {
        stage('Security Scan') {
            steps {
                sh 'npm install -g @skills-sec/cli'
                sh 's3-cli scan src/skills/*.ts --output results.json'
            }
        }
    }
    post {
        always {
            archiveArtifacts artifacts: 'results.json'
        }
    }
}
```

## Configuration

### Environment Variables

```bash
# OpenAI API Key (for AI analysis)
export OPENAI_API_KEY=sk-xxx

# Anthropic API Key (for AI analysis)
export ANTHROPIC_API_KEY=sk-ant-xxx
```

### Config File

Create `.skills-sec.yaml` in your project root:

```yaml
# Enable AI analysis by default
aiEnabled: true

# AI provider (openai, anthropic, custom)
aiProvider: openai

# Policy mode (strict, moderate, permissive)
policyMode: moderate
```

## Output Formats

### Console Output

Color-coded severity levels:
- 🔴 **Critical**: Bold red
- 🟠 **High**: Red
- 🟡 **Medium**: Yellow
- 🔵 **Low**: Blue
- ⚪ **Info**: Gray

Each finding includes:
- Rule ID and severity badge
- Message description
- File location (line:column)
- Code snippet (when available)
- AI explanation (when `--ai` is used)

### JSON Export

Complete scan results in JSON format:

```json
{
  "score": 85,
  "findings": [
    {
      "ruleId": "hardcoded-secret",
      "severity": "critical",
      "message": "Hardcoded secret detected",
      "line": 10,
      "column": 5,
      "code": "const apiKey = 'sk-1234567890'",
      "explanation": "Hardcoded secrets expose sensitive credentials..."
    }
  ],
  "scannedAt": "2024-03-17T12:00:00.000Z",
  "scanDuration": 1500,
  "aiAnalysis": true,
  "aiProvider": "openai"
}
```

### SARIF Export

SARIF 2.1.0 format for CI/CD integration:

- Compatible with GitHub Security Tab
- Includes security-severity property for ranking
- Maps severity to SARIF levels
- Extracts unique rules from findings

## Examples

### Scan Single File

```bash
s3-cli scan src/skills/user-skill.ts
```

### Scan with AI Analysis

```bash
s3-cli scan src/skills/user-skill.ts --ai
```

### Export for CI/CD

```bash
# GitHub Actions (SARIF)
s3-cli scan src/skills/*.ts --output results.sarif --format sarif

# Generic JSON export
s3-cli scan src/skills/*.ts --output results.json
```

### Use in GitHub Actions Workflow

```yaml
- name: Security Scan
  run: |
    npm install -g @skills-sec/cli
    s3-cli scan src/skills/*.ts --output results.sarif --format sarif

- name: Upload to Security Tab
  uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: results.sarif
```

### Scan Multiple Files

```bash
# Scan all TypeScript files in a directory
s3-cli scan src/skills/*.ts --output results.json

# Scan with shell expansion
for file in src/skills/*.ts; do
  s3-cli scan "$file" --output "results/$(basename $file).json"
done
```

## Troubleshooting

### Command Not Found

If you get `command not found: s3-cli`:

```bash
# Check if installed globally
npm list -g @skills-sec/cli

# Reinstall globally
npm install -g @skills-sec/cli

# Or use npx without installing
npx @skills-sec/cli scan myfile.ts
```

### AI Analysis Fails

If AI analysis fails:

1. Check API key configuration:
   ```bash
   echo $OPENAI_API_KEY
   echo $ANTHROPIC_API_KEY
   ```

2. Verify API key is valid:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

3. Scan without AI:
   ```bash
   s3-cli scan myfile.ts  # AI disabled by default
   ```

### Permission Denied

If export fails with permission error:

```bash
# Check directory permissions
ls -la $(dirname output.json)

# Use a different output location
s3-cli scan myfile.ts --output /tmp/results.json

# Create directory first
mkdir -p results
s3-cli scan myfile.ts --output results/scan.json
```

### File Not Found

If scan fails with file not found:

```bash
# Use absolute path
s3-cli scan /full/path/to/myfile.ts

# Or relative to current directory
s3-cli scan ./src/skills/myfile.ts

# Check file exists
ls -la myfile.ts
```

## Advanced Usage

### Custom Config File

```bash
# Use custom config location
s3-cli scan myfile.ts --config /path/to/config.yaml
```

### Batch Scanning

```bash
# Scan all .ts files and create individual reports
for file in src/skills/*.ts; do
  output="results/$(basename $file .ts).json"
  s3-cli scan "$file" --output "$output"
done
```

### Exit Code Handling

```bash
# Use exit codes in scripts
if s3-cli scan myfile.ts; then
  echo "No security issues found"
else
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 1 ]; then
    echo "Security issues detected!"
    # Handle findings
  fi
fi
```

## Support

- **Issues**: [GitHub Issues](https://github.com/skills-sec/skills-sec/issues)
- **Documentation**: [Full Documentation](https://github.com/skills-sec/skills-sec#readme)
- **Contributing**: [Contributing Guide](https://github.com/skills-sec/skills-sec/blob/main/CONTRIBUTING.md)

## License

MIT License - see LICENSE file for details
