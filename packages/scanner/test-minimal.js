import { PatternMatcher, PatternRule } from './src/analyzer/pattern-matcher.js'
import { TypeScriptParser } from './src/parser/index.js'

const rule = {
  id: 'prototype-pollution-assign',
  severity: 'critical',
  category: 'prototype-pollution',
  pattern: {
    type: 'CallExpression',
    callee: {
      type: 'MemberExpression',
      object: 'Object',
      property: 'assign'
    },
    arguments: [
      {},
      {
        type: 'ObjectExpression',
        properties: [
          {
            type: 'Property',
            key: {
              type: 'Identifier',
              name: '__proto__'
            }
          }
        ]
      }
    ]
  },
  message: 'Object.assign() with __proto__ property can lead to prototype pollution (RCE)'
}

const matcher = new PatternMatcher([rule])
const parser = new TypeScriptParser()

const code1 = `Object.assign(target, { __proto__: payload })`
const code2 = `Object.assign(defaults, userConfig)`

Promise.all([
  parser.parse(code1, 'test1.js').then(result => {
    const findings = matcher.findMatches(result.ast)
    console.log('Code 1 (with __proto__):', findings.length, 'findings')
  }),
  parser.parse(code2, 'test2.js').then(result => {
    const findings = matcher.findMatches(result.ast)
    console.log('Code 2 (without __proto__):', findings.length, 'findings')
  })
]).then(() => console.log('Done'))
