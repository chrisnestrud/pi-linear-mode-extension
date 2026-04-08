import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import selectorRendererExtension from '../src/extensions/selector-renderer.ts';
import { formatSelectorItem } from '../src/lib/formatting.ts';

vi.mock('@mariozechner/pi-tui', () => {
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

  class MockText {
    constructor(public content: string, public x: number, public y: number) {}
  }

  class MockSpacer {
    constructor(public height: number) {}
  }

  class MockInput {
    private value = '';
    getValue() {
      return this.value;
    }
    setValue(value: string) {
      this.value = value;
    }
    handleInput(data: string) {
      if (data === '\u0015') {
        this.value = '';
        return;
      }
      if (data === '\u0017') {
        let end = this.value.length;
        while (end > 0 && /\s/.test(this.value[end - 1]!)) end--;
        let start = end;
        while (start > 0 && !/\s/.test(this.value[start - 1]!)) start--;
        this.value = this.value.slice(0, start);
        return;
      }
      if (data === 'Backspace') {
        this.value = this.value.slice(0, -1);
        return;
      }
      if (data.length === 1 && data >= ' ' && data !== '\u007f') {
        this.value += data;
      }
    }
  }

  function mockFuzzyFilter<T>(items: T[], query: string, getText: (item: T) => string): T[] {
    if (!query.trim()) return items;
    const tokens = query.trim().toLowerCase().split(/\s+/);
    return items
      .map((item) => ({ item, text: getText(item).toLowerCase() }))
      .filter(({ text }) => tokens.every((token) => {
        let index = 0;
        for (const char of token) {
          index = text.indexOf(char, index);
          if (index === -1) return false;
          index++;
        }
        return true;
      }))
      .map(({ item }) => item);
  }

  return {
    Container: MockContainer,
    Text: MockText,
    Spacer: MockSpacer,
    Input: MockInput,
    fuzzyFilter: mockFuzzyFilter,
  };
});

