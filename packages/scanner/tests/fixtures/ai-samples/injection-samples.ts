/**
 * Test fixtures for injection vulnerability detection
 * These samples contain actual security vulnerabilities that AI should detect
 */

export interface InjectionSample {
  code: string
  filename: string
  expectedBehavior: string
  severity: 'critical' | 'high' | 'medium' | 'low'
}

/**
 * Code samples with actual injection vulnerabilities
 * AI analysis should identify these as dangerous
 */
export const INJECTION_SAMPLES: InjectionSample[] = [
  {
    code: `
// Dangerous: eval() with user input
function processUserInput(input) {
  // VULNERABLE: Direct eval of user-controlled data
  const result = eval(input);
  return result;
}

// Usage
const userInput = req.body.command;
processUserInput(userInput);
`,
    filename: 'dangerous-eval.js',
    expectedBehavior: 'AI should flag eval() with user input as critical severity',
    severity: 'critical',
  },
  {
    code: `
// Dangerous: exec() with concatenated strings
const { exec } = require('child_process');

function runCommand(fileName) {
  // VULNERABLE: Command injection via string concatenation
  exec('cat /tmp/' + fileName, (error, stdout, stderr) => {
    console.log(stdout);
  });
}

// Usage
const userFile = req.query.file;
runCommand(userFile);
`,
    filename: 'command-injection.js',
    expectedBehavior: 'AI should flag exec() with concatenated user input as critical',
    severity: 'critical',
  },
  {
    code: `
// Dangerous: fetch() to untrusted URL
async function fetchData(url) {
  // VULNERABLE: SSRF via unvalidated URL parameter
  const response = await fetch(url);
  const data = await response.json();
  return data;
}

// Usage
const targetUrl = req.query.target;
fetchData(targetUrl);
`,
    filename: 'ssrf-fetch.js',
    expectedBehavior: 'AI should flag fetch() to untrusted URL as high severity',
    severity: 'high',
  },
  {
    code: `
// Dangerous: fs.readFile() with parameter
const fs = require('fs');

function readConfig(configPath) {
  // VULNERABLE: Path traversal via unvalidated path
  fs.readFile(configPath, 'utf8', (err, data) => {
    if (err) throw err;
    console.log(data);
  });
}

// Usage
const userPath = req.query.config;
readConfig(userPath);
`,
    filename: 'path-traversal.js',
    expectedBehavior: 'AI should flag fs.readFile() with user input as high severity',
    severity: 'high',
  },
  {
    code: `
// Dangerous: SQL injection via string concatenation
function getUser(userId) {
  const query = "SELECT * FROM users WHERE id = '" + userId + "'";
  // VULNERABLE: No parameterization, direct concatenation
  db.execute(query, (err, results) => {
    return results;
  });
}
`,
    filename: 'sql-injection.js',
    expectedBehavior: 'AI should flag SQL injection via concatenation as critical',
    severity: 'critical',
  },
  {
    code: `
// Dangerous: Dynamic require with user input
function loadPlugin(pluginName) {
  // VULNERABLE: Arbitrary code execution via dynamic require
  const plugin = require('./plugins/' + pluginName);
  return plugin;
}

// Usage
const userPlugin = req.body.plugin;
loadPlugin(userPlugin);
`,
    filename: 'dynamic-require.js',
    expectedBehavior: 'AI should flag dynamic require() with user input as high',
    severity: 'high',
  },
]

export default INJECTION_SAMPLES
