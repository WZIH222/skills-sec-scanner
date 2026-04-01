/**
 * Prisma client singleton for Next.js app
 *
 * Exports a global Prisma client instance to avoid
 * multiple connections in development (hot reloading)
 *
 * Full implementation in Plan 03-01
 */

import { PrismaClient } from '@prisma/client';

// Declare global prisma variable (for Next.js hot reloading)
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Export Prisma client singleton
export const prisma = global.prisma || new PrismaClient();

// In development, attach to global to prevent multiple instances
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
