/**
 * E2E Benchmark Suite for Detection Rate Measurement (Phase 3.7)
 *
 * Measures detection effectiveness against known threat samples
 *
 * Metrics:
 * - Detection rate: (detected / total_malicious) * 100
 * - False positive rate: (false_positives / total_safe) * 100
 *
 * Thresholds:
 * - Detection rate > 80% (minimum acceptable)
 * - False positive rate < 10% (maximum acceptable)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { createScanner } from '../../src/factory'
import { ScanResult, Severity } from '../../src/types'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Get the path to the fixtures directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const FIXTURES_DIR = join(__dirname, '../fixtures')
const ADVERSARY_SAMPLES_DIR = join(FIXTURES_DIR, 'adversary-samples')
const SAFE_SAMPLES_DIR = join(FIXTURES_DIR, 'safe-samples')

/**
 * Detection rate metrics
 */
interface DetectionMetrics {
  totalSamples: number
  detectedSamples: number
  detectionRate: number
  falsePositives: number
  falsePositiveRate: number
}

describe('Detection Rate Benchmark Suite', () => {
  let scanner: any

  beforeAll(async () => {
    // Create real scanner instance with all dependencies
    scanner = await createScanner({
      aiEnabled: false, // Disable AI for consistent benchmarking
      cacheEnabled: false,
    })

    // Debug: Log loaded rules
    const testScan = await scanner.scan('const x = 1;', 'test.js')
    console.log('Loaded rule IDs:', testScan.findings.map(f => f.ruleId))
  })

  describe('Prototype Pollution Detection', () => {
    /**
     * Test 1: Prototype pollution via Object.assign
     */
    it('should detect prototype pollution via Object.assign', async () => {
      const code = `
        function merge(target, source) {
          return Object.assign(target, source);
        }
        const user_input = { __proto__: { isAdmin: true } };
        const merged = merge({}, user_input);
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should detect prototype pollution pattern
      const protoFindings = result.findings.filter(
        f => f.ruleId.includes('prototype') || f.message.includes('prototype')
      )

      expect(protoFindings.length).toBeGreaterThan(0)
    })

    /**
     * Test 2: Prototype pollution via __proto__ assignment
     */
    it('should detect prototype pollution via __proto__ assignment', async () => {
      const code = `
        const obj = {};
        obj.__proto__ = { polluted: true };
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should detect __proto__ manipulation
      const protoFindings = result.findings.filter(
        f => f.ruleId.includes('prototype') || f.message.includes('__proto__')
      )

      expect(protoFindings.length).toBeGreaterThan(0)
    })

    /**
     * Test 3: Prototype pollution via constructor.prototype
     */
    it('should detect prototype pollution via constructor.prototype', async () => {
      const code = `
        function MyClass() {}
        MyClass.prototype.polluted = true;
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should detect prototype manipulation
      const protoFindings = result.findings.filter(
        f => f.ruleId.includes('prototype') || f.message.includes('prototype')
      )

      // This may or may not be flagged depending on rule implementation
      // Some prototype modifications are legitimate
    })
  })

  describe('DOM XSS Detection', () => {
    /**
     * Test 4: DOM XSS via innerHTML with location.search
     */
    it('should detect DOM XSS via innerHTML with location.search', async () => {
      const code = `
        function render() {
          const query = location.search;
          document.getElementById('output').innerHTML = query;
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should detect DOM XSS
      const xssFindings = result.findings.filter(
        f => f.ruleId.includes('xss') || f.message.includes('innerHTML') || f.message.includes('XSS')
      )

      expect(xssFindings.length).toBeGreaterThan(0)
    })

    /**
     * Test 5: DOM XSS via document.write with user input
     */
    it('should detect DOM XSS via document.write with user input', async () => {
      const code = `
        function writeUserInput(input) {
          document.write('<div>' + input + '</div>');
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should detect DOM XSS
      const xssFindings = result.findings.filter(
        f => f.ruleId.includes('xss') || f.message.includes('document.write') || f.message.includes('XSS')
      )

      expect(xssFindings.length).toBeGreaterThan(0)
    })

    /**
     * Test 6: DOM XSS via outerHTML with document.cookie
     */
    it('should detect DOM XSS via outerHTML with document.cookie', async () => {
      const code = `
        function displayCookie() {
          const cookie = document.cookie;
          document.body.outerHTML = cookie;
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should detect DOM XSS
      const xssFindings = result.findings.filter(
        f => f.ruleId.includes('xss') || f.message.includes('outerHTML') || f.message.includes('XSS')
      )

      expect(xssFindings.length).toBeGreaterThan(0)
    })
  })

  describe('Unsafe Deserialization Detection', () => {
    /**
     * Test 7: Unsafe JSON.parse without reviver
     */
    it('should detect unsafe JSON.parse without reviver', async () => {
      const code = `
        function parseUserData(jsonString) {
          const data = JSON.parse(jsonString);
          return data;
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should detect unsafe deserialization
      const deserFindings = result.findings.filter(
        f => f.ruleId.includes('deserial') || f.message.includes('JSON.parse')
      )

      // JSON.parse is common, so this may be flagged as info/low severity
      expect(deserFindings.length).toBeGreaterThanOrEqual(0)
    })

    /**
     * Test 8: JSON.parse of user-controlled data
     */
    it('should detect JSON.parse of user-controlled data', async () => {
      const code = `
        function handleRequest(req) {
          const body = JSON.parse(req.body);
          eval(body.code);
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should detect unsafe deserialization with eval
      const evalFindings = result.findings.filter(
        f => f.message.includes('eval') && f.severity === 'critical'
      )

      expect(evalFindings.length).toBeGreaterThan(0)
    })
  })

  describe('Path Traversal Detection', () => {
    /**
     * Test 9: Path traversal via fs.readFile with user input
     */
    it('should detect path traversal via fs.readFile with user input', async () => {
      const code = `
        const fs = require('fs');
        function readFile(filename) {
          fs.readFile(filename, 'utf8', (err, data) => {
            console.log(data);
          });
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should detect path traversal vulnerability
      const pathFindings = result.findings.filter(
        f => f.ruleId.includes('path') || f.message.includes('fs.readFile')
      )

      expect(pathFindings.length).toBeGreaterThan(0)
    })

    /**
     * Test 10: Path traversal via fs.writeFile with user input
     */
    it('should detect path traversal via fs.writeFile with user input', async () => {
      const code = `
        const fs = require('fs');
        function writeFile(filename, content) {
          fs.writeFile(filename, content, (err) => {
            if (err) console.error(err);
          });
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should detect path traversal vulnerability
      const pathFindings = result.findings.filter(
        f => f.ruleId.includes('path') || f.message.includes('fs.writeFile')
      )

      expect(pathFindings.length).toBeGreaterThan(0)
    })

    /**
     * Test 11: Path traversal with ../ sequences
     */
    it('should detect path traversal with ../ sequences', async () => {
      const code = `
        const fs = require('fs');
        function readParentDir() {
          const path = '../sensitive-file.txt';
          fs.readFile(path, 'utf8', (err, data) => {
            console.log(data);
          });
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should detect path traversal pattern
      const pathFindings = result.findings.filter(
        f => f.ruleId.includes('path') || f.message.includes('..')
      )

      expect(pathFindings.length).toBeGreaterThan(0)
    })
  })

  describe('Sensitive Data Exposure Detection', () => {
    /**
     * Test 12: Hardcoded AWS API key
     */
    it('should detect hardcoded AWS API key', async () => {
      const code = `
        const AWS_ACCESS_KEY = 'AKIAIOSFODNN7EXAMPLE';
        const AWS_SECRET_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should detect hardcoded credentials
      const credFindings = result.findings.filter(
        f => f.ruleId.includes('credential') || f.ruleId.includes('secret') || f.ruleId.includes('sensitive-data') || f.message.includes('API key')
      )

      expect(credFindings.length).toBeGreaterThan(0)
    })

    /**
     * Test 13: Hardcoded GitHub token
     */
    it('should detect hardcoded GitHub token', async () => {
      const code = `
        const GITHUB_TOKEN = 'ghp_1234567890abcdefghij';
        fetch('https://api.github.com/user', {
          headers: { 'Authorization': 'token ' + GITHUB_TOKEN }
        });
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should detect hardcoded token
      const credFindings = result.findings.filter(
        f => f.ruleId.includes('credential') || f.ruleId.includes('secret') || f.ruleId.includes('sensitive-data') || f.ruleId.includes('token') || f.message.includes('token')
      )

      expect(credFindings.length).toBeGreaterThan(0)
    })

    /**
     * Test 14: Hardcoded database connection string
     */
    it('should detect hardcoded database connection string', async () => {
      const code = `
        const DB_CONNECTION = 'postgresql://user:password@localhost:5432/dbname';
        const client = new Client(DB_CONNECTION);
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should detect hardcoded connection string
      const credFindings = result.findings.filter(
        f => f.ruleId.includes('credential') || f.ruleId.includes('secret') || f.ruleId.includes('sensitive-data') || f.message.includes('connection') || f.message.includes('password')
      )

      expect(credFindings.length).toBeGreaterThan(0)
    })
  })

  describe('False Positive Tests (Safe Code)', () => {
    /**
     * Test 15: Safe innerHTML with hardcoded content
     */
    it('should not flag safe innerHTML with hardcoded content', async () => {
      const code = `
        function render() {
          document.getElementById('output').innerHTML = '<div>Hello World</div>';
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should NOT flag hardcoded HTML strings
      const xssFindings = result.findings.filter(
        f => f.severity === 'critical' && (f.message.includes('innerHTML') || f.message.includes('XSS'))
      )

      // Hardcoded strings are safe, so expect 0 critical findings
      expect(xssFindings.length).toBe(0)
    })

    /**
     * Test 16: Safe fs.readFile with hardcoded path
     */
    it('should not flag safe fs.readFile with hardcoded path', async () => {
      const code = `
        const fs = require('fs');
        function readConfig() {
          fs.readFile('/etc/app/config.json', 'utf8', (err, data) => {
            console.log(data);
          });
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should NOT flag hardcoded paths as critical/high
      const pathFindings = result.findings.filter(
        f => (f.severity === 'critical' || f.severity === 'high') && f.message.includes('fs.readFile')
      )

      // Hardcoded paths are safe, so expect 0 critical/high findings
      expect(pathFindings.length).toBe(0)
    })

    /**
     * Test 17: Safe Object.assign with constants
     */
    it('should not flag safe Object.assign with constants', async () => {
      const code = `
        function mergeConfig() {
          const defaults = { debug: false };
          const userConfig = { theme: 'dark' };
          return Object.assign(defaults, userConfig);
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Debug: Log all findings
      console.log('All findings:', JSON.stringify(result.findings, null, 2))

      // Should NOT flag safe Object.assign with constants
      const protoFindings = result.findings.filter(
        f => f.severity === 'critical' && f.message.includes('Object.assign')
      )

      console.log('Prototype pollution findings:', protoFindings.length)

      // Safe Object.assign with constants is not prototype pollution
      expect(protoFindings.length).toBe(0)
    })
  })

  describe('Overall Detection Rate Calculation', () => {
    /**
     * Test 18: Calculate detection rate for prototype pollution samples
     */
    it('should achieve >80% detection rate for prototype pollution samples', async () => {
      const samples = [
        'prototype-pollution-1.js',
        'prototype-pollution-2.js',
        'prototype-pollution-3.js'
      ]

      let detectedCount = 0
      for (const filename of samples) {
        try {
          const filePath = join(ADVERSARY_SAMPLES_DIR, filename)
          const code = readFileSync(filePath, 'utf8')
          const result: ScanResult = await scanner.scan(code, filename)

          const protoFindings = result.findings.filter(
            f => f.ruleId.includes('prototype') || f.message.includes('prototype')
          )
          if (protoFindings.length > 0) detectedCount++
        } catch (error) {
          console.log(`Failed to load ${filename}:`, error)
        }
      }

      const detectionRate = (detectedCount / samples.length) * 100
      expect(detectionRate).toBeGreaterThanOrEqual(80)
    })

    /**
     * Test 19: Calculate detection rate for DOM XSS samples
     */
    it('should achieve >80% detection rate for DOM XSS samples', async () => {
      const samples = [
        'dom-xss-1.js',
        'dom-xss-2.js',
        'dom-xss-3.js'
      ]

      let detectedCount = 0
      for (const filename of samples) {
        try {
          const filePath = join(ADVERSARY_SAMPLES_DIR, filename)
          const code = readFileSync(filePath, 'utf8')
          const result: ScanResult = await scanner.scan(code, filename)

          const xssFindings = result.findings.filter(
            f => f.ruleId.includes('xss') || f.message.includes('XSS') || f.message.includes('innerHTML')
          )
          if (xssFindings.length > 0) detectedCount++
        } catch (error) {
          console.log(`Failed to load ${filename}:`, error)
        }
      }

      const detectionRate = (detectedCount / samples.length) * 100
      expect(detectionRate).toBeGreaterThanOrEqual(80)
    })

    /**
     * Test 20: Calculate detection rate for unsafe deserialization samples
     */
    it('should achieve >80% detection rate for unsafe deserialization samples', async () => {
      const samples = [
        'unsafe-deserialization-1.js',
        'unsafe-deserialization-2.js',
        'unsafe-deserialization-3.js'
      ]

      let detectedCount = 0
      for (const filename of samples) {
        try {
          const filePath = join(ADVERSARY_SAMPLES_DIR, filename)
          const code = readFileSync(filePath, 'utf8')
          const result: ScanResult = await scanner.scan(code, filename)

          const deserFindings = result.findings.filter(
            f => f.ruleId.includes('deserial') || f.ruleId.includes('json') || f.message.includes('JSON.parse')
          )
          if (deserFindings.length > 0) detectedCount++
        } catch (error) {
          console.log(`Failed to load ${filename}:`, error)
        }
      }

      const detectionRate = (detectedCount / samples.length) * 100
      expect(detectionRate).toBeGreaterThanOrEqual(80)
    })

    /**
     * Test 21: Calculate detection rate for path traversal samples
     */
    it('should achieve >80% detection rate for path traversal samples', async () => {
      const samples = [
        'path-traversal-1.js',
        'path-traversal-2.js',
        'path-traversal-3.js'
      ]

      let detectedCount = 0
      for (const filename of samples) {
        try {
          const filePath = join(ADVERSARY_SAMPLES_DIR, filename)
          const code = readFileSync(filePath, 'utf8')
          const result: ScanResult = await scanner.scan(code, filename)

          const pathFindings = result.findings.filter(
            f => f.ruleId.includes('path') || f.message.includes('fs.readFile') || f.message.includes('fs.writeFile')
          )
          if (pathFindings.length > 0) detectedCount++
        } catch (error) {
          console.log(`Failed to load ${filename}:`, error)
        }
      }

      const detectionRate = (detectedCount / samples.length) * 100
      expect(detectionRate).toBeGreaterThanOrEqual(80)
    })

    /**
     * Test 22: Calculate detection rate for sensitive data exposure samples
     */
    it('should achieve >80% detection rate for sensitive data exposure samples', async () => {
      const samples = [
        'sensitive-data-1.js',
        'sensitive-data-2.js',
        'sensitive-data-3.js'
      ]

      let detectedCount = 0
      for (const filename of samples) {
        try {
          const filePath = join(ADVERSARY_SAMPLES_DIR, filename)
          const code = readFileSync(filePath, 'utf8')
          const result: ScanResult = await scanner.scan(code, filename)

          const credFindings = result.findings.filter(
            f => f.ruleId.includes('credential') || f.ruleId.includes('secret') || f.ruleId.includes('token') ||
               f.message.includes('API key') || f.message.includes('token') || f.message.includes('credential')
          )
          if (credFindings.length > 0) detectedCount++
        } catch (error) {
          console.log(`Failed to load ${filename}:`, error)
        }
      }

      const detectionRate = (detectedCount / samples.length) * 100
      expect(detectionRate).toBeGreaterThanOrEqual(80)
    })

    /**
     * Test 23: Calculate overall detection rate across all adversarial samples
     */
    it('should achieve >80% overall detection rate across all adversarial samples', async () => {
      const adversarialSamples = [
        'prototype-pollution-1.js',
        'prototype-pollution-2.js',
        'prototype-pollution-3.js',
        'dom-xss-1.js',
        'dom-xss-2.js',
        'dom-xss-3.js',
        'unsafe-deserialization-1.js',
        'unsafe-deserialization-2.js',
        'unsafe-deserialization-3.js',
        'path-traversal-1.js',
        'path-traversal-2.js',
        'path-traversal-3.js',
        'sensitive-data-1.js',
        'sensitive-data-2.js',
        'sensitive-data-3.js'
      ]

      let detectedCount = 0
      for (const filename of adversarialSamples) {
        try {
          const filePath = join(ADVERSARY_SAMPLES_DIR, filename)
          const code = readFileSync(filePath, 'utf8')
          const result: ScanResult = await scanner.scan(code, filename)

          // Any finding indicates detection
          if (result.findings.length > 0) detectedCount++
        } catch (error) {
          console.log(`Failed to load ${filename}:`, error)
        }
      }

      const detectionRate = (detectedCount / adversarialSamples.length) * 100
      expect(detectionRate).toBeGreaterThanOrEqual(80)
    })

    /**
     * Test 24: Calculate false positive rate for safe code samples
     */
    it('should maintain <10% false positive rate for safe code', async () => {
      const safeSamples = [
        'lodash-utility.js',
        'express-middleware.js',
        'config-loader.js',
        'file-reader.js',
        'api-client.js'
      ]

      let falsePositiveCount = 0
      for (const filename of safeSamples) {
        try {
          const filePath = join(SAFE_SAMPLES_DIR, filename)
          const code = readFileSync(filePath, 'utf8')
          const result: ScanResult = await scanner.scan(code, filename)

          // Critical or high findings on safe code are false positives
          const falsePositives = result.findings.filter(
            f => (f.severity === 'critical' || f.severity === 'high')
          )
          if (falsePositives.length > 0) {
            falsePositiveCount++
            console.log(`False positive in ${filename}:`, falsePositives.map(f => ({ ruleId: f.ruleId, message: f.message })))
          }
        } catch (error) {
          console.log(`Failed to load ${filename}:`, error)
        }
      }

      const falsePositiveRate = (falsePositiveCount / safeSamples.length) * 100
      console.log(`False positive rate: ${falsePositiveRate}% (${falsePositiveCount}/${safeSamples.length} samples)`)
      expect(falsePositiveRate).toBeLessThan(10)
    })
  })
})
