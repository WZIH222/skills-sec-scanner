/**
 * Fix ESM import extensions in TypeScript emitted files
 *
 * TypeScript doesn't add .js extensions to relative import paths with ESM.
 * Node.js ESM requires explicit extensions. This script post-processes
 * the TypeScript output to fix import statements.
 *
 * Handles three cases:
 * 1. './foo' where foo is a directory -> './foo/index.js'
 * 2. './foo' where foo.js exists -> './foo.js'
 * 3. './foo/bar' where foo.js exists -> './foo.js/bar'
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'dist')

function isDirectory(filePath) {
  try {
    return statSync(filePath).isDirectory()
  } catch {
    return false
  }
}

function resolveImportPath(importPath, filePath) {
  // Get the directory of the current file
  const fileDir = dirname(filePath)
  // Resolve the import path relative to the file's directory
  const resolved = join(fileDir, importPath)

  // Check various possible targets
  const normalized = resolved.replace(/\\/g, '/')

  // Case 1: It's a directory - need /index.js
  if (isDirectory(resolved)) {
    return importPath + '/index.js'
  }

  // Case 2: It's a file with .js extension already
  if (existsSync(resolved + '.js')) {
    return importPath + '.js'
  }

  // Case 3: It's already correct (has extension)
  if (importPath.endsWith('.js') || importPath.endsWith('.ts')) {
    return importPath
  }

  // Case 4: Check if the last segment is a directory
  const lastSlash = importPath.lastIndexOf('/')
  if (lastSlash > 0) {
    const basePath = importPath.substring(0, lastSlash)
    const name = importPath.substring(lastSlash + 1)
    const baseResolved = join(fileDir, basePath)

    if (isDirectory(baseResolved)) {
      // basePath is a directory, check if name is a subdirectory
      const subPath = join(baseResolved, name)
      if (isDirectory(subPath)) {
        return importPath + '/index.js'
      }
      if (existsSync(subPath + '.js')) {
        return importPath + '.js'
      }
    }
  }

  // Default: just append .js
  return importPath + '.js'
}

function processFile(filePath) {
  let content = readFileSync(filePath, 'utf-8')
  let modified = false

  // Match: from './foo' or from "./foo" or from '../foo/bar'
  // But NOT: from './foo.js' or from 'https://...'
  const importPattern = /from\s+['"]((?:\.\/|\.\.\/)(?:[^'"]*?))['"]/g

  // Also match: await import('./foo') or await import("./foo")
  const dynamicImportPattern = /await\s+import\s*\(["']((?:\.\/|\.\.\/)(?:[^'"]*?))['"]\)/g

  const newContent = content.replace(importPattern, (match, importPath) => {
    // Skip if already has extension or is a URL
    if (
      importPath.endsWith('.js') ||
      importPath.endsWith('.mjs') ||
      importPath.endsWith('.cjs') ||
      importPath.endsWith('.ts') ||
      importPath.includes(':') // URLs
    ) {
      return match
    }

    // Skip node built-ins
    if (importPath.startsWith('node:')) {
      return match
    }

    // Resolve the correct path
    const fixedPath = resolveImportPath(importPath, filePath)

    if (fixedPath !== importPath) {
      modified = true
      return match.replace(importPath, fixedPath)
    }

    return match
  }).replace(dynamicImportPattern, (match, importPath) => {
    // Skip if already has extension or is a URL
    if (
      importPath.endsWith('.js') ||
      importPath.endsWith('.mjs') ||
      importPath.endsWith('.cjs') ||
      importPath.endsWith('.ts') ||
      importPath.includes(':') // URLs
    ) {
      return match
    }

    // Skip node built-ins
    if (importPath.startsWith('node:')) {
      return match
    }

    // Resolve the correct path
    const fixedPath = resolveImportPath(importPath, filePath)

    if (fixedPath !== importPath) {
      modified = true
      return match.replace(importPath, fixedPath)
    }

    return match
  })

  if (modified) {
    writeFileSync(filePath, newContent, 'utf-8')
    console.log(`Fixed: ${relative(distDir, filePath)}`)
  }
}

function walkDir(dir) {
  const entries = readdirSync(dir)
  for (const entry of entries) {
    // Skip node_modules and map files
    if (entry === 'node_modules' || entry.endsWith('.map')) continue

    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      walkDir(fullPath)
    } else if (entry.endsWith('.js') && !entry.endsWith('.map')) {
      processFile(fullPath)
    }
  }
}

console.log('Fixing ESM extensions in:', distDir)
walkDir(distDir)
console.log('Done!')
