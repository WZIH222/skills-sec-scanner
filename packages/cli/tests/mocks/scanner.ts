/**
 * Mock Scanner for Testing
 *
 * Provides a mock scanner implementation for testing without
 * requiring real database, Redis, or AI dependencies.
 */

import type { ScanResult, ScanOptions, Finding } from '@skills-sec/scanner'

export class MockScanner {
  constructor(private mockFindings: Finding[] = []) {}

  /**
   * Mock scan method that returns predetermined results
   *
   * @param content - File content (ignored in mock)
   * @param filename - Filename (ignored in mock)
   * @param options - Scan options (ignored in mock)
   * @returns Mock scan result
   */
  async scan(
    content: string,
    filename: string,
    options?: ScanOptions
  ): Promise<ScanResult> {
    // Simulate minimal delay
    await new Promise(resolve => setTimeout(resolve, 10))

    return {
      findings: this.mockFindings,
      score: this.mockFindings.length * 10,
      metadata: {
        scannedAt: new Date(),
        scanDuration: 100,
      },
    }
  }
}

export function createMockScanner(findings: Finding[] = []): MockScanner {
  return new MockScanner(findings)
}
