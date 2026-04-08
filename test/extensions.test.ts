import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';

// Import all extensions
import interactionManager from '../src/extensions/interaction-manager.ts';
import abortMarker from '../src/extensions/abort-marker.ts';
import tuiCompat from '../src/extensions/tui-compat.ts';
import toolRenderers from '../src/extensions/tool-renderers.ts';
import messageRenderers from '../src/extensions/message-renderers.ts';
import bashRenderer from '../src/extensions/bash-renderer.ts';
import selectorRenderer from '../src/extensions/selector-renderer.ts';
import workingMessageModifier from '../src/extensions/working-message-modifier.ts';
import footerSuppressor from '../src/extensions/footer-suppressor.ts';

function createMockPi(): ExtensionAPI {
  return {
    on: vi.fn(),
    sendMessage: vi.fn(),
    registerCommand: vi.fn(),
    registerMessageRenderer: vi.fn(),
    registerTool: vi.fn(),
    registerBashRenderer: vi.fn(),
    registerSelectorRenderer: vi.fn(),
    // Add other methods as needed
  } as unknown as ExtensionAPI;
}

describe('extension registration', () => {
  let mockPi: ExtensionAPI;
  
  beforeEach(() => {
    mockPi = createMockPi();
    vi.clearAllMocks();
  });
  
  it('interactionManager should register without error', () => {
    expect(() => interactionManager(mockPi)).not.toThrow();
    expect(mockPi.on).toHaveBeenCalled();
  });

  it('abortMarker should register without error', () => {
    expect(() => abortMarker(mockPi)).not.toThrow();
    expect(mockPi.on).toHaveBeenCalled();
  });

  it('tuiCompat should register without error', () => {
    expect(() => tuiCompat(mockPi)).not.toThrow();
    expect(mockPi.on).toHaveBeenCalled();
  });

  it('toolRenderers should register without error', () => {
    expect(() => toolRenderers(mockPi)).not.toThrow();
    expect(mockPi.registerTool).toHaveBeenCalled();
  });

  it('messageRenderers should register without error', () => {
    expect(() => messageRenderers(mockPi)).not.toThrow();
    expect(mockPi.registerMessageRenderer).toHaveBeenCalled();
  });

  it('bashRenderer should register without error', () => {
    expect(() => bashRenderer(mockPi)).not.toThrow();
    expect(mockPi.registerBashRenderer).toHaveBeenCalled();
  });

  it('selectorRenderer should register without error', () => {
    expect(() => selectorRenderer(mockPi)).not.toThrow();
    expect(mockPi.registerSelectorRenderer).toHaveBeenCalled();
  });

  it('workingMessageModifier should register without error', () => {
    expect(() => workingMessageModifier(mockPi)).not.toThrow();
    expect(mockPi.on).toHaveBeenCalled();
  });

  it('footerSuppressor should register without error', () => {
    expect(() => footerSuppressor(mockPi)).not.toThrow();
    expect(mockPi.on).toHaveBeenCalled();
  });
});