import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from '@mariozechner/pi-coding-agent';
import footerSuppressorSimple from '../src/extensions/footer-suppressor.ts';
import { logger } from '../src/lib/logger.ts';

describe('footer-suppressor extension', () => {
  let mockPi: ExtensionAPI;
  let sessionStartHandler: ((event: any, ctx: ExtensionContext) => Promise<void>) | undefined;
  let sessionShutdownHandler: ((event: any, ctx: ExtensionContext) => Promise<void>) | undefined;
  let toggleFooterHandler: ((args: any, ctx: ExtensionCommandContext) => Promise<void>) | undefined;
  let footerStatusHandler: ((args: any, ctx: ExtensionCommandContext) => Promise<void>) | undefined;
  let mockCtx: ExtensionContext;
  let mockUi: any;
  let mockModel: any;
  let mockSession: any;
  let currentFooter: any = undefined;
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    
    // Setup mock UI
    mockUi = {
      setFooter: vi.fn((footer: any) => {
        currentFooter = footer;
      }),
      notify: vi.fn(),
    };
    
    // Setup mock model and session
    mockModel = {
      id: 'test-model',
      provider: 'test-provider',
      contextWindow: 128, // in thousands (k)
    };
    
    mockSession = {
      getContextUsage: vi.fn().mockReturnValue({
        contextWindow: 128, // in thousands (k)
        percent: 25.5,
      }),
    };
    
    // Setup mock context (can be extended per test)
    mockCtx = {
      ui: mockUi,
      model: mockModel,
      session: mockSession,
    } as unknown as ExtensionContext;
    
    // Setup mock pi API
    mockPi = {
      registerCommand: vi.fn((name: string, spec: any) => {
        if (name === 'toggle-footer') toggleFooterHandler = spec.handler;
        if (name === 'footer-status') footerStatusHandler = spec.handler;
      }),
      on: vi.fn((event: string, handler: any) => {
        if (event === 'session_start') sessionStartHandler = handler;
        if (event === 'session_shutdown') sessionShutdownHandler = handler;
      }),
    } as unknown as ExtensionAPI;
    
    // Initialize extension
    footerSuppressorSimple(mockPi);
  });
  
  it('should register commands and event listeners', () => {
    expect(mockPi.registerCommand).toHaveBeenCalledTimes(2);
    expect(mockPi.registerCommand).toHaveBeenCalledWith('toggle-footer', expect.objectContaining({
      description: 'Toggle footer suppression',
      handler: expect.any(Function),
    }));
    expect(mockPi.registerCommand).toHaveBeenCalledWith('footer-status', expect.objectContaining({
      description: 'Show current footer status',
      handler: expect.any(Function),
    }));
    expect(mockPi.on).toHaveBeenCalledTimes(2);
    expect(mockPi.on).toHaveBeenCalledWith('session_start', expect.any(Function));
    expect(mockPi.on).toHaveBeenCalledWith('session_shutdown', expect.any(Function));
    expect(toggleFooterHandler).toBeDefined();
    expect(footerStatusHandler).toBeDefined();
    expect(sessionStartHandler).toBeDefined();
    expect(sessionShutdownHandler).toBeDefined();
  });
  
  describe('session_start', () => {
    it('should set empty footer on session start', async () => {
      await sessionStartHandler!({}, mockCtx);
      expect(mockUi.setFooter).toHaveBeenCalledWith(expect.any(Function));
      // Verify the footer function returns empty array
      const footerFn = mockUi.setFooter.mock.calls[0][0];
      const result = footerFn(null, null, null);
      expect(result.render(80)).toEqual([]);
    });
    
    it('should log error but not notify if setFooter throws', async () => {
      mockUi.setFooter.mockImplementation(() => {
        throw new Error('setFooter error');
      });
      await sessionStartHandler!({}, mockCtx);
      expect(logger.error).toHaveBeenCalledWith('Error setting empty footer:', expect.any(Error));
      expect(mockUi.notify).not.toHaveBeenCalled();
    });
  });
  
  describe('session_shutdown', () => {
    it('should restore default footer on shutdown', async () => {
      await sessionShutdownHandler!({}, mockCtx);
      expect(mockUi.setFooter).toHaveBeenCalledWith(undefined);
    });
    
    it('should log error if restore fails', async () => {
      mockUi.setFooter.mockImplementation(() => {
        throw new Error('restore error');
      });
      await sessionShutdownHandler!({}, mockCtx);
      expect(logger.error).toHaveBeenCalledWith('Error restoring footer on shutdown:', expect.any(Error));
    });
  });
  
  describe('toggle-footer command', () => {
    it('should toggle footer suppression and notify', async () => {
      // Initially footer is suppressed (empty footer)
      await sessionStartHandler!({}, mockCtx);
      expect(mockUi.setFooter).toHaveBeenCalledTimes(1);
      
      // First toggle: enable footer (restore default)
      await toggleFooterHandler!({}, mockCtx);
      expect(mockUi.setFooter).toHaveBeenCalledWith(undefined);
      expect(mockUi.notify).toHaveBeenCalledWith('[Footer restored]', 'info');
      
      // Second toggle: disable footer (set empty)
      await toggleFooterHandler!({}, mockCtx);
      expect(mockUi.setFooter).toHaveBeenCalledWith(expect.any(Function));
      expect(mockUi.notify).toHaveBeenCalledWith('[Footer suppressed]', 'info');
    });
    
    it('should handle errors and notify', async () => {
      mockUi.setFooter.mockImplementation(() => {
        throw new Error('toggle error');
      });
      await toggleFooterHandler!({}, mockCtx);
      expect(mockUi.notify).toHaveBeenCalledWith('[Error toggling footer: Error: toggle error]', 'error');
    });
  });
  
  describe('footer-status command', () => {
    it('should show footer status with context usage', async () => {
      await footerStatusHandler!({}, mockCtx);
      expect(mockUi.notify).toHaveBeenCalledWith('[25.5%/128k test-model]', 'info');
    });
    
    it('should handle missing context usage', async () => {
      mockSession.getContextUsage.mockReturnValue(null);
      await footerStatusHandler!({}, mockCtx);
      expect(mockUi.notify).toHaveBeenCalledWith('[0.0%/128k test-model]', 'info');
    });

    it('should handle string context percent without calling toFixed', async () => {
      mockSession.getContextUsage.mockReturnValue({
        contextWindow: 128,
        percent: 'oops',
      });
      await footerStatusHandler!({}, mockCtx);
      expect(mockUi.notify).toHaveBeenCalledWith('[Error getting footer status: TypeError: contextPercent.toFixed is not a function]', 'error');
    });
    
    it('should handle missing model', async () => {
      const ctxWithoutModel = { ...mockCtx, model: undefined };
      // Ensure getContextUsage returns null to test fallback
      mockSession.getContextUsage.mockReturnValue(null);
      await footerStatusHandler!({}, ctxWithoutModel);
      expect(mockUi.notify).toHaveBeenCalledWith('[0.0%/0k no-model]', 'info');
    });
    
    it('should handle missing session', async () => {
      const ctxWithoutSession = { ...mockCtx, session: undefined };
      await footerStatusHandler!({}, ctxWithoutSession);
      // getContextUsage will be undefined, contextWindow from model
      expect(mockUi.notify).toHaveBeenCalledWith('[0.0%/128k test-model]', 'info');
    });
    
    it('should handle errors and notify', async () => {
      mockSession.getContextUsage.mockImplementation(() => {
        throw new Error('context error');
      });
      await footerStatusHandler!({}, mockCtx);
      expect(mockUi.notify).toHaveBeenCalledWith('[Error getting footer status: Error: context error]', 'error');
    });
  });
});