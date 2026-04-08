import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtensionAPI, ExtensionContext } from '@mariozechner/pi-coding-agent';

describe('pi-linear-mode-extension', () => {
  let mockPi: ExtensionAPI;
  let sessionStartHandler: ((event: any, ctx: ExtensionContext) => Promise<void>) | undefined;
  let mockCtx: ExtensionContext;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    const mockUi = {
      notify: vi.fn(),
    };
    
    mockCtx = {
      ui: mockUi,
    } as unknown as ExtensionContext;
    
    mockPi = {
      on: vi.fn((event: string, handler: any) => {
        if (event === 'session_start') {
          sessionStartHandler = handler;
        }
      }),
      registerCommand: vi.fn(),
      registerMessageRenderer: vi.fn(),
      sendMessage: vi.fn(),
      registerTool: vi.fn(),
      registerBashRenderer: vi.fn(),
      registerSelectorRenderer: vi.fn(),
    } as unknown as ExtensionAPI;
  });
  
  it('should export a default function', async () => {
    const module = await import('../index.ts');
    expect(typeof module.default).toBe('function');
  });

  it('should register extensions without throwing', async () => {
    const module = await import('../index.ts');
    const extension = module.default;
    
    expect(() => extension(mockPi)).not.toThrow();
    expect(mockPi.on).toHaveBeenCalled();
  });
  
  it('should notify on session start', async () => {
    const module = await import('../index.ts');
    const extension = module.default;
    extension(mockPi);
    
    expect(sessionStartHandler).toBeDefined();
    await sessionStartHandler!({}, mockCtx);
    expect(mockCtx.ui.notify).toHaveBeenCalledWith('[pi-linear-mode extension loaded]', 'info');
  });
});