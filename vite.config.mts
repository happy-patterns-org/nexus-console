import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');
  
  // Define proxy targets with environment variable support
  const CONSOLE_WS_TARGET = env.VITE_CONSOLE_WS_TARGET || env.CONSOLE_WS_TARGET || 'ws://localhost:3001';
  const CONSOLE_API_TARGET = env.VITE_CONSOLE_API_TARGET || env.CONSOLE_API_TARGET || 'http://localhost:3001';
  const DEV_PORT = parseInt(env.VITE_DEV_PORT || env.DEV_PORT || '3000', 10);
  
  return {
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'NexusConsole',
      formats: ['es', 'umd'],
      fileName: (format) => `nexus-console.${format}.js`
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'fs',
        'path',
        'xterm',
        'xterm-addon-fit',
        'xterm-addon-webgl',
        'xterm-addon-search',
        'xterm-addon-serialize',
        'xterm-addon-unicode11',
        '@business-org/shared-config-ts',
        '@business-org/shared-config-ts/console-types'
      ],
      output: {
        globals: {
          'react': 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'React',
          'xterm': 'Terminal',
          'xterm-addon-fit': 'FitAddon',
          'xterm-addon-webgl': 'WebglAddon',
          'xterm-addon-search': 'SearchAddon',
          'xterm-addon-serialize': 'SerializeAddon',
          'xterm-addon-unicode11': 'Unicode11Addon',
          '@business-org/shared-config-ts': 'SharedConfig',
          '@business-org/shared-config-ts/console-types': 'SharedConfigConsole'
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
    port: DEV_PORT,
    proxy: {
      '/terminal/ws': {
        target: CONSOLE_WS_TARGET,
        ws: true,
        changeOrigin: true,
        rewrite: (path) => {
          console.log(`[WebSocket Proxy] ${path} -> ${CONSOLE_WS_TARGET}${path}`);
          return path;
        }
      },
      '/api': {
        target: CONSOLE_API_TARGET,
        changeOrigin: true,
        rewrite: (path) => {
          console.log(`[API Proxy] ${path} -> ${CONSOLE_API_TARGET}${path}`);
          return path;
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts'
  }
  };
});