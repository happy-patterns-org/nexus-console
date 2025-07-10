import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'src/**/*.d.ts',
        'src/__tests__/**',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/types/**',
        'vite.config.ts',
        'vitest.config.ts'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    },
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'build']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@core': resolve(__dirname, './src/core'),
      '@transport': resolve(__dirname, './src/transport'),
      '@filesystem': resolve(__dirname, './src/filesystem'),
      '@security': resolve(__dirname, './src/security'),
      '@cache': resolve(__dirname, './src/cache'),
      '@ui': resolve(__dirname, './src/ui'),
      '@business-org/shared-config-ts': resolve(__dirname, '../shared-config/packages/shared-config-ts/src/index'),
      '@business-org/shared-config-ts/console-types': resolve(__dirname, '../shared-config/packages/shared-config-ts/src/console-types')
    }
  }
});
