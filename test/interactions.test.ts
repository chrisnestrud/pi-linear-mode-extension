import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import {
  renderInteractionText,
  publishActiveInteraction,
  resolveActiveInteraction,
  cancelInteractionForNormalHandoff,
  discardInteractionsForSessionChange,
} from '../src/lib/interactions.ts';
import { state } from '../src/lib/state.ts';

// Mock the pi API
const mockPi = {
  sendMessage: vi.fn(),
} as unknown as ExtensionAPI;

describe('interactions utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset state
    state.activeInteraction = null;
    state.lastShownInteractionId = null;
  });

  describe('renderInteractionText', () => {
    it('should render interaction with options', () => {
      const interaction = {
        id: 'test-1',
        title: 'Choose an option',
        options: [
          { label: 'Option 1', preview: 'First choice' },
          { label: 'Option 2', preview: 'Second choice' },
          { label: 'Option 3' },
        ],
        createdAt: Date.now(),
        sourceExtension: 'test',
        sessionFile: 'test.json',
      };

      const result = renderInteractionText(interaction);
      expect(result).toContain('Selection pending');
      expect(result).toContain('Choose an option');
      expect(result).toContain('1. Option 1');
      expect(result).toContain('   First choice');
      expect(result).toContain('2. Option 2');
      expect(result).toContain('3. Option 3');
    });

    it('should render interaction without previews', () => {
      const interaction = {
        id: 'test-2',
        title: 'Simple choice',
        options: [
          { label: 'Yes' },
          { label: 'No' },
        ],
        createdAt: Date.now(),
        sourceExtension: 'test',
        sessionFile: 'test.json',
      };

      const result = renderInteractionText(interaction);
      expect(result).toContain('1. Yes');
      expect(result).toContain('2. No');
    });
  });

  describe('publishActiveInteraction', () => {
    it('should not publish when no active interaction', () => {
      state.activeInteraction = null;
      publishActiveInteraction(mockPi);
      expect(mockPi.sendMessage).not.toHaveBeenCalled();
    });

    it('should publish active interaction', () => {
      state.activeInteraction = {
        id: 'test-1',
        title: 'Test',
        options: [{ label: 'Option' }],
        createdAt: Date.now(),
        sourceExtension: 'test',
        sessionFile: 'test.json',
      };
      
      publishActiveInteraction(mockPi);
      expect(mockPi.sendMessage).toHaveBeenCalled();
      
      const call = vi.mocked(mockPi.sendMessage).mock.calls[0];
      expect(call[0].customType).toBe('linear-workflow/interaction');
      expect(call[0].content).toContain('Test');
    });

    it('should not publish same interaction twice without force', () => {
      state.activeInteraction = {
        id: 'test-1',
        title: 'Test',
        options: [{ label: 'Option' }],
        createdAt: Date.now(),
        sourceExtension: 'test',
        sessionFile: 'test.json',
      };
      
      publishActiveInteraction(mockPi);
      publishActiveInteraction(mockPi);
      
      // Should only be called once
      expect(mockPi.sendMessage).toHaveBeenCalledTimes(1);
    });

    it('should publish same interaction with force option', () => {
      state.activeInteraction = {
        id: 'test-1',
        title: 'Test',
        options: [{ label: 'Option' }],
        createdAt: Date.now(),
        sourceExtension: 'test',
        sessionFile: 'test.json',
      };
      
      publishActiveInteraction(mockPi);
      publishActiveInteraction(mockPi, { force: true });
      
      // Should be called twice with force
      expect(mockPi.sendMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('resolveActiveInteraction', () => {
    it('should clear active interaction when resolved', async () => {
      const mockExecute = vi.fn().mockResolvedValue(undefined);
      
      state.activeInteraction = {
        id: 'test-1',
        title: 'Test',
        options: [{ label: 'Option', execute: mockExecute }],
        createdAt: Date.now(),
        sourceExtension: 'test',
        sessionFile: 'test.json',
      };
      
      const mockCtx = {} as any;
      const selectedOption = { label: 'Option', execute: mockExecute };
      
      await resolveActiveInteraction(mockPi, mockCtx, selectedOption);
      expect(state.activeInteraction).toBeUndefined();
      expect(mockExecute).toHaveBeenCalled();
    });

    it('should execute selected option and clear interaction', async () => {
      const mockExecute = vi.fn().mockResolvedValue(undefined);
      
      state.activeInteraction = {
        id: 'test-1',
        title: 'Test',
        options: [{ label: 'Option', execute: mockExecute }],
        createdAt: Date.now(),
        sourceExtension: 'test',
        sessionFile: 'test.json',
      };
      
      const mockCtx = {} as any;
      const selectedOption = { label: 'Option', execute: mockExecute };
      
      await resolveActiveInteraction(mockPi, mockCtx, selectedOption);
      expect(mockExecute).toHaveBeenCalled();
      expect(state.activeInteraction).toBeUndefined();
      // publishActiveInteraction is called but won't send message since no active interaction
    });
  });
});