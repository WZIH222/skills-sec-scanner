/**
 * Vitest setup file
 */

import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Extend Vitest's expect with jest-dom matchers
import '@testing-library/jest-dom'
