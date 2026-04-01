/**
 * Test fixtures for ambiguous code that needs AI tiebreaker
 * These samples may trigger static analysis but need AI semantic understanding
 */

export interface AmbiguousSample {
  code: string
  filename: string
  expectedBehavior: string
  staticAnalysisLikely: 'flag' | 'ignore'
  aiAnalysisShould: 'confirm-safe' | 'confirm-dangerous' | 'explain-context'
}

/**
 * Code samples that are ambiguous and need AI semantic analysis
 * Static analysis may flag these, but AI should provide context
 */
export const AMBIGUOUS_SAMPLES: AmbiguousSample[] = [
  {
    code: `
// Benign: eval() with literal string (no user input)
function calculateExpression() {
  // SAFE: Eval of hardcoded literal, not user input
  const result = eval("2 + 2");
  console.log(result); // Output: 4
  return result;
}
`,
    filename: 'benign-eval-literal.js',
    expectedBehavior: 'Static analysis may flag eval(), AI should confirm it is safe (literal only)',
    staticAnalysisLikely: 'flag',
    aiAnalysisShould: 'confirm-safe',
  },
  {
    code: `
// Legitimate: fetch() to known API with validation
async function getUserData(userId) {
  // Validate input
  if (!userId || typeof userId !== 'string' || !/^[a-zA-Z0-9-]+$/.test(userId)) {
    throw new Error('Invalid userId');
  }

  // SAFE: Fetch to known API endpoint with validated ID
  const response = await fetch(\`https://api.example.com/users/\${userId}\`);
  return response.json();
}

// Usage with validated input
const data = await getUserData('user-12345');
`,
    filename: 'legitimate-fetch-api.js',
    expectedBehavior: 'Static analysis may flag fetch with template literal, AI should confirm safe with validation',
    staticAnalysisLikely: 'flag',
    aiAnalysisShould: 'confirm-safe',
  },
  {
    code: `
// Context-dependent: Template literal with sanitized user content
function renderUserComment(userComment) {
  // Sanitize HTML to prevent XSS
  const sanitized = userComment
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  // SAFE: Template literal with sanitized content
  const html = \`<div class="comment">\${sanitized}</div>\`;
  return html;
}
`,
    filename: 'sanitized-template-literal.js',
    expectedBehavior: 'Static analysis may flag template literal, AI should recognize sanitization makes it safe',
    staticAnalysisLikely: 'flag',
    aiAnalysisShould: 'confirm-safe',
  },
  {
    code: `
// Potentially dangerous: Dynamic function call with validation
function executeOperation(operation) {
  const allowedOperations = ['save', 'load', 'delete'];

  // Whitelist check
  if (!allowedOperations.includes(operation)) {
    throw new Error('Operation not allowed');
  }

  // Still potentially risky: Dynamic property access
  // AI should explain whether this pattern is safe given whitelist
  return operations[operation]();
}
`,
    filename: 'whitelist-dynamic-call.js',
    expectedBehavior: 'Static analysis may flag dynamic property access, AI should explain whitelist mitigates risk',
    staticAnalysisLikely: 'flag',
    aiAnalysisShould: 'explain-context',
  },
  {
    code: `
// False positive candidate: exec with hardcoded command
const { exec } = require('child_process');

function runBackup() {
  // SAFE: Hardcoded command, no user input
  exec('backup_database.sh', (error, stdout, stderr) => {
    if (error) console.error('Backup failed:', error);
    else console.log('Backup complete:', stdout);
  });
}
`,
    filename: 'safe-exec-hardcoded.js',
    expectedBehavior: 'Static analysis may flag exec(), AI should confirm safe (no user input)',
    staticAnalysisLikely: 'flag',
    aiAnalysisShould: 'confirm-safe',
  },
  {
    code: `
// Context-dependent: Regex with user input
function validateEmail(email) {
  // Potentially risky: User input in regex
  // AI should explain whether this RegExp constructor pattern is safe
  const emailRegex = new RegExp(email);

  // Usage for validation
  return emailRegex.test('test@example.com');
}

// Better alternative would be literal regex
// const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
`,
    filename: 'regex-user-input.js',
    expectedBehavior: 'Static analysis may flag RegExp with variable, AI should explain ReDoS risk',
    staticAnalysisLikely: 'flag',
    aiAnalysisShould: 'explain-context',
  },
]

export default AMBIGUOUS_SAMPLES
