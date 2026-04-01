/**
 * Benign sample skill - no security issues
 * Should pass all security checks
 */

export function processInput(input: string): string {
  // Simple string manipulation - no security risk
  const trimmed = input.trim();
  const uppercased = trimmed.toUpperCase();
  return uppercased;
}

export function calculateSum(a: number, b: number): number {
  // Simple arithmetic - no security risk
  return a + b;
}

export function formatDate(date: Date): string {
  // Date formatting - no security risk
  return date.toISOString();
}

export function validateLength(text: string, maxLength: number): boolean {
  // Simple validation - no security risk
  return text.length <= maxLength;
}

export const benignConfig = {
  maxRetries: 3,
  timeout: 5000,
  debug: false,
};
