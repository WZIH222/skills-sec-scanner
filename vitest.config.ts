import { defineConfig } from 'vitest/config'

export default defineConfig({
  workspace: [
    {
      test: {
        globals: true,
        environment: 'node',
        coverage: {
          provider: 'v8',
          reporter: ['text', 'json', 'html'],
        },
      },
      resolve: {
        alias: {
          '@': new URL('./src', import.meta.url).pathname,
        },
      },
    },
  ],
})
