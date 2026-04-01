import { createScanner } from './src/factory.js'

async function test() {
  const scanner = await createScanner()
  const code = `
    function mergeConfig() {
      const defaults = { debug: false };
      const userConfig = { theme: 'dark' };
      return Object.assign(defaults, userConfig);
    }
  `
  const result = await scanner.scan(code, 'test.js')

  console.log('Total findings:', result.findings.length)
  console.log('Findings:', JSON.stringify(result.findings, null, 2))

  const protoFindings = result.findings.filter(
    f => f.ruleId === 'prototype-pollution-assign'
  )
  console.log('Prototype pollution findings:', protoFindings.length)
}

test().catch(console.error)
