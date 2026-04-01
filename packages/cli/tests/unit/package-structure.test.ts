/**
 * Unit tests for CLI package structure and configuration
 *
 * Tests verify:
 * - package.json has correct bin field
 * - Dependencies are properly declared
 * - TypeScript configuration is valid
 * - Entry point has shebang header
 * - Commander.js program is properly configured
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

describe('CLI Package Structure', () => {
  const cliRoot = join(__dirname, '../..')
  const packageJsonPath = join(cliRoot, 'package.json')
  const tsconfigPath = join(cliRoot, 'tsconfig.json')
  const indexPath = join(cliRoot, 'src/index.ts')

  describe('package.json', () => {
    it('should exist', () => {
      expect(existsSync(packageJsonPath)).toBe(true)
    })

    it('should have bin field pointing to ./dist/index.js', () => {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      expect(pkg.bin).toBeDefined()
      expect(pkg.bin['s3-cli']).toBe('./dist/index.js')
    })

    it('should declare dependency on @skills-sec/scanner workspace:*', () => {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      expect(pkg.dependencies).toBeDefined()
      expect(pkg.dependencies['@skills-sec/scanner']).toBeDefined()
    })

    it('should include commander dependency', () => {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      expect(pkg.dependencies).toBeDefined()
      expect(pkg.dependencies['commander']).toBeDefined()
    })

    it('should include chalk dependency', () => {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      expect(pkg.dependencies).toBeDefined()
      expect(pkg.dependencies['chalk']).toBeDefined()
    })

    it('should include ora dependency', () => {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      expect(pkg.dependencies).toBeDefined()
      expect(pkg.dependencies['ora']).toBeDefined()
    })

    it('should include js-yaml dependency', () => {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      expect(pkg.dependencies).toBeDefined()
      expect(pkg.dependencies['js-yaml']).toBeDefined()
    })
  })

  describe('tsconfig.json', () => {
    it('should exist', () => {
      expect(existsSync(tsconfigPath)).toBe(true)
    })

    it('should have proper outDir and rootDir', () => {
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'))
      expect(tsconfig.compilerOptions).toBeDefined()
      expect(tsconfig.compilerOptions.outDir).toBe('./dist')
      expect(tsconfig.compilerOptions.rootDir).toBe('./src')
    })

    it('should include src directory', () => {
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'))
      expect(tsconfig.include).toBeDefined()
      expect(tsconfig.include).toContain('src/**/*')
    })
  })

  describe('src/index.ts', () => {
    it('should exist', () => {
      expect(existsSync(indexPath)).toBe(true)
    })

    it('should have shebang header', () => {
      const content = readFileSync(indexPath, 'utf-8')
      expect(content.startsWith('#!/usr/bin/env node')).toBe(true)
    })

    it('should create Commander.js program', () => {
      const content = readFileSync(indexPath, 'utf-8')
      expect(content).toContain(".name('s3-cli')")
      expect(content).toContain(".description")
    })
  })
})
