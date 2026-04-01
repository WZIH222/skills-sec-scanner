# AI Prompt Effectiveness Testing

## Purpose

Verify AI analysis provides high-quality semantic analysis and accurate severity adjustments for new threat types.

This manual test procedure ensures that the AI-powered analysis component of the scanner delivers accurate, actionable insights that improve upon static analysis alone.

## Test Procedure

### 1. Select 10 Diverse Samples

Choose a representative set of test samples covering all threat categories:

**Prototype Pollution (2 samples):**
- 1 obvious threat: Clear `__proto__` manipulation with user input
- 1 subtle threat: Prototype pollution via nested object merge

**DOM XSS (2 samples):**
- 1 clear threat: `innerHTML` with `location.search`
- 1 ambiguous case: `innerHTML` with hardcoded template string (safe)

**Unsafe Deserialization (2 samples):**
- 1 with reviver: `JSON.parse` with sanitization reviver function
- 1 without reviver: `JSON.parse` of POST body without validation

**Path Traversal (2 samples):**
- 1 tainted path: `fs.readFile` with user-provided filename
- 1 safe path: `fs.readFile` with hardcoded `/etc/app/config.json`

**Sensitive Data (2 samples):**
- 1 real key: Actual AWS Access Key ID pattern
- 1 documentation string: Placeholder key in comments/examples

### 2. Run Scanner with AI Enabled

```bash
# Set your OpenAI API key
export OPENAI_API_KEY=sk-xxx

# Run AI-powered tests
pnpm test -- packages/scanner/tests/e2e/ai-samples.test.ts

# Or scan individual files
s3-cli scan path/to/sample.js --ai-enabled --output results.json
```

### 3. Review AI Analysis Quality

For each sample, evaluate:

**Explanation Quality:**
- Does AI provide explanations for all findings?
- Are explanations accurate (3-5 sentences, 50-500 chars)?
- Are explanations specific to the code context (not generic)?
- Does explanation cite relevant security concepts?

**Confidence Scores:**
- Are confidence scores reasonable (0-100)?
- Do high-confidence scores (>80%) correlate with clear threats?
- Do low-confidence scores (<50%) correlate with ambiguous cases?

**Severity Adjustment:**
- Does severity adjustment make sense given context?
- Does AI upgrade Medium→High for clear exploitability?
- Does AI downgrade High→Medium for safe usage patterns?
- Are adjustments consistent across similar samples?

### 4. Measure False Negative Rate

Count samples where AI missed obvious threats:

**False Negative Definition:**
- Static analysis detected threat (correct)
- AI analysis downgraded to Info/Low (incorrect)
- AI provided explanation claiming "safe" (incorrect)

**Calculation:**
```
False Negative Rate = (False Negatives / Total Malicious Samples) × 100
```

**Threshold:**
- Target: < 10% false negative rate
- Maximum: < 20% false negative rate
- If > 20%, prompt needs refinement

### 5. Measure Severity Adjustment Accuracy

Count correctness of severity adjustments:

**Correct Adjustments:**
- Medium→High for exploitable threats
- High→Medium for safe usage patterns
- High→Critical for RCE vulnerabilities
- Low→Info for documentation-only findings

**Calculation:**
```
Severity Adjustment Accuracy = (Correct Adjustments / Total Adjustments) × 100
```

**Threshold:**
- Target: > 80% accuracy
- Minimum: > 70% accuracy
- If < 70%, prompt instructions are unclear

## Test Results Template

Use this template to document your test results:

