/**
 * Test setup file for Vitest
 */
import { vi } from 'vitest';

// Mock browser APIs
// Use Object.defineProperty for read-only properties
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
    randomUUID: () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
  },
  writable: true,
  configurable: true
});

// Mock WebSocket - Commented out to allow individual tests to provide their own mocks
// class MockWebSocket {
//   url: string;
//   readyState: number = 0;
//   onopen: ((event: any) => void) | null = null;
//   onclose: ((event: any) => void) | null = null;
//   onerror: ((event: any) => void) | null = null;
//   onmessage: ((event: any) => void) | null = null;

//   constructor(url: string) {
//     this.url = url;
//     setTimeout(() => {
//       this.readyState = 1;
//       if (this.onopen) {
//         this.onopen({ type: 'open' });
//       }
//     }, 0);
//   }

//   send(data: string): void {
//     // Mock implementation
//   }

//   close(): void {
//     this.readyState = 3;
//     if (this.onclose) {
//       this.onclose({ type: 'close' });
//     }
//   }
// }

// global.WebSocket = MockWebSocket as any;

// Mock process.env
process.env.NODE_ENV = 'test';

// Mock global fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ token: 'test-token' }),
    text: () => Promise.resolve(''),
    headers: new Headers(),
    status: 200,
    statusText: 'OK'
  } as Response)
);

// Mock window.location
Object.defineProperty(global, 'window', {
  value: {
    location: {
      protocol: 'http:',
      host: 'localhost:3001',
      hostname: 'localhost',
      port: '3001',
      pathname: '/',
      search: '',
      hash: ''
    }
  },
  writable: true,
  configurable: true
});

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] || null
  };
})();

Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
  configurable: true
});
