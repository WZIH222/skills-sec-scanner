/**
 * Prototype Pollution Threat Sample
 *
 * This sample demonstrates various prototype pollution vulnerabilities
 * that can lead to Remote Code Execution (RCE) in JavaScript applications.
 *
 * Severity: Critical
 * References:
 * - https://github.com/advisories/GHSA-wf6x-7x77-mvgw
 * - https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2026-29063
 */

// Example 1: Object.assign with user input (Critical)
function mergeConfig(target, source) {
  // Vulnerable: Object.assign can pollute Object.prototype if source contains __proto__
  return Object.assign(target, source)
}

// Attacker-controlled input
const userInput = {
  __proto__: {
    isAdmin: true,
    polluted: true
  }
}

const config = {}
mergeConfig(config, userInput)

// Now all objects have isAdmin property due to prototype pollution
const emptyObject = {}
console.log(emptyObject.isAdmin) // true (polluted!)

// Example 2: Object.merge with __proto__ manipulation (Critical)
function deepMerge(target, source) {
  // Vulnerable: Many merge libraries are vulnerable to prototype pollution
  for (const key in source) {
    if (key === '__proto__' || key === 'constructor') {
      // Direct prototype pollution
      target[key] = source[key]
    } else if (typeof source[key] === 'object' && source[key] !== null) {
      target[key] = deepMerge(target[key] || {}, source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

// Example 3: Constructor.prototype manipulation (Critical)
function setProperty(obj, key, value) {
  // Vulnerable: Setting constructor.prototype affects all objects
  if (key === 'constructor' && value.prototype) {
    obj.constructor.prototype = value.prototype
  }
  obj[key] = value
}

// Example 4: Merge function vulnerability
const merge = (a, b) => {
  // Vulnerable: No sanitization of special properties
  for (const key in b) {
    a[key] = b[key]
  }
  return a
}

const base = {}
const malicious = {
  __proto__: {
    toString: () => 'POLLUTED'
  }
}

merge(base, malicious)

// Example 5: Real-world scenario - configuration merging
const defaultConfig = {
  port: 3000,
  host: 'localhost'
}

const userConfig = JSON.parse('{"__proto__": {"authenticated": true}}')

const finalConfig = Object.assign({}, defaultConfig, userConfig)

// Check authentication (bypassed via prototype pollution)
const user = {}
if (user.authenticated) {
  console.log('Access granted - prototype pollution bypass!')
}

module.exports = {
  mergeConfig,
  deepMerge,
  setProperty,
  merge
}