vi.mock('../src/lib/formatting.ts', () => ({
  formatSelectorItem: vi.fn().mockImplementation((index, label, isSelected) => {
    const prefix = isSelected ? '> ' : '  ';
    return `${prefix}[${index + 1}] ${label}`;
  }),
  formatUIMessage: vi.fn().mockImplementation((message) => `[${message}]`),
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

    selectorRendererExtension(mockPi);
  });

  it('should register selector renderers for all types', () => {
    expect(mockPi.registerSelectorRenderer).toHaveBeenCalledTimes(5);
    const expectedTypes = ['user-message', 'model', 'session', 'oauth-login', 'oauth-logout'];
    for (const type of expectedTypes) {
      expect(registeredRenderers.has(type)).toBe(true);
    }
  });

  it('should test all renderer types work correctly', () => {
    const items = [{ id: '1', label: 'Test' }];
    const onSelect = vi.fn();
    const onCancel = vi.fn();

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
    options = {},
  ) {
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
      expect(component.children.length).toBeGreaterThan(0);
      const lastChild = component.children[component.children.length - 1];
      expect(lastChild.content).toContain('Enter number (1-0) or press Esc to cancel');
    });

    it('should render title when provided', () => {
      const component = createComponent([{ id: '1', label: 'Option' }], vi.fn(), vi.fn(), { title: 'Select an option' });
      expect(component.children.length).toBeGreaterThan(2);
      const firstChild = component.children[0];
      expect(firstChild.content).toBe('[Select an option]');
    });

    it('should render numbered items with formatting', () => {
      const items = [
        { id: '1', label: 'Option 1' },
        { id: '2', label: 'Option 2' },
      ];
      createComponent(items);
      expect(formatSelectorItem).toHaveBeenCalledTimes(items.length);
      expect(formatSelectorItem).toHaveBeenCalledWith(0, 'Option 1', true);
      expect(formatSelectorItem).toHaveBeenCalledWith(1, 'Option 2', false);
    });

    it('should render full labels without truncation', () => {
      const longLabel = 'A'.repeat(100);
      createComponent([{ id: '1', label: longLabel }]);
      expect(formatSelectorItem).toHaveBeenCalledWith(0, longLabel, true);
    });

    it('should inline short descriptions into selector labels', () => {
      const items = [{ id: '1', label: 'Option', description: 'Short desc' }];
      createComponent(items);
      expect(formatSelectorItem).toHaveBeenCalledWith(0, 'Option - Short desc', true);
    });

    it('should render long descriptions as bracketed description lines', () => {
      const items = [{ id: '1', label: 'Option', description: 'A'.repeat(80) }];
      const component = createComponent(items);
      expect(component.children.some((child: any) => child.content === `[Description: ${'A'.repeat(80)}]`)).toBe(true);
    });

    it('should only add spacers between items, not after last', () => {
      const items = [
        { id: '1', label: 'Option 1' },
        { id: '2', label: 'Option 2' },
        { id: '3', label: 'Option 3' },
      ];
      const component = createComponent(items);
      const spacerCount = component.children.filter((child: any) => child.height !== undefined).length;
      expect(spacerCount).toBe(items.length - 1);
    });

    it('should render instructions with item count', () => {
      const items = [
        { id: '1', label: 'Option 1' },
        { id: '2', label: 'Option 2' },
        { id: '3', label: 'Option 3' },
      ];
      const component = createComponent(items);
      const lastChild = component.children[component.children.length - 1];
      expect(lastChild.content).toContain('Enter number (1-3) or press Esc to cancel');
      expect(lastChild.content).toContain('type to filter');
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
      const handled = component.handleKey('ArrowUp');
      expect(handled).toBe(true);
    });

    it('should handle arrow up key (normal up)', () => {
      const component = createComponent([
        { id: '1', label: 'Option 1' },
        { id: '2', label: 'Option 2' },
      ]);
      component.handleKey('ArrowDown');
      const handled = component.handleKey('ArrowUp');
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
      component.handleKey('ArrowUp');
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

    it('should handle alternate escape keys', () => {
      const onCancel = vi.fn();
      const component = createComponent([{ id: '1', label: 'Option' }], vi.fn(), onCancel);

      expect(component.handleKey('Esc')).toBe(true);
      expect(component.handleKey('escape')).toBe(true);
      expect(component.handleKey('\u001b')).toBe(true);
      expect(onCancel).toHaveBeenCalledTimes(3);
    });

    it('should clear filter on first escape and cancel on second', () => {
      const onCancel = vi.fn();
      const component = createComponent([
        { id: '1', label: 'Alpha' },
        { id: '2', label: 'Beta' },
      ], vi.fn(), onCancel);

      component.handleKey('a');
      expect(component.children.some((child: any) => child.content === '[Filter: a]')).toBe(true);

      expect(component.handleKey('Escape')).toBe(true);
      expect(component.children.some((child: any) => child.content === '[Filter: ]')).toBe(true);
      expect(onCancel).not.toHaveBeenCalled();

      expect(component.handleKey('Escape')).toBe(true);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should use printable keys to filter items', () => {
      const items = [
        { id: '1', label: 'Alpha' },
        { id: '2', label: 'Beta' },
      ];
      const component = createComponent(items);

      const handled = component.handleKey('a');
      expect(handled).toBe(true);
      expect(component.children.some((child: any) => child.content === '[Filter: a]')).toBe(true);
    });

    it('should keep original label when filter only matches description or id', () => {
      const component = createComponent([
        { id: 'alpha-1', label: 'Zeta', description: 'Matches query' },
      ]);

      component.handleKey('a');
      expect(formatSelectorItem).toHaveBeenCalledWith(0, 'Zeta - Matches query', true);
    });

    it('should fuzzy filter without decorative markers', () => {
      const items = [
        { id: '1', label: 'Gamma Model' },
        { id: '2', label: 'Gpt Mini' },
        { id: '3', label: 'Gemini Pro' },
      ];
      const component = createComponent(items);

      component.handleKey('g');
      component.handleKey('m');

      expect(component.children.some((child: any) => typeof child.content === 'string' && child.content.includes('‹'))).toBe(false);
      expect(component.children.some((child: any) => typeof child.content === 'string' && child.content.includes('›'))).toBe(false);
      expect(component.children.some((child: any) => child.content === '> [1] Gamma Model')).toBe(true);
    });

    it('should treat invalid number keys as filter input', () => {
      const onSelect = vi.fn();
      const component = createComponent([{ id: '1', label: 'Option' }], onSelect);

      const handled = component.handleKey('5');
      expect(handled).toBe(true);
      expect(onSelect).not.toHaveBeenCalled();
      expect(component.children.some((child: any) => child.content === '[Filter: 5]')).toBe(true);
    });

    it('should handle lowercase text input as filtering', () => {
      const component = createComponent();
      const handled = component.handleKey('x');
      expect(handled).toBe(true);
      expect(component.children.some((child: any) => child.content === '[Filter: x]')).toBe(true);
    });
  });

  describe('invalidate', () => {
    it('should call renderSelector', () => {
      const component = createComponent();
      component.invalidate();
    });

    it('should support backspace while filtering', () => {
      const component = createComponent([
        { id: '1', label: 'Alpha' },
        { id: '2', label: 'Beta' },
      ]);

      component.handleKey('a');
      expect(component.children.some((child: any) => child.content === '[Filter: a]')).toBe(true);

      const handled = component.handleKey('Backspace');
      expect(handled).toBe(true);
      expect(component.children.some((child: any) => child.content === '[Filter: ]')).toBe(true);
    });

    it('should support Ctrl+W while filtering', () => {
      const component = createComponent([
        { id: '1', label: 'Alpha Beta Gamma' },
      ]);

      component.handleKey('A');
      component.handleKey('l');
      component.handleKey('p');
      component.handleKey('h');
      component.handleKey('a');
      component.handleKey(' ');
      component.handleKey('B');
      component.handleKey('e');
      component.handleKey('t');
      component.handleKey('a');
      expect(component.children.some((child: any) => child.content === '[Filter: Alpha Beta]')).toBe(true);

      const handled = component.handleKey('\u0017');
      expect(handled).toBe(true);
      expect(component.children.some((child: any) => child.content === '[Filter: Alpha ]')).toBe(true);
    });

    it('should support Ctrl+U while filtering', () => {
      const component = createComponent([{ id: '1', label: 'Alpha' }]);
      component.handleKey('a');
      component.handleKey('b');
      expect(component.children.some((child: any) => child.content === '[Filter: ab]')).toBe(true);

      const handled = component.handleKey('\u0015');
      expect(handled).toBe(true);
      expect(component.children.some((child: any) => child.content === '[Filter: ]')).toBe(true);
    });

    it('should show filter-specific instructions while filtering', () => {
      const component = createComponent([{ id: '1', label: 'Alpha' }]);
      component.handleKey('a');
      const lastChild = component.children[component.children.length - 1];
      expect(lastChild.content).toContain('Esc clears filter, then cancels');
      expect(lastChild.content).toContain('Ctrl+W deletes word');
      expect(lastChild.content).toContain('Ctrl+U clears filter');
    });

    it('should handle Enter and Space gracefully when there are no visible items', () => {
      const onSelect = vi.fn();
      const component = createComponent([{ id: '1', label: 'Alpha' }], onSelect);
      component.handleKey('z');

      expect(component.handleKey('Enter')).toBe(true);
      expect(component.handleKey(' ')).toBe(true);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('should handle Space gracefully when filtering yields no visible items after whitespace input', () => {
      const onSelect = vi.fn();
      const component = createComponent([{ id: '1', label: 'Alpha' }], onSelect);
      component.handleKey('z');
      component.handleKey(' ');

      expect(component.handleKey(' ')).toBe(true);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('should return false for an unhandled non-editing key', () => {
      const component = createComponent([{ id: '1', label: 'Alpha' }]);
      expect(component.handleKey('Tab')).toBe(false);
    });
  });

  describe('description rendering edge cases', () => {
    it('should handle long descriptions without truncation', () => {
      const desc = 'A'.repeat(100);
      const items = [{ id: '1', label: 'Option', description: desc }];
      const component = createComponent(items);
      expect(component.children.some((child: any) => child.content === `[Description: ${desc}]`)).toBe(true);
    });

    it('should handle items without descriptions', () => {
      const items = [
        { id: '1', label: 'Option 1' },
        { id: '2', label: 'Option 2', description: 'Has desc' },
        { id: '3', label: 'Option 3' },
      ];
      const component = createComponent(items);
      expect(component).toBeDefined();
    });
  });
});