```markdown
# AI Prompt Effectiveness Test Results

**Test Date**: [YYYY-MM-DD]
**Tester**: [Name]
**AI Provider**: [OpenAI/Anthropic]
**Model**: [gpt-4/claude-3-opus/etc.]

## Sample Analysis

| Sample | Threat Type | Static Finding | AI Analysis | Severity Adjustment | Correct? | Notes |
|--------|-------------|----------------|-------------|---------------------|----------|-------|
| pp-1.js | Prototype Pollution | Object.assign with __proto__ | Explanation provided | Medium→High | Yes | Clear threat, AI correctly identified |
| xss-2.js | DOM XSS | innerHTML with user input | Explanation provided | High→Medium (safe usage) | No | Incorrectly downgraded, data is tainted |
| deser-3.js | Unsafe Deserialization | JSON.parse without reviver | Explanation provided | Low→Medium | Yes | Context matters, AI correctly assessed |
| ... | ... | ... | ... | ... | ... | ... |

## Aggregate Metrics

**False Negative Rate**: [X]%
- False Negatives: [X]/[Y] samples
- Most common issue: [description]

**Severity Adjustment Accuracy**: [X]%
- Correct Adjustments: [X]/[Y]
- Common errors: [description]

**Explanation Quality**: [X]%
- High-quality explanations: [X]/[Y]
- Generic/inaccurate: [X]/[Y]

## Conclusions

**Prompt Changes Needed**: [Yes/No]

If Yes, describe:
1. What issue was identified
2. Proposed fix to prompt
3. Expected improvement

**Recommendations**:
- [Any suggestions for prompt improvements]
- [Any suggestions for temperature/parameter tuning]
- [Any suggestions for additional context to provide]

## Example Prompt Iteration

**Initial prompt issue**: AI not downgrading obvious safe usage
- Problem: AI maintaining High severity for hardcoded `innerHTML` strings
- Impact: False positives on safe code, user confusion

**Fix**: Add explicit instruction to prompt
```
"When evaluating innerHTML usage:
- Downgrade to Medium/Low if data is hardcoded string literal
- Maintain High severity if data source is user input (req.params, location.search, etc.)
- Consider context: server-side rendering vs client-side code"
```

**Result**: Severity adjustment accuracy improved from 60% to 85%
```

## When to Update Prompt

Update `packages/scanner/src/ai-engine/prompts/analysis-prompt.ts` if:

### False Negative Rate > 20%
AI is missing obvious threats. Symptoms:
- Clear exploits downgraded to Info/Low
- AI claims "safe" for tainted data patterns
- Known CVE patterns not recognized

**Fix**: Add examples of obvious threats to prompt, emphasize exploitability indicators.

### Severity Adjustment Accuracy < 70%
AI makes wrong severity calls. Symptoms:
- Safe usage flagged as High/Critical
- Exploitable patterns downgraded to Medium/Low
- Inconsistent severity for similar patterns

**Fix**: Clarify severity criteria, add bidirectional adjustment examples, emphasize context.

### Explanations Generic or Inaccurate > 30%
AI provides low-quality analysis. Symptoms:
- Template responses without code-specific details
- Incorrect security concepts cited
- Explanation length outside 50-500 char range

**Fix**: Add instruction to cite specific code patterns, require concrete examples.

### Confidence Scores Mismatch
AI confidence doesn't match explanation. Symptoms:
- High confidence (>80%) with uncertain language
- Low confidence (<50%) with definitive statements
- Confidence scores don't correlate with accuracy

**Fix**: Add calibration examples, define confidence scoring rubric.

## Running This Test

### Prerequisites
- OpenAI API key or Anthropic API key
- Test samples prepared (10 diverse cases)
- AI analysis enabled in scanner configuration

### Execution
```bash
# 1. Ensure AI provider configured
export OPENAI_API_KEY=sk-xxx

# 2. Run scanner on test samples
for sample in test-samples/*.js; do
  s3-cli scan "$sample" --ai-enabled --output "results/$(basename $sample).json"
done

# 3. Review results and fill in template
# 4. Calculate metrics
# 5. Document conclusions
```

### Automation (Optional)
While this is primarily a manual test due to AI non-determinism, you can automate data collection:

```typescript
// scripts/collect-ai-metrics.ts
import { collectMetrics } from './ai-metrics-collector'

const results = await collectMetrics({
  samples: loadTestSamples(),
  aiEnabled: true,
  outputFormat: 'json'
})

console.log(`False Negative Rate: ${results.falseNegativeRate}%`)
console.log(`Severity Accuracy: ${results.severityAccuracy}%`)
```

## Continuous Monitoring

Track these metrics over time to detect AI model drift or prompt degradation:

**Monthly Review:**
- Re-run this test on same 10 samples
- Compare metrics to previous month
- Investigate any >10% degradation

**Quarterly Review:**
- Expand test set with new threat patterns
- Update prompt based on quarterly findings
- Document prompt evolution in changelog

**Model Updates:**
- Re-test when AI provider updates models
- Compare old vs new model performance
- Adjust prompt if new model behaves differently

## References

- AI Prompt Engineering Guide: `packages/scanner/src/ai-engine/prompts/README.md`
- Analysis Prompt Source: `packages/scanner/src/ai-engine/prompts/analysis-prompt.ts`
- AI Provider Interface: `packages/scanner/src/ai-engine/providers/`
- Test Samples: `packages/scanner/tests/fixtures/adversary-samples/`
