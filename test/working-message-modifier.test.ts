import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import workingMessageModifierExtension from '../src/extensions/working-message-modifier.ts';
import { logger } from '../src/lib/logger.ts';

// Mock logger
vi.mock('../src/lib/logger.ts', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('working-message-modifier extension', () => {
  let mockPi: ExtensionAPI;
  let eventHandlers: Map<string, Function>;
  let mockCtx: any;
  let mockSetWorkingMessage: vi.Mock;
  let mockClearTimeout: vi.Mock;
  let mockSetTimeout: vi.Mock;
  
  beforeEach(() => {
    vi.useFakeTimers();
    eventHandlers = new Map();
    mockSetWorkingMessage = vi.fn();
    mockCtx = {
      ui: {
        setWorkingMessage: mockSetWorkingMessage,
      },
    };
    
    // Mock setTimeout and clearTimeout
    mockSetTimeout = vi.fn().mockImplementation((callback, delay) => {
      const timeoutId = Symbol('timeout');
      // Store callback for manual triggering
      (mockSetTimeout as any).callbacks = (mockSetTimeout as any).callbacks || new Map();
      (mockSetTimeout as any).callbacks.set(timeoutId, { callback, delay });
      return timeoutId;
    });
    mockClearTimeout = vi.fn().mockImplementation((timeoutId) => {
      (mockSetTimeout as any).callbacks?.delete(timeoutId);
    });
    
    global.setTimeout = mockSetTimeout as any;
    global.clearTimeout = mockClearTimeout as any;
    
    mockPi = {
      on: vi.fn((event: string, handler: Function) => {
        eventHandlers.set(event, handler);
      }),
    } as unknown as ExtensionAPI;
    
    // Initialize extension
    workingMessageModifierExtension(mockPi);
  });
  
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });
  
  it('should register event listeners', () => {
    expect(mockPi.on).toHaveBeenCalledTimes(5);
    const expectedEvents = [
      'session_start',
      'agent_start',
      'turn_start',
      'agent_end',
      'session_shutdown',
    ];
    for (const event of expectedEvents) {
      expect(eventHandlers.has(event)).toBe(true);
    }
  });
  
  it('should clear working message on session_start', async () => {
    const handler = eventHandlers.get('session_start');
    expect(handler).toBeDefined();
    await handler!({}, mockCtx);
    expect(mockSetWorkingMessage).toHaveBeenCalledWith(); // no argument
    // clearTimeout not called because workingMessageTimeout is null initially
    expect(mockClearTimeout).not.toHaveBeenCalled();
  });
  
  it('should clear working message on agent_start', async () => {
    const handler = eventHandlers.get('agent_start');
    expect(handler).toBeDefined();
    await handler!({}, mockCtx);
    expect(mockSetWorkingMessage).toHaveBeenCalledWith();
    expect(mockClearTimeout).not.toHaveBeenCalled();
  });
  
  it('should set working message on turn_start', async () => {
    const handler = eventHandlers.get('turn_start');
    expect(handler).toBeDefined();
    await handler!({}, mockCtx);
    expect(mockSetWorkingMessage).toHaveBeenCalledWith('[Working...]');
    // Should set a timeout
    expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 2 * 60 * 1000);
    // clearTimeout not called because workingMessageTimeout is null initially
    expect(mockClearTimeout).not.toHaveBeenCalled();
  });
  
  it('should clear working message on agent_end', async () => {
    const handler = eventHandlers.get('agent_end');
    expect(handler).toBeDefined();
    await handler!({}, mockCtx);
    expect(mockSetWorkingMessage).toHaveBeenCalledWith();
    // clearTimeout not called because no timeout set yet
    expect(mockClearTimeout).not.toHaveBeenCalled();
  });
  
  it('should clear working message on session_shutdown', async () => {
    const handler = eventHandlers.get('session_shutdown');
    expect(handler).toBeDefined();
    await handler!({}, mockCtx);
    expect(mockSetWorkingMessage).toHaveBeenCalledWith();
    expect(mockClearTimeout).not.toHaveBeenCalled();
  });
  
  describe('timeout behavior', () => {
    it('should clear previous timeout when setting new working message', async () => {
      const handler = eventHandlers.get('turn_start');
      // First call: no previous timeout
      await handler!({}, mockCtx);
      expect(mockClearTimeout).not.toHaveBeenCalled();
      // Second call: should clear previous timeout
      await handler!({}, mockCtx);
      expect(mockClearTimeout).toHaveBeenCalledTimes(1);
    });
    
    it('should trigger timeout after 2 minutes', async () => {
      const handler = eventHandlers.get('turn_start');
      await handler!({}, mockCtx);
      // Get the callback that was scheduled
      const callbacks = (mockSetTimeout as any).callbacks;
      expect(callbacks).toBeDefined();
      const timeoutEntry = Array.from(callbacks.values())[0];
      expect(timeoutEntry.delay).toBe(2 * 60 * 1000);
      // Manually call the callback
      timeoutEntry.callback();
      // Should clear working message
      expect(mockSetWorkingMessage).toHaveBeenCalledWith(); // cleared
      expect(logger.warn).toHaveBeenCalledWith(
        'Working message timeout after 2 minutes'
      );
    });
    
    it('should not clear working message if already cleared before timeout', async () => {
      const turnStartHandler = eventHandlers.get('turn_start');
      const agentEndHandler = eventHandlers.get('agent_end');
      await turnStartHandler!({}, mockCtx);
      // Clear via agent_end
      await agentEndHandler!({}, mockCtx);
      // Trigger timeout (if still pending)
      const callbacks = (mockSetTimeout as any).callbacks;
      if (callbacks && callbacks.size > 0) {
        const timeoutEntry = Array.from(callbacks.values())[0];
        timeoutEntry.callback();
        // Should not call setWorkingMessage again (already cleared)
        // The mock call count for setWorkingMessage includes the clear call
        // We'll just ensure no error
      }
      // The timeout callback should check workingMessageActive and skip
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
  
  describe('error handling', () => {
    it('should log error if setWorkingMessage throws', async () => {
      mockCtx.ui.setWorkingMessage = vi.fn(() => {
        throw new Error('UI error');
      });
      const handler = eventHandlers.get('turn_start');
      await handler!({}, mockCtx);
      expect(logger.error).toHaveBeenCalledWith(
        'Error setting working message:',
        expect.any(Error)
      );
    });
    
    it('should log error if clearWorkingMessage throws', async () => {
      mockCtx.ui.setWorkingMessage = vi.fn(() => {
        throw new Error('Clear error');
      });
      const handler = eventHandlers.get('session_start');
      await handler!({}, mockCtx);
      expect(logger.error).toHaveBeenCalledWith(
        'Error clearing working message:',
        expect.any(Error)
      );
    });
    
  });


});