import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import abortMarker from '../src/extensions/abort-marker.ts';
import { state } from '../src/lib/state.ts';

describe('abort-marker extension', () => {
  let mockPi: ExtensionAPI;
  let eventHandler: ((event: any) => void) | undefined;

  beforeEach(() => {
    eventHandler = undefined;
    state.lastAbortFingerprint = undefined;
    mockPi = {
      on: vi.fn((event: string, handler: (event: any) => void) => {
        if (event === 'agent_end') {
          eventHandler = handler;
        }
      }),
      sendMessage: vi.fn(),
    } as unknown as ExtensionAPI;
  });

  it('should register agent_end listener', () => {
    abortMarker(mockPi);
    expect(mockPi.on).toHaveBeenCalledWith('agent_end', expect.any(Function));
    expect(eventHandler).toBeDefined();
  });

  it('should not send message if no aborted assistant', () => {
    abortMarker(mockPi);
    expect(mockPi.on).toHaveBeenCalled();
    const handler = (mockPi.on as any).mock.calls.find(([event]) => event === 'agent_end')?.[1];
    expect(handler).toBeDefined();
    // Simulate agent_end event with no aborted assistant
    const event = {
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', stopReason: 'stop' },
      ],
    };
    handler(event);
    expect(mockPi.sendMessage).not.toHaveBeenCalled();
  });

  it('should send abort marker when assistant aborted', () => {
    abortMarker(mockPi);
    const handler = (mockPi.on as any).mock.calls.find(([event]) => event === 'agent_end')?.[1];
    const event = {
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', stopReason: 'aborted', timestamp: 123, errorMessage: 'cancelled' },
      ],
    };
    handler(event);
    expect(mockPi.sendMessage).toHaveBeenCalledWith({
      customType: 'linear-workflow/abort',
      content: 'Operation aborted',
      display: true,
      details: expect.objectContaining({
        timestamp: expect.any(String),
        source: 'ctrl+c',
      }),
    });
  });

  it('should not send duplicate abort marker for same fingerprint', () => {
    abortMarker(mockPi);
    const handler = (mockPi.on as any).mock.calls.find(([event]) => event === 'agent_end')?.[1];
    const event = {
      messages: [
        { role: 'assistant', stopReason: 'aborted', timestamp: 123, errorMessage: 'cancelled' },
      ],
    };
    handler(event);
    handler(event); // second call with same fingerprint
    expect(mockPi.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('should not send abort marker if role is not assistant', () => {
    abortMarker(mockPi);
    const handler = (mockPi.on as any).mock.calls.find(([event]) => event === 'agent_end')?.[1];
    const event = {
      messages: [
        { role: 'user', stopReason: 'aborted', timestamp: 123, errorMessage: 'cancelled' },
      ],
    };
    handler(event);
    expect(mockPi.sendMessage).not.toHaveBeenCalled();
  });

  it('should not send abort marker if stopReason is not aborted', () => {
    abortMarker(mockPi);
    const handler = (mockPi.on as any).mock.calls.find(([event]) => event === 'agent_end')?.[1];
    const event = {
      messages: [
        { role: 'assistant', stopReason: 'stop', timestamp: 123, errorMessage: 'cancelled' },
      ],
    };
    handler(event);
    expect(mockPi.sendMessage).not.toHaveBeenCalled();
  });

  it('should handle missing timestamp and errorMessage', () => {
    abortMarker(mockPi);
    const handler = (mockPi.on as any).mock.calls.find(([event]) => event === 'agent_end')?.[1];
    const event = {
      messages: [
        { role: 'assistant', stopReason: 'aborted' },
      ],
    };
    handler(event);
    expect(mockPi.sendMessage).toHaveBeenCalled();
  });
});