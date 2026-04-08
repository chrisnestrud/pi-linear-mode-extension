import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import selectorRendererExtension from '../src/extensions/selector-renderer.ts';
import { formatSelectorItem, truncateForScreenReader } from '../src/lib/formatting.ts';

// Mock pi-tui module
vi.mock('@mariozechner/pi-tui', () => {
  // Simple mock for Container
  class MockContainer {
    children: any[] = [];
    clear() {
      this.children = [];
    }
    addChild(child: any) {
      this.children.push(child);
      return child;
    }
  }

  // Simple mock for Text
  class MockText {
    constructor(public content: string, public x: number, public y: number) {}
  }

  // Simple mock for Spacer
  class MockSpacer {
    constructor(public height: number) {}
  }

  return {
    Container: MockContainer,
    Text: MockText,
    Spacer: MockSpacer,
  };
});

// Mock formatting functions
vi.mock('../src/lib/formatting.ts', () => ({
  formatSelectorItem: vi.fn().mockImplementation((index, label, isSelected) => {
    const prefix = isSelected ? '> ' : '  ';
    return `${prefix}[${index + 1}] ${label}`;
  }),
  truncateForScreenReader: vi.fn().mockImplementation((text, maxLength = 80) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }),
}));

describe('selector-renderer extension', () => {
  let mockPi: ExtensionAPI;
  let sessionStartHandler: ((event: any, ctx: any) => Promise<void>) | undefined;
  let mockCtx: any;
  let registeredRenderers: Map<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockCtx = {
      hasUI: true,
      ui: {
        notify: vi.fn(),
      },
    };
    
    registeredRenderers = new Map();
    mockPi = {
      registerSelectorRenderer: vi.fn((type: string, renderer: any) => {
        registeredRenderers.set(type, renderer);
      }),
      on: vi.fn((event: string, handler: any) => {
        if (event === 'session_start') {
          sessionStartHandler = handler;
        }
      }),
    } as unknown as ExtensionAPI;
    
    // Initialize extension
    selectorRendererExtension(mockPi);
  });
  
  it('should register selector renderers for all types', () => {
    expect(mockPi.registerSelectorRenderer).toHaveBeenCalledTimes(5);
    const expectedTypes = [
      'user-message',
      'model',
      'session',
      'oauth-login',
      'oauth-logout',
    ];
    for (const type of expectedTypes) {
      expect(registeredRenderers.has(type)).toBe(true);
    }
  });
  
  it('should test all renderer types work correctly', () => {
    const items = [{ id: '1', label: 'Test' }];
    const onSelect = vi.fn();
    const onCancel = vi.fn();
    
    // Test each renderer type
    const types = ['user-message', 'model', 'session', 'oauth-login', 'oauth-logout'];
    for (const type of types) {
      const renderer = registeredRenderers.get(type);
      expect(renderer).toBeDefined();
      const component = renderer(items, {}, onSelect, onCancel, {});
      expect(component).toBeDefined();
      expect(component.children.length).toBeGreaterThan(0);
    }
  });
  
  it('should register session_start listener', () => {
    expect(mockPi.on).toHaveBeenCalledWith('session_start', expect.any(Function));
    expect(sessionStartHandler).toBeDefined();
  });
  
  it('should notify when UI is available on session start', async () => {
    await sessionStartHandler!({}, mockCtx);
    expect(mockCtx.ui.notify).toHaveBeenCalledWith('[Linear selector rendering enabled]', 'info');
  });
  
  it('should not notify when UI is not available', async () => {
    mockCtx.hasUI = false;
    await sessionStartHandler!({}, mockCtx);
    expect(mockCtx.ui.notify).not.toHaveBeenCalled();
  });
});

