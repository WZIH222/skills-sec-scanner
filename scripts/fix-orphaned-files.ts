/**
 * Fix orphaned child files
 *
 * This script identifies and fixes child files that have null parentId
 * but should belong to a parent folder scan.
 *
 * Usage: npx ts-node scripts/fix-orphaned-files.ts
 */

import { PrismaClient } from '@skills-sec/database'

const prisma = new PrismaClient()

async function fixOrphanedFiles() {
  console.log('Checking for orphaned child files...')

  // Find all scans marked as 'file' type in metadata
  const allScans = await prisma.scan.findMany({
    select: {
      id: true,
      filename: true,
      parentId: true,
      metadata: true,
      scannedAt: true,
    },
    orderBy: { scannedAt: 'desc' },
  })

  let fixedCount = 0
  let orphanCount = 0

  for (const scan of allScans) {
    const metadata = scan.metadata ? JSON.parse(scan.metadata) : {}

    // Skip folder scans and standalone files
    if (metadata.type === 'folder') {
      continue
    }

    // Check if this looks like a child file (has folder-like naming pattern)
    // but has null parentId
    if (!scan.parentId) {
      const filename = scan.filename

      // Patterns that suggest this is a child file from a folder scan:
      // 1. fileId starts with "folder-" followed by another ID
      // 2. fileId format: ${parentId}-${filename}
      if (scan.fileId && scan.fileId.includes('-')) {
        const parts = scan.fileId.split('-')
        if (parts.length >= 2 && parts[0].startsWith('folder')) {
          // This might be a child file - extract potential parent ID
          const possibleParentId = parts[0]

          // Check if parent exists
          const parent = await prisma.scan.findFirst({
            where: {
              id: possibleParentId,
              metadata: { contains: '"type":"folder"' },
            },
          })

          if (parent) {
            console.log(`Found orphan: ${scan.filename} (${scan.id})`)
            console.log(`  Possible parent: ${parent.filename} (${parent.id})`)

            // Update parentId
            await prisma.scan.update({
              where: { id: scan.id },
              data: { parentId: parent.id },
            })

            console.log(`  ✓ Fixed: set parentId to ${parent.id}`)
            fixedCount++
          } else {
            orphanCount++
          }
        }
      }
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Orphaned files found: ${orphanCount}`)
  console.log(`Files fixed: ${fixedCount}`)

  if (fixedCount > 0) {
    console.log('\n✅ Fixed orphaned child files')
  } else {
    console.log('\n✓ No orphaned files found (or all already fixed)')
  }
}

async function main() {
  try {
    await fixOrphanedFiles()
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
