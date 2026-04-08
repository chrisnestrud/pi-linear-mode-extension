import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtensionAPI, InputEventResult } from '@mariozechner/pi-coding-agent';
import interactionManager from '../src/extensions/interaction-manager.ts';
import * as interactions from '../src/lib/interactions.ts';
import { state, resetEphemeralState } from '../src/lib/state.ts';

describe('interaction-manager extension', () => {
  let mockPi: ExtensionAPI;
  let sessionStartHandler: (() => void) | undefined;
  let sessionShutdownHandler: (() => void) | undefined;
  let inputHandler: ((event: any, ctx: any) => Promise<InputEventResult>) | undefined;
  let mockCtx: any;
  let mockSessionManager: any;
  let mockUi: any;

  beforeEach(() => {
    vi.clearAllMocks();
    resetEphemeralState();
    
    // Reset state
    state.activeInteraction = undefined;
    state.queuedInteractions = [];
    state.lastShownInteractionId = undefined;
    state.lastAbortFingerprint = undefined;
    
    // Setup mock context
    mockSessionManager = {
      getSessionFile: vi.fn().mockReturnValue('session.json'),
    };
    mockUi = {
      notify: vi.fn(),
    };
    mockCtx = {
      sessionManager: mockSessionManager,
      ui: mockUi,
    };
    
    // Setup mock pi API
    mockPi = {
      on: vi.fn((event: string, handler: any) => {
        if (event === 'session_start') sessionStartHandler = handler;
        if (event === 'session_shutdown') sessionShutdownHandler = handler;
        if (event === 'input') inputHandler = handler;
      }),
      sendMessage: vi.fn(),
    } as unknown as ExtensionAPI;
    
    // Mock interaction functions
    vi.spyOn(interactions, 'discardInteractionsForSessionChange').mockReturnValue(false);
    vi.spyOn(interactions, 'cancelInteractionForNormalHandoff').mockReturnValue(true);
    vi.spyOn(interactions, 'publishActiveInteraction').mockImplementation(() => {});
    vi.spyOn(interactions, 'resolveActiveInteraction').mockResolvedValue(undefined);
    
    // Initialize extension
    interactionManager(mockPi);
  });
  
  it('should register event listeners', () => {
    expect(mockPi.on).toHaveBeenCalledTimes(3);
    expect(mockPi.on).toHaveBeenCalledWith('session_start', expect.any(Function));
    expect(mockPi.on).toHaveBeenCalledWith('session_shutdown', expect.any(Function));
    expect(mockPi.on).toHaveBeenCalledWith('input', expect.any(Function));
    expect(sessionStartHandler).toBeDefined();
    expect(sessionShutdownHandler).toBeDefined();
    expect(inputHandler).toBeDefined();
  });
  
  it('should reset ephemeral state on session_start', () => {
    // Set some state
    state.lastAbortFingerprint = 'test';
    expect(state.lastAbortFingerprint).toBe('test');
    sessionStartHandler!();
    expect(state.lastAbortFingerprint).toBeUndefined();
  });
  
  it('should reset ephemeral state on session_shutdown', () => {
    state.lastAbortFingerprint = 'test';
    sessionShutdownHandler!();
    expect(state.lastAbortFingerprint).toBeUndefined();
  });
  
  it('should call discardInteractionsForSessionChange on input', async () => {
    const event = { text: '1' };
    const result = await inputHandler!(event, mockCtx);
    expect(interactions.discardInteractionsForSessionChange).toHaveBeenCalledWith('session.json');
  });
  
  describe('input handling with no active interaction', () => {
    it('should return continue when no active interaction', async () => {
      state.activeInteraction = undefined;
      const event = { text: '1' };
      const result = await inputHandler!(event, mockCtx);
      expect(result).toEqual({ action: 'continue' });
      expect(interactions.cancelInteractionForNormalHandoff).not.toHaveBeenCalled();
      expect(mockUi.notify).not.toHaveBeenCalled();
    });
  });
  
  describe('input handling with active interaction', () => {
    beforeEach(() => {
      state.activeInteraction = {
        id: 'test',
        title: 'Test',
        options: [
          { label: 'Option 1', execute: vi.fn() },
          { label: 'Option 2', execute: vi.fn() },
        ],
        createdAt: new Date().toISOString(),
        sourceExtension: 'test',
        sessionFile: 'session.json',
      };
    });
    
    it('should cancel interaction for non-bare-number input', async () => {
      const event = { text: 'hello' };
      const result = await inputHandler!(event, mockCtx);
      expect(result).toEqual({ action: 'continue' });
      expect(interactions.cancelInteractionForNormalHandoff).toHaveBeenCalledWith(mockPi);
      expect(interactions.publishActiveInteraction).not.toHaveBeenCalled();
    });
    
    it('should handle invalid number selection', async () => {
      const event = { text: '5' }; // out of range
      const result = await inputHandler!(event, mockCtx);
      expect(result).toEqual({ action: 'handled' });
      expect(mockUi.notify).toHaveBeenCalledWith('[Invalid selection: 5]', 'warning');
      expect(interactions.publishActiveInteraction).toHaveBeenCalledWith(mockPi, { force: true });
      expect(interactions.resolveActiveInteraction).not.toHaveBeenCalled();
    });
    
    it('should handle valid number selection', async () => {
      const event = { text: '1' };
      const result = await inputHandler!(event, mockCtx);
      expect(result).toEqual({ action: 'handled' });
      expect(interactions.resolveActiveInteraction).toHaveBeenCalledWith(
        mockPi,
        mockCtx,
        state.activeInteraction!.options[0]
      );
      expect(mockUi.notify).not.toHaveBeenCalled();
    });
    
    it('should handle selection with whitespace', async () => {
      const event = { text: '  2  ' };
      const result = await inputHandler!(event, mockCtx);
      expect(result).toEqual({ action: 'handled' });
      expect(interactions.resolveActiveInteraction).toHaveBeenCalledWith(
        mockPi,
        mockCtx,
        state.activeInteraction!.options[1]
      );
    });
    
    it('should handle zero input (invalid)', async () => {
      const event = { text: '0' };
      const result = await inputHandler!(event, mockCtx);
      expect(result).toEqual({ action: 'handled' });
      expect(mockUi.notify).toHaveBeenCalledWith('[Invalid selection: 0]', 'warning');
    });
    
    it('should handle negative number input (non-bare-number)', async () => {
      const event = { text: '-1' };
      const result = await inputHandler!(event, mockCtx);
      expect(result).toEqual({ action: 'continue' });
      expect(interactions.cancelInteractionForNormalHandoff).toHaveBeenCalledWith(mockPi);
    });
    
    it('should handle decimal number (non-bare-number)', async () => {
      const event = { text: '1.5' };
      const result = await inputHandler!(event, mockCtx);
      expect(result).toEqual({ action: 'continue' });
      expect(interactions.cancelInteractionForNormalHandoff).toHaveBeenCalledWith(mockPi);
    });
  });
});