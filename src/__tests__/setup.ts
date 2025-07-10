/**
 * Test setup file for Vitest
 */

// Mock browser APIs
global.crypto = {
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
} as any;

// Mock WebSocket
class MockWebSocket {
  url: string;
  readyState: number = 0;
  onopen: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = 1;
      if (this.onopen) {
        this.onopen({ type: 'open' });
      }
    }, 0);
  }

  send(data: string): void {
    // Mock implementation
  }

  close(): void {
    this.readyState = 3;
    if (this.onclose) {
      this.onclose({ type: 'close' });
    }
  }
}

global.WebSocket = MockWebSocket as any;

// Mock process.env
process.env.NODE_ENV = 'test';
