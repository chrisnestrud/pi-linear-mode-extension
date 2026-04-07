import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';

// Mock the pi API
const mockPi = {
  on: vi.fn(),
  registerCommand: vi.fn(),
  registerMessageRenderer: vi.fn(),
  sendMessage: vi.fn(),
  registerTool: vi.fn(),
  registerBashRenderer: vi.fn(),
  registerSelectorRenderer: vi.fn(),
  // Add other methods as needed
} as unknown as ExtensionAPI;

describe('pi-linear-mode-extension', () => {
  it('should export a default function', async () => {
    // Dynamically import the extension
    const module = await import('../index.ts');
    expect(typeof module.default).toBe('function');
  });

  it('should register extensions without throwing', async () => {
    const module = await import('../index.ts');
    const extension = module.default;
    
    // Should not throw when called with mock API
    expect(() => extension(mockPi)).not.toThrow();
    
    // Should register event listeners
    expect(mockPi.on).toHaveBeenCalled();
  });
});