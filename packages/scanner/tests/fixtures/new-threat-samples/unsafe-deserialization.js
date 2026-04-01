/**
 * Unsafe Deserialization Threat Sample
 *
 * This sample demonstrates unsafe JSON deserialization vulnerabilities
 * that can lead to prototype pollution and code execution.
 *
 * Severity: High
 * References:
 * - https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse
 * - https://xygeni.io/zh-CN/blog/json-stringify-when-json-stringify-leads-to-insecure-deserialization/
 */

// Example 1: JSON.parse without reviver (High)
function parseUserInput(jsonString) {
  // Vulnerable: No reviver function to sanitize __proto__
  const data = JSON.parse(jsonString)
  return data
}

// Attack: '{"__proto__": {"isAdmin": true}}'
const userInput1 = '{"__proto__": {"admin": true}}'
const parsed1 = parseUserInput(userInput1)

// All objects now have admin property
const emptyObj = {}
console.log(emptyObj.admin) // true (polluted!)

// Example 2: Parsing API response without validation (High)
async function fetchUserData(userId) {
  const response = await fetch(`/api/users/${userId}`)
  const userData = await response.json()

  // Vulnerable: No validation of parsed data
  // Attacker-controlled API response can pollute prototype
  const parsed = JSON.parse(JSON.stringify(userData))

  return parsed
}

// Example 3: Configuration loading from file (High)
const fs = require('fs')

function loadConfig(configPath) {
  const configFile = fs.readFileSync(configPath, 'utf-8')

  // Vulnerable: Config file can pollute prototype
  const config = JSON.parse(configFile)

  return config
}

// Attack: config.json contains {"__proto__": {"debug": true, "disableAuth": true}}

// Example 4: Nested object merging (High)
function deepMerge(target, source) {
  for (const key in source) {
    if (key === '__proto__') {
      // Vulnerable: Direct prototype pollution via JSON data
      target[key] = source[key]
    } else if (typeof source[key] === 'object' && source[key] !== null) {
      if (!target[key]) target[key] = {}
      deepMerge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

const config = {}
const maliciousConfig = JSON.parse('{"settings": {"__proto__": {"bypassAuth": true}}}')
deepMerge(config, maliciousConfig)

// Example 5: JSON.parse in express body parser (High)
const express = require('express')
const app = express()

// Vulnerable: Default body parser doesn't protect against prototype pollution
app.use(express.json())

app.post('/api/update', (req, res) => {
  // Attacker can send: {"__proto__": {"admin": true}}
  // in request body to pollute prototype
  const data = req.body
  res.json({ success: true })
})

// Example 6: Cloning objects with JSON (High)
function cloneObject(obj) {
  // Vulnerable: JSON.parse(JSON.stringify()) doesn't sanitize
  return JSON.parse(JSON.stringify(obj))
}

const malicious = {
  __proto__: {
    polluted: true
  }
}

const cloned = cloneObject(malicious)
// Prototype polluted!

// Example 7: Parsing stored data (High)
function restoreSession(sessionString) {
  // Vulnerable: Session data can pollute prototype
  const session = JSON.parse(sessionString)
  return session
}

// Attack: Session stored in localStorage contains __proto__

// Example 8: Real-world scenario - merge user preferences
function updateUserPreferences(defaultPrefs, userPrefsString) {
  const userPrefs = JSON.parse(userPrefsString)

  // Vulnerable: User preferences can pollute prototype
  const merged = { ...defaultPrefs, ...userPrefs }

  return merged
}

const defaultPrefs = {
  theme: 'light',
  language: 'en'
}

// Attack: '{"__proto__": {"isAdmin": true}}'
const maliciousPrefs = '{"__proto__": {"isAdmin": true}}'
updateUserPreferences(defaultPrefs, maliciousPrefs)

// Example 9: WebSocket message parsing (High)
const WebSocket = require('ws')

const wss = new WebSocket.Server({ port: 8080 })

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    // Vulnerable: WebSocket messages can pollute prototype
    const message = JSON.parse(data)

    if (message.type === 'update') {
      // Process update
    }
  })

  // Attack: Client sends '{"__proto__": {"admin": true}}'
})

// Example 10: JSON.parse with dynamic keys (High)
function parseNested(jsonString) {
  const data = JSON.parse(jsonString)

  // Vulnerable: Iterating over keys includes __proto__
  for (const key in data) {
    global[key] = data[key]
  }

  return data
}

// Attack: '{"__proto__": {"maliciousFunction": "..."}}'
const maliciousData = '{"__proto__": {"eval": "malicious code"}}'
parseNested(maliciousData)

module.exports = {
  parseUserInput,
  fetchUserData,
  loadConfig,
  deepMerge,
  cloneObject,
  restoreSession,
  updateUserPreferences,
  parseNested
}
