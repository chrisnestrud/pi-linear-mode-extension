import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000, // 30 seconds for API calls
    server: {
      deps: {
        // External dependencies that shouldn't be transformed
        external: [],
      },
    },
  },
});