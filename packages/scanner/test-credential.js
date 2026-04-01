import { createScanner } from './src/factory.js'

async function test() {
  const scanner = await createScanner()
  const code = `const AWS_ACCESS_KEY = 'AKIAIOSFODNN7EXAMPLE';`
  const result = await scanner.scan(code, 'test.js')

  console.log('Total findings:', result.findings.length)
  console.log('Findings:', JSON.stringify(result.findings, null, 2))

  // Check for credential-related findings
  const credFindings = result.findings.filter(
    f => f.ruleId.includes('credential') || f.ruleId.includes('secret') || f.ruleId.includes('aws-key') || f.message.includes('API key')
  )
  console.log('Credential findings:', credFindings.length)
}

test().catch(console.error)