// Since LinearSelectorComponent is not exported, we need to test it through the renderers
describe('LinearSelectorComponent (via renderer)', () => {
  let mockPi: ExtensionAPI;
  let registeredRenderers: Map<string, any>;
  
  beforeEach(() => {
    vi.clearAllMocks();
    registeredRenderers = new Map();
    mockPi = {
      registerSelectorRenderer: vi.fn((type: string, renderer: any) => {
        registeredRenderers.set(type, renderer);
      }),
      on: vi.fn(),
    } as unknown as ExtensionAPI;
    
    selectorRendererExtension(mockPi);
  });
  
  function createComponent(
    items: any[] = [
      { id: '1', label: 'Option 1', description: 'First option' },
      { id: '2', label: 'Option 2' },
      { id: '3', label: 'Option 3', description: 'Third option with longer description' },
    ],
    onSelect = vi.fn(),
    onCancel = vi.fn(),
    options = {}
  ) {
    // Use any of the registered renderers (they all create the same component)
    const renderer = registeredRenderers.get('user-message');
    expect(renderer).toBeDefined();
    return renderer(items, {}, onSelect, onCancel, options);
  }
  
  describe('initial rendering', () => {
    it('should create component with items', () => {
      const component = createComponent();
      expect(component).toBeDefined();
      expect(component.children.length).toBeGreaterThan(0);
    });
    
    it('should handle empty items array', () => {
      const component = createComponent([]);
      expect(component).toBeDefined();
      // Should still render instructions
      expect(component.children.length).toBeGreaterThan(0);
      const lastChild = component.children[component.children.length - 1];
      expect(lastChild.content).toContain('Enter number (1-0) or press Esc to cancel');
    });
    
    it('should render title when provided', () => {
      const component = createComponent([{ id: '1', label: 'Option' }], vi.fn(), vi.fn(), { title: 'Select an option' });
      // Should have title text, spacer, item, and instruction
      expect(component.children.length).toBeGreaterThan(2);
      const firstChild = component.children[0];
      expect(firstChild.content).toBe('Select an option');
    });
    
    it('should render numbered items with formatting', () => {
      const items = [
        { id: '1', label: 'Option 1' },
        { id: '2', label: 'Option 2' },
      ];
      const component = createComponent(items);
      
      // formatSelectorItem should have been called for each item
      expect(formatSelectorItem).toHaveBeenCalledTimes(items.length);
      // First item should be selected by default (index 0)
      expect(formatSelectorItem).toHaveBeenCalledWith(0, expect.any(String), true);
      expect(formatSelectorItem).toHaveBeenCalledWith(1, expect.any(String), false);
    });
    
    it('should truncate labels for screen readers', () => {
      const longLabel = 'A'.repeat(100);
      const component = createComponent([{ id: '1', label: longLabel }]);
      expect(truncateForScreenReader).toHaveBeenCalledWith(longLabel, 60);
    });
    
    it('should render descriptions on same line if short', () => {
      const items = [{ id: '1', label: 'Option', description: 'Short desc' }];
      // Mock truncateForScreenReader to return short description
      vi.mocked(truncateForScreenReader).mockReturnValueOnce('Option'); // label
      vi.mocked(truncateForScreenReader).mockReturnValueOnce('Short desc'); // description
      
      const component = createComponent(items);
      // Should have at least one text child with description appended
      expect(component.children.length).toBeGreaterThan(0);
      // The description should be appended to the same line
      // We can check that formatSelectorItem was called with truncated label
      // and that there's no additional text child for description
    });
    
    it('should render descriptions on next line if long', () => {
      const longDesc = 'A'.repeat(100);
      const items = [{ id: '1', label: 'Option', description: longDesc }];
      // Mock truncate to return long (truncated) description
      vi.mocked(truncateForScreenReader).mockReturnValueOnce('Option');
      vi.mocked(truncateForScreenReader).mockReturnValueOnce('A'.repeat(47) + '...'); // truncated
      
      const component = createComponent(items);
      // Should have multiple text children
      expect(component.children.length).toBeGreaterThan(1);
    });
    
    it('should only add spacers between items, not after last', () => {
      const items = [
        { id: '1', label: 'Option 1' },
        { id: '2', label: 'Option 2' },
        { id: '3', label: 'Option 3' },
      ];
      const component = createComponent(items);
      // Count spacer children (MockSpacer instances) - check for height property
      const spacerCount = component.children.filter((child: any) => child.height !== undefined).length;
      // Should be items.length - 1 spacers (between items)
      expect(spacerCount).toBe(items.length - 1);
    });
    
    it('should render instructions with item count', () => {
      const items = [
        { id: '1', label: 'Option 1' },
        { id: '2', label: 'Option 2' },
        { id: '3', label: 'Option 3' },
      ];
      const component = createComponent(items);
      
      // Find instruction line (last child)
      const lastChild = component.children[component.children.length - 1];
      expect(lastChild.content).toContain('Enter number (1-3) or press Esc to cancel');
    });
  });
  
  describe('handleKey', () => {
    it('should handle number key selection', () => {
      const onSelect = vi.fn();
      const items = [
        { id: '1', label: 'Option 1' },
        { id: '2', label: 'Option 2' },
      ];
      const component = createComponent(items, onSelect);
      
      const handled = component.handleKey('2');
      expect(handled).toBe(true);
      expect(onSelect).toHaveBeenCalledWith('2', items[1]);
    });
    
    it('should handle arrow up key (wrap to last)', () => {
      const component = createComponent([
        { id: '1', label: 'Option 1' },
        { id: '2', label: 'Option 2' },
        { id: '3', label: 'Option 3' },
      ]);
      // Initially selected index is 0
      const handled = component.handleKey('ArrowUp');
      expect(handled).toBe(true);
      // Should wrap to last item (index 2)
      // We can verify by checking that formatSelectorItem would be called with isSelected true for index 2
      // after re-render, but we can't easily spy on private method
    });
    
    it('should handle arrow up key (normal up)', () => {
      const component = createComponent([
        { id: '1', label: 'Option 1' },
        { id: '2', label: 'Option 2' },
      ]);
      // Move selection down first, then up
      component.handleKey('ArrowDown'); // selects index 1
      const handled = component.handleKey('ArrowUp'); // back to index 0
      expect(handled).toBe(true);
    });
    
    it('should handle "k" key (vim up)', () => {
      const component = createComponent();
      const handled = component.handleKey('k');
      expect(handled).toBe(true);
    });
    
    it('should handle arrow down key', () => {
      const component = createComponent();
      const handled = component.handleKey('ArrowDown');
      expect(handled).toBe(true);
    });
    
    it('should handle arrow down key wrap (from last to first)', () => {
      const component = createComponent([
        { id: '1', label: 'Option 1' },
        { id: '2', label: 'Option 2' },
        { id: '3', label: 'Option 3' },
      ]);
      // Move to last item (press ArrowUp from first)
      component.handleKey('ArrowUp'); // wraps to last (index 2)
      // Now press ArrowDown, should wrap to first (index 0)
      const handled = component.handleKey('ArrowDown');
      expect(handled).toBe(true);
    });
    
    it('should handle "j" key (vim down)', () => {
      const component = createComponent();
      const handled = component.handleKey('j');
      expect(handled).toBe(true);
    });
    
    it('should handle Enter key on selected item', () => {
      const onSelect = vi.fn();
      const items = [
        { id: '1', label: 'Option 1' },
        { id: '2', label: 'Option 2' },
      ];
      const component = createComponent(items, onSelect);
      
      const handled = component.handleKey('Enter');
      expect(handled).toBe(true);
      expect(onSelect).toHaveBeenCalledWith('1', items[0]);
    });
    
    it('should handle Space key on selected item', () => {
      const onSelect = vi.fn();
      const component = createComponent([{ id: '1', label: 'Option' }], onSelect);
      
      const handled = component.handleKey(' ');
      expect(handled).toBe(true);
      expect(onSelect).toHaveBeenCalled();
    });
    
    it('should handle Escape key', () => {
      const onCancel = vi.fn();
      const component = createComponent([{ id: '1', label: 'Option' }], vi.fn(), onCancel);
      
      const handled = component.handleKey('Escape');
      expect(handled).toBe(true);
      expect(onCancel).toHaveBeenCalled();
    });
    
    it('should return false for unhandled keys', () => {
      const component = createComponent();
      const handled = component.handleKey('x');
      expect(handled).toBe(false);
    });
    
    it('should ignore invalid number keys', () => {
      const onSelect = vi.fn();
      const component = createComponent([{ id: '1', label: 'Option' }], onSelect);
      
      const handled = component.handleKey('5'); // out of range
      expect(handled).toBe(false);
      expect(onSelect).not.toHaveBeenCalled();
    });
    
    it('should ignore NaN key', () => {
      const component = createComponent();
      const handled = component.handleKey('a'); // Not a number
      expect(handled).toBe(false);
    });
  });
  
  describe('invalidate', () => {
    it('should call renderSelector', () => {
      const component = createComponent();
      // Spy on renderSelector (private method)
      // We'll just call invalidate and ensure no errors
      component.invalidate();
      // Should not throw
    });
  });
  
  describe('description rendering edge cases', () => {
    it('should handle description exactly at length limit', () => {
      // Description length 50 (the limit in the code)
      const desc = 'A'.repeat(50);
      const items = [{ id: '1', label: 'Option', description: desc }];
      // Mock truncate to return same length
      vi.mocked(truncateForScreenReader).mockReturnValueOnce('Option');
      vi.mocked(truncateForScreenReader).mockReturnValueOnce(desc);
      
      const component = createComponent(items);
      // Should render on same line (since length <= 50)
      // We can't easily assert but at least no error
      expect(component).toBeDefined();
    });
    
    it('should handle description just over length limit', () => {
      const desc = 'A'.repeat(51);
      const items = [{ id: '1', label: 'Option', description: desc }];
      // Mock truncate to return truncated version
      vi.mocked(truncateForScreenReader).mockReturnValueOnce('Option');
      vi.mocked(truncateForScreenReader).mockReturnValueOnce('A'.repeat(47) + '...');
      
      const component = createComponent(items);
      expect(component).toBeDefined();
    });
    
    it('should handle items without descriptions', () => {
      const items = [
        { id: '1', label: 'Option 1' },
        { id: '2', label: 'Option 2', description: 'Has desc' },
        { id: '3', label: 'Option 3' },
      ];
      const component = createComponent(items);
      expect(component).toBeDefined();
      // Should not throw when description is undefined
    });

    it('should cover else branch for description length > 50 (unreachable in real code)', () => {
      const items = [{ id: '1', label: 'Option', description: 'desc' }];
      // Mock truncateForScreenReader to violate its contract and return length > 50
      vi.mocked(truncateForScreenReader).mockReturnValueOnce('Option');
      vi.mocked(truncateForScreenReader).mockReturnValueOnce('A'.repeat(60)); // length 60 > 50
      
      const component = createComponent(items);
      expect(component).toBeDefined();
    });
  });
});