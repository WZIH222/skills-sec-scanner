/**
 * Prisma Service - PostgreSQL Database Client
 *
 * Singleton pattern for Prisma client to ensure
 * only one connection pool is used throughout the application.
 */

import { PrismaClient } from '@prisma/client'

/**
 * Prisma Service - Singleton database client
 */
export class PrismaService {
  private static instance: PrismaService
  private prisma: PrismaClient

  private constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PrismaService {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaService()
    }

    return PrismaService.instance
  }

  /**
   * Get Prisma client
   */
  get client(): PrismaClient {
    return this.prisma
  }

  /**
   * Shortcut to access Prisma client directly
   */
  get scan() {
    return this.prisma.scan
  }

  get finding() {
    return this.prisma.finding
  }

  /**
   * Disconnect from database
   */
  async $disconnect(): Promise<void> {
    await this.prisma.$disconnect()
  }

  /**
   * Connect to database
   */
  async $connect(): Promise<void> {
    await this.prisma.$connect()
  }

  /**
   * Health check
   */
  async $health(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`
      return true
    } catch (error) {
      return false
    }
  }
}
