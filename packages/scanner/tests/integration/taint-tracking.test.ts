/**
 * Integration Tests for Taint Tracking (Phase 3.7)
 *
 * End-to-end taint tracking validation with real scanner integration
 *
 * Tests expanded taint sources:
 * - Environment variables (process.env)
 * - File reads from sensitive paths (.env, config files)
 * - DOM sources (location.search, document.URL, document.cookie)
 * - Path traversal sinks (fs operations with tainted paths)
 *
 * Uses real scanner integration (not mocks) to verify complete data flow analysis.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { createScanner } from '../../src/factory.js'
import { ScanResult } from '../../src/types.js'

describe('Taint Tracking Integration Tests', () => {
  let scanner: any

  beforeAll(async () => {
    // Create real scanner instance with all dependencies
    // Note: AI disabled for pure taint tracking tests
    scanner = await createScanner({
      aiEnabled: false,
      cacheEnabled: false,
    })
  })

  describe('Environment Variable Taint Sources', () => {
    /**
     * Test 1: process.env flows to eval() should be tainted
     */
    it('should detect process.env flowing to eval() - tainted', async () => {
      const code = `
        function executeCommand() {
          const cmd = process.env.USER_COMMAND;
          eval(cmd);
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should find at least one critical/high finding for eval with tainted data
      const evalFindings = result.findings.filter(
        f => f.message.includes('eval') && (f.severity === 'critical' || f.severity === 'high')
      )

      expect(evalFindings.length).toBeGreaterThan(0)
      expect(evalFindings[0].ruleId).toBeDefined()
    })

    /**
     * Test 2: process.env flows to fetch() should be tainted
     */
    it('should detect process.env flowing to fetch() - tainted', async () => {
      const code = `
        function sendToApi() {
          const apiUrl = process.env.API_ENDPOINT;
          fetch(apiUrl, { method: 'POST' });
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should find at least one high finding for fetch with tainted data
      const fetchFindings = result.findings.filter(
        f => f.message.includes('fetch') && f.severity === 'high'
      )

      expect(fetchFindings.length).toBeGreaterThan(0)
    })

    /**
     * Test 3: process.env flows to child_process.exec should be tainted
     */
    it('should detect process.env flowing to child_process.exec - tainted', async () => {
      const code = `
        const exec = require('child_process').exec;
        function runEnvCommand() {
          const command = process.env.EXEC_CMD;
          exec(command);
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should find at least one critical finding for exec with tainted data
      const execFindings = result.findings.filter(
        f => f.message.includes('exec') && f.severity === 'critical'
      )

      expect(execFindings.length).toBeGreaterThan(0)
    })
  })

  describe('File Read Taint Sources', () => {
    /**
     * Test 4: fs.readFile from .env flows to fetch() should be tainted
     */
    it('should detect fs.readFile from .env flowing to fetch() - tainted', async () => {
      const code = `
        const fs = require('fs');
        function loadAndSend() {
          fs.readFile('.env', 'utf8', (err, data) => {
            const config = JSON.parse(data);
            fetch(config.exfilUrl, { method: 'POST', body: JSON.stringify(config) });
          });
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should find at least one high finding for fetch with data from file read
      const fetchFindings = result.findings.filter(
        f => f.message.includes('fetch') && f.severity === 'high'
      )

      expect(fetchFindings.length).toBeGreaterThan(0)
    })

    /**
     * Test 5: Safe file reads (package.json to console.log) should not be tainted
     */
    it('should not flag safe file reads (package.json to console.log)', async () => {
      const code = `
        const fs = require('fs');
        function readPackage() {
          fs.readFile('package.json', 'utf8', (err, data) => {
            if (err) throw err;
            console.log(data); // Safe: just logging, not eval/exec
          });
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // console.log is NOT a dangerous sink, so no critical/high findings expected
      const dangerousFindings = result.findings.filter(
        f => f.severity === 'critical' || f.severity === 'high'
      )

      expect(dangerousFindings.length).toBe(0)
    })

    /**
     * Test 6: fs.readFile from config.json flows to eval() should be tainted
     */
    it('should detect fs.readFile from config.json flowing to eval() - tainted', async () => {
      const code = `
        const fs = require('fs');
        function loadAndExecute() {
          fs.readFile('config.json', 'utf8', (err, data) => {
            if (err) throw err;
            eval(data);
          });
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should find at least one critical finding for eval with data from file read
      const evalFindings = result.findings.filter(
        f => f.message.includes('eval') && f.severity === 'critical'
      )

      expect(evalFindings.length).toBeGreaterThan(0)
    })
  })

  describe('DOM XSS Taint Sources', () => {
    /**
     * Test 7: location.search flows to innerHTML should be tainted
     */
    it('should detect location.search flowing to innerHTML - tainted', async () => {
      const code = `
        function renderQuery() {
          const query = location.search;
          document.getElementById('output').innerHTML = query;
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should find at least one critical finding for innerHTML with DOM source
      const xssFindings = result.findings.filter(
        f => (f.message.includes('innerHTML') || f.message.includes('XSS')) && f.severity === 'critical'
      )

      expect(xssFindings.length).toBeGreaterThan(0)
    })

    /**
     * Test 8: document.URL flows to document.write should be tainted
     */
    it('should detect document.URL flowing to document.write - tainted', async () => {
      const code = `
        function writeUrl() {
          const url = document.URL;
          document.write(url);
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should find at least one critical finding for document.write with DOM source
      const xssFindings = result.findings.filter(
        f => (f.message.includes('document.write') || f.message.includes('XSS')) && f.severity === 'critical'
      )

      expect(xssFindings.length).toBeGreaterThan(0)
    })

    /**
     * Test 9: document.cookie flows to outerHTML should be tainted
     */
    it('should detect document.cookie flowing to outerHTML - tainted', async () => {
      const code = `
        function displayCookie() {
          const cookie = document.cookie;
          document.body.outerHTML = cookie;
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should find at least one critical finding for outerHTML with DOM source
      const xssFindings = result.findings.filter(
        f => (f.message.includes('outerHTML') || f.message.includes('XSS')) && f.severity === 'critical'
      )

      expect(xssFindings.length).toBeGreaterThan(0)
    })
  })

  describe('Path Traversal Sink Validation', () => {
    /**
     * Test 10: User input flows to fs.readFile should be tainted
     */
    it('should detect user input flowing to fs.readFile - tainted', async () => {
      const code = `
        const fs = require('fs');
        function readUserFile(filename) {
          fs.readFile(filename, 'utf8', (err, data) => {
            console.log(data);
          });
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should find at least one high finding for fs.readFile with user input
      const pathFindings = result.findings.filter(
        f => f.message.includes('fs.readFile') && f.severity === 'high'
      )

      expect(pathFindings.length).toBeGreaterThan(0)
    })

    /**
     * Test 11: User input flows to fs.writeFile should be tainted
     */
    it('should detect user input flowing to fs.writeFile - tainted', async () => {
      const code = `
        const fs = require('fs');
        function saveUserFile(filename, content) {
          fs.writeFile(filename, content, (err) => {
            if (err) console.error(err);
          });
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should find at least one high finding for fs.writeFile with user input
      const pathFindings = result.findings.filter(
        f => f.message.includes('fs.writeFile') && f.severity === 'high'
      )

      expect(pathFindings.length).toBeGreaterThan(0)
    })

    /**
     * Test 12: Safe hardcoded paths to fs operations should not be tainted
     */
    it('should not flag safe hardcoded paths to fs operations', async () => {
      const code = `
        const fs = require('fs');
        function readConfig() {
          fs.readFile('/etc/app/config.json', 'utf8', (err, data) => {
            console.log(data);
          });
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Hardcoded string literal is not tainted, so no findings expected
      // Note: May still flag fs.readFile usage, but not as high/critical severity
      const dangerousFindings = result.findings.filter(
        f => f.severity === 'critical' || f.severity === 'high'
      )

      // For safe hardcoded paths, we expect 0 critical/high findings
      expect(dangerousFindings.length).toBe(0)
    })
  })

  describe('Combined Taint Scenarios', () => {
    /**
     * Test 13: Multiple taint sources in same function
     */
    it('should detect multiple taint sources in same function', async () => {
      const code = `
        const fs = require('fs');
        function multiTaint(userInput, filename) {
          eval(userInput); // parameter taint
          fs.readFile(process.env.CONFIG_FILE, 'utf8', (err, data) => { // env taint
            fetch(location.search); // dom taint
          });
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should detect multiple taint flows
      const criticalFindings = result.findings.filter(f => f.severity === 'critical')
      const highFindings = result.findings.filter(f => f.severity === 'high')

      expect(criticalFindings.length + highFindings.length).toBeGreaterThan(2)
    })

    /**
     * Test 14: Chained taint through multiple variables
     */
    it('should detect chained taint through multiple variables', async () => {
      const code = `
        function executeEnvCommand() {
          const cmd = process.env.COMMAND;
          const actualCmd = cmd;
          const finalCmd = actualCmd;
          eval(finalCmd);
        }
      `

      const result: ScanResult = await scanner.scan(code, 'test.js')

      // Should detect that process.env flows through variables to eval
      const evalFindings = result.findings.filter(
        f => f.message.includes('eval') && f.severity === 'critical'
      )

      expect(evalFindings.length).toBeGreaterThan(0)
    })
  })
})
