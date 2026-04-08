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

  return {
    Container: MockContainer,
    Text: MockText,
    Spacer: MockSpacer,
  };
});

vi.mock('../src/lib/formatting.ts', () => ({
  formatSelectorItem: vi.fn().mockImplementation((index, label, isSelected) => {
    const prefix = isSelected ? '> ' : '  ';
    return `${prefix}[${index + 1}] ${label}`;
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
      expect(firstChild.content).toBe('Select an option');
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

    it('should render descriptions on separate lines', () => {
      const items = [{ id: '1', label: 'Option', description: 'Short desc' }];
      const component = createComponent(items);
      expect(component.children.some((child: any) => child.content === '    Short desc')).toBe(true);
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

    it('should return false for unhandled keys', () => {
      const component = createComponent();
      const handled = component.handleKey('x');
      expect(handled).toBe(false);
    });

    it('should ignore invalid number keys', () => {
      const onSelect = vi.fn();
      const component = createComponent([{ id: '1', label: 'Option' }], onSelect);

      const handled = component.handleKey('5');
      expect(handled).toBe(false);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('should ignore NaN key', () => {
      const component = createComponent();
      const handled = component.handleKey('a');
      expect(handled).toBe(false);
    });
  });

  describe('invalidate', () => {
    it('should call renderSelector', () => {
      const component = createComponent();
      component.invalidate();
    });
  });

  describe('description rendering edge cases', () => {
    it('should handle long descriptions without truncation', () => {
      const desc = 'A'.repeat(100);
      const items = [{ id: '1', label: 'Option', description: desc }];
      const component = createComponent(items);
      expect(component.children.some((child: any) => child.content === `    ${desc}`)).toBe(true);
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
