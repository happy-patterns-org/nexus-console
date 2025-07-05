import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'NexusConsole',
      formats: ['es', 'umd'],
      fileName: (format) => `nexus-console.${format}.js`
    },
    rollupOptions: {
      external: ['xterm', 'xterm-addon-fit', 'xterm-addon-webgl', 'xterm-addon-search', 'xterm-addon-serialize', 'xterm-addon-unicode11'],
      output: {
        globals: {
          'xterm': 'Terminal',
          'xterm-addon-fit': 'FitAddon',
          'xterm-addon-webgl': 'WebglAddon',
          'xterm-addon-search': 'SearchAddon',
          'xterm-addon-serialize': 'SerializeAddon',
          'xterm-addon-unicode11': 'Unicode11Addon'
        }
      }
    },
    sourcemap: true,
    minify: 'terser'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@core': resolve(__dirname, './src/core'),
      '@transport': resolve(__dirname, './src/transport'),
      '@filesystem': resolve(__dirname, './src/filesystem'),
      '@security': resolve(__dirname, './src/security'),
      '@cache': resolve(__dirname, './src/cache'),
      '@ui': resolve(__dirname, './src/ui')
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/terminal/ws': {
        target: 'ws://localhost:8000',
        ws: true,
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts'
  }
});