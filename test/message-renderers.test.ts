import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import messageRenderers from '../src/extensions/message-renderers.ts';
import * as formatting from '../src/lib/formatting.ts';

// Mock pi-tui Text class
vi.mock('@mariozechner/pi-tui', () => ({
  Text: vi.fn(function(content, x, y) {
    this.content = content;
    this.x = x;
    this.y = y;
  }),
}));

describe('message-renderers extension', () => {
  let mockPi: ExtensionAPI;
  let registeredRenderers: Map<string, any>;
  let mockTheme: any;
  let mockOptions: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(formatting, 'formatCustomMessage').mockReturnValue('[Formatted]');
    registeredRenderers = new Map();
    mockTheme = {
      fg: vi.fn().mockReturnValue('dimmed'),
    };
    mockOptions = {
      expanded: false,
    };
    
    mockPi = {
      registerMessageRenderer: vi.fn((customType, renderer) => {
        registeredRenderers.set(customType, renderer);
      }),
    } as unknown as ExtensionAPI;
    
    // Initialize extension
    messageRenderers(mockPi);
  });
  
  it('should register renderers for all custom types', () => {
    const expectedTypes = [
      'linear-workflow/interaction',
      'linear-workflow/status',
      'linear-workflow/abort',
      'footer-snapshot',
      'footer-status',
    ];
    expect(mockPi.registerMessageRenderer).toHaveBeenCalledTimes(expectedTypes.length);
    for (const type of expectedTypes) {
      expect(registeredRenderers.has(type)).toBe(true);
    }
  });
  
  describe('renderContent', () => {
    // We'll test the internal function by using one of the registered renderers
    it('should return string content as-is', () => {
      const renderer = registeredRenderers.get('linear-workflow/interaction');
      const message = { content: 'Hello world', details: {} };
      // Temporarily mock formatting.formatCustomMessage to return content
      vi.mocked(formatting.formatCustomMessage).mockReturnValue('[Formatted]');
      const result = renderer(message, mockOptions, mockTheme);
      expect(result.content).toBe('[Formatted]');
      // renderContent would have been called with 'Hello world'
    });
    
    it('should extract text from array content', () => {
      const renderer = registeredRenderers.get('linear-workflow/interaction');
      const message = {
        content: [
          { type: 'text', text: 'Line 1' },
          { type: 'text', text: 'Line 2' },
          { type: 'image', src: 'img.png' },
        ],
        details: {},
      };
      vi.mocked(formatting.formatCustomMessage).mockReturnValue('[Formatted]');
      const result = renderer(message, mockOptions, mockTheme);
      // The renderContent should have joined text lines
      // formatting.formatCustomMessage will be called with the joined content
      expect(formatting.formatCustomMessage).toHaveBeenCalledWith('linear-workflow/interaction', 'Line 1\nLine 2');
    });
    
    it('should filter out non-object items', () => {
      const renderer = registeredRenderers.get('linear-workflow/interaction');
      const message = {
        content: [
          null,
          undefined,
          'string',
          42,
          { type: 'text', text: 'Valid' },
        ],
        details: {},
      };
      vi.mocked(formatting.formatCustomMessage).mockReturnValue('[Formatted]');
      renderer(message, mockOptions, mockTheme);
      expect(formatting.formatCustomMessage).toHaveBeenCalledWith('linear-workflow/interaction', 'Valid');
    });
    
    it('should return empty string for non-string, non-array content', () => {
      const renderer = registeredRenderers.get('linear-workflow/interaction');
      const message = { content: 123, details: {} };
      vi.mocked(formatting.formatCustomMessage).mockReturnValue('[Formatted]');
      renderer(message, mockOptions, mockTheme);
      expect(formatting.formatCustomMessage).toHaveBeenCalledWith('linear-workflow/interaction', '');
    });
  });
  
  describe('renderWithOptionalDetails', () => {
    it('should return content without details when not expanded', () => {
      const renderer = registeredRenderers.get('linear-workflow/interaction');
      const message = { content: 'Hello', details: { foo: 'bar' } };
      mockOptions.expanded = false;
      vi.mocked(formatting.formatCustomMessage).mockReturnValue('[Hello]');
      const result = renderer(message, mockOptions, mockTheme);
      expect(result.content).toBe('[Hello]');
      expect(mockTheme.fg).not.toHaveBeenCalled();
    });
    
    it('should include details when expanded', () => {
      const renderer = registeredRenderers.get('linear-workflow/interaction');
      const message = { content: 'Hello', details: { foo: 'bar' } };
      mockOptions.expanded = true;
      vi.mocked(formatting.formatCustomMessage).mockReturnValue('[Hello]');
      const result = renderer(message, mockOptions, mockTheme);
      // Should have called theme.fg with 'dim' and JSON string
      expect(mockTheme.fg).toHaveBeenCalledWith('dim', '{\n  "foo": "bar"\n}');
      expect(result.content).toBe('[Hello]\ndimmed');
    });
    
    it('should not include details when details is undefined', () => {
      const renderer = registeredRenderers.get('linear-workflow/interaction');
      const message = { content: 'Hello', details: undefined };
      mockOptions.expanded = true;
      vi.mocked(formatting.formatCustomMessage).mockReturnValue('[Hello]');
      const result = renderer(message, mockOptions, mockTheme);
      expect(mockTheme.fg).not.toHaveBeenCalled();
      expect(result.content).toBe('[Hello]');
    });
  });
});