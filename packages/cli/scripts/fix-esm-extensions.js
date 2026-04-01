/**
 * Fix ESM import extensions in TypeScript emitted files
 *
 * TypeScript doesn't add .js extensions to relative import paths with ESM.
 * Node.js ESM requires explicit extensions. This script post-processes
 * the TypeScript output to fix import statements.
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
  const fileDir = dirname(filePath)
  const resolved = join(fileDir, importPath)
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

  // Default: just append .js
  return importPath + '.js'
}

function processFile(filePath) {
  let content = readFileSync(filePath, 'utf-8')
  let modified = false

  const importPattern = /from\s+['"]((?:\.\/|\.\.\/)(?:[^'"]*?))['"]/g

  const newContent = content.replace(importPattern, (match, importPath) => {
    if (
      importPath.endsWith('.js') ||
      importPath.endsWith('.mjs') ||
      importPath.endsWith('.cjs') ||
      importPath.endsWith('.ts') ||
      importPath.includes(':')
    ) {
      return match
    }

    if (importPath.startsWith('node:')) {
      return match
    }

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
