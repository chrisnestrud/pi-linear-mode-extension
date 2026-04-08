import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import {
  renderInteractionText,
  publishActiveInteraction,
  resolveActiveInteraction,
  cancelInteractionForNormalHandoff,
  discardInteractionsForSessionChange,
  enqueueInteraction,
  createAndPublishInteraction,
  cancelActiveInteraction,
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
    state.activeInteraction = undefined;
    state.lastShownInteractionId = undefined;
    state.queuedInteractions = [];
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
      state.activeInteraction = undefined;
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

  describe('enqueueInteraction', () => {
    it('should set as active interaction if none exists', () => {
      const input = {
        title: 'Test',
        options: [{ label: 'Option' }],
        sessionFile: 'test.json',
        sourceExtension: 'test',
      };
      const interaction = enqueueInteraction(input);
      expect(interaction.id).toBeDefined();
      expect(interaction.title).toBe('Test');
      expect(state.activeInteraction).toBe(interaction);
      expect(state.queuedInteractions).toHaveLength(0);
    });

    it('should queue interaction if active already exists', () => {
      // First interaction becomes active
      const first = enqueueInteraction({
        title: 'First',
        options: [{ label: 'Option' }],
      });
      expect(state.activeInteraction).toBe(first);
      // Second interaction queued
      const second = enqueueInteraction({
        title: 'Second',
        options: [{ label: 'Option' }],
      });
      expect(state.activeInteraction).toBe(first);
      expect(state.queuedInteractions).toHaveLength(1);
      expect(state.queuedInteractions[0]).toBe(second);
    });
  });

  describe('createAndPublishInteraction', () => {
    it('should enqueue and publish with force', () => {
      const input = {
        title: 'Test',
        options: [{ label: 'Option' }],
      };
      const interaction = createAndPublishInteraction(mockPi, input);
      expect(interaction.title).toBe('Test');
      expect(state.activeInteraction).toBe(interaction);
      // publishActiveInteraction is called with force: true
      expect(mockPi.sendMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelActiveInteraction', () => {
    it('should clear active interaction and promote next', () => {
      // First interaction active, second queued
      const first = enqueueInteraction({ title: 'First', options: [{ label: 'Option' }] });
      const second = enqueueInteraction({ title: 'Second', options: [{ label: 'Option' }] });
      expect(state.activeInteraction).toBe(first);
      expect(state.queuedInteractions).toHaveLength(1);
      cancelActiveInteraction();
      // Active should now be second, queue empty
      expect(state.activeInteraction).toBe(second);
      expect(state.queuedInteractions).toHaveLength(0);
    });

    it('should clear lastShownInteractionId', () => {
      state.activeInteraction = {
        id: 'test-1',
        title: 'Test',
        options: [{ label: 'Option' }],
        createdAt: Date.now(),
        sourceExtension: 'test',
        sessionFile: 'test.json',
      };
      state.lastShownInteractionId = 'test-1';
      cancelActiveInteraction();
      expect(state.lastShownInteractionId).toBeUndefined();
    });
  });

  describe('discardInteractionsForSessionChange', () => {
    it('should return false when no mismatched session', () => {
      state.activeInteraction = {
        id: 'test',
        title: 'Test',
        options: [],
        createdAt: Date.now(),
        sourceExtension: 'test',
        sessionFile: 'session.json',
      };
      const result = discardInteractionsForSessionChange('session.json');
      expect(result).toBe(false);
      expect(state.activeInteraction).toBeDefined();
    });

    it('should clear interactions when session mismatches', () => {
      state.activeInteraction = {
        id: 'test',
        title: 'Test',
        options: [],
        createdAt: Date.now(),
        sourceExtension: 'test',
        sessionFile: 'old.json',
      };
      state.queuedInteractions.push({
        id: 'queued',
        title: 'Queued',
        options: [],
        createdAt: Date.now(),
        sourceExtension: 'test',
        sessionFile: 'old.json',
      });
      const result = discardInteractionsForSessionChange('new.json');
      expect(result).toBe(true);
      expect(state.activeInteraction).toBeUndefined();
      expect(state.queuedInteractions).toHaveLength(0);
      expect(state.lastShownInteractionId).toBeUndefined();
    });
  });

  describe('cancelInteractionForNormalHandoff', () => {
    it('should return false when no active interaction', () => {
      state.activeInteraction = undefined;
      const result = cancelInteractionForNormalHandoff(mockPi);
      expect(result).toBe(false);
      expect(mockPi.sendMessage).not.toHaveBeenCalled();
    });

    it('should cancel active interaction and publish', () => {
      state.activeInteraction = {
        id: 'test',
        title: 'Test',
        options: [{ label: 'Option' }],
        createdAt: Date.now(),
        sourceExtension: 'test',
        sessionFile: 'test.json',
      };
      const result = cancelInteractionForNormalHandoff(mockPi);
      expect(result).toBe(true);
      expect(state.activeInteraction).toBeUndefined();
      // publishActiveInteraction is called with no active interaction, so no sendMessage
      // but we can check that sendMessage was called (maybe it will send empty?)
      // Actually publishActiveInteraction will not send message because activeInteraction is undefined after cancelActiveInteraction
      // So we just ensure cancelActiveInteraction worked
    });
  });
});