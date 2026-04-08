import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import bashRendererExtension, { LinearBashComponent } from '../src/extensions/bash-renderer.ts';
import { formatCommand, formatStatus } from '../src/lib/formatting.ts';

// Mock pi-tui module
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

  return {
    Container: MockContainer,
    Text: MockText,
  };
});

vi.mock('@mariozechner/pi-coding-agent', async () => {
  const actual = await vi.importActual<any>('@mariozechner/pi-coding-agent');
  return {
    ...actual,
    keyHint: vi.fn().mockImplementation((_key: string, description: string) => `ctrl+o ${description}`),
  };
});

// Mock formatting functions
vi.mock('../src/lib/formatting.ts', () => ({
  formatCommand: vi.fn().mockImplementation((cmd, exclude) => {
    return exclude ? `[# ${cmd}]` : `[$ ${cmd}]`;
  }),
  formatStatus: vi.fn().mockImplementation((status) => `[${status}]`),
}));

describe('bash-renderer extension', () => {
  let mockPi: ExtensionAPI;
  let sessionStartHandler: ((event: any, ctx: any) => Promise<void>) | undefined;
  let mockCtx: any;
  let registeredBashRenderer: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCtx = {
      hasUI: true,
      ui: {
        notify: vi.fn(),
      },
    };

    registeredBashRenderer = undefined;
    mockPi = {
      registerBashRenderer: vi.fn((renderer) => {
        registeredBashRenderer = renderer;
      }),
      on: vi.fn((event: string, handler: any) => {
        if (event === 'session_start') {
          sessionStartHandler = handler;
        }
      }),
    } as unknown as ExtensionAPI;

    bashRendererExtension(mockPi);
  });

  it('should register a bash renderer', () => {
    expect(mockPi.registerBashRenderer).toHaveBeenCalledTimes(1);
    expect(registeredBashRenderer).toBeDefined();
    expect(typeof registeredBashRenderer).toBe('function');
  });

  it('should register session_start listener', () => {
    expect(mockPi.on).toHaveBeenCalledWith('session_start', expect.any(Function));
    expect(sessionStartHandler).toBeDefined();
  });

  it('should notify when UI is available on session start', async () => {
    await sessionStartHandler!({}, mockCtx);
    expect(mockCtx.ui.notify).toHaveBeenCalledWith('[Linear bash rendering enabled]', 'info');
  });

  it('should not notify when UI is not available', async () => {
    mockCtx.hasUI = false;
    await sessionStartHandler!({}, mockCtx);
    expect(mockCtx.ui.notify).not.toHaveBeenCalled();
  });
});

describe('LinearBashComponent (via renderer)', () => {
  let mockPi: ExtensionAPI;
  let registeredBashRenderer: any;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredBashRenderer = undefined;
    mockPi = {
      registerBashRenderer: vi.fn((renderer) => {
        registeredBashRenderer = renderer;
      }),
      on: vi.fn(),
    } as unknown as ExtensionAPI;

    bashRendererExtension(mockPi);
  });

  function createComponent(command: string = 'ls -la', excludeFromContext: boolean = false) {
    return registeredBashRenderer(command, {}, excludeFromContext);
  }

  describe('initial state', () => {
    it('should create component with command', () => {
      const component = createComponent('ls -la');
      expect(component).toBeDefined();
      expect(component.children).toBeDefined();
    });

    it('should format command with excludeFromContext', () => {
      createComponent('secret', true);
      expect(formatCommand).toHaveBeenCalledWith('secret', true);
    });

    it('should show running status initially', () => {
      const component = createComponent('ls -la');
      expect(component.children.length).toBeGreaterThan(0);
      const firstChild = component.children[0];
      expect(firstChild.content).toContain('[Running...]');
      expect(formatStatus).toHaveBeenCalledWith('Running...');
    });
  });

  describe('appendOutput', () => {
    it('should store output lines', () => {
      const component = createComponent('ls -la');
      component.appendOutput('file1.txt\nfile2.txt\n');
    });

    it('should handle carriage returns and newlines', () => {
      const component = createComponent('ls -la');
      component.appendOutput('line1\r\nline2\rline3\n');
    });

    it('should filter empty lines', () => {
      const component = createComponent('ls -la');
      component.appendOutput('\n\nline1\n\nline2\n\n');
    });
  });

  describe('setComplete', () => {
    it('should handle successful completion (exit 0)', () => {
      const component = createComponent('ls -la');
      component.appendOutput('file1.txt\nfile2.txt');
      component.setComplete(0, false);

      expect(component.children.length).toBeGreaterThan(0);
      const firstChild = component.children[0];
      const secondChild = component.children[1];
      expect(firstChild.content).toContain('[Done (2 lines)]');
      expect(secondChild.content).toContain('[$ ls -la]');
    });

    it('should handle non-zero exit code', () => {
      const component = createComponent('false');
      component.setComplete(1, false);

      const firstChild = component.children[0];
      expect(firstChild.content).toContain('[Exit 1]');
    });

    it('should handle cancelled execution', () => {
      const component = createComponent('sleep 10');
      component.setComplete(undefined, true);

      const firstChild = component.children[0];
      expect(firstChild.content).toContain('[Cancelled]');
    });

    it('should show line count when output exists', () => {
      const component = createComponent('ls -la');
      component.appendOutput('file1.txt\nfile2.txt\nfile3.txt');
      component.setComplete(0, false);

      const firstChild = component.children[0];
      expect(firstChild.content).toContain('[Done (3 lines)]');
    });

    it('should show output preview for up to 5 lines', () => {
      const component = createComponent('seq 1 10');
      for (let i = 1; i <= 10; i++) {
        component.appendOutput(`line ${i}\n`);
      }
      component.setComplete(0, false);

      expect(component.children.length).toBe(8);
      const lastChild = component.children[component.children.length - 1];
      expect(lastChild.content).toContain('... (5 more lines, ctrl+o to expand)');
    });

    it('should preserve long lines without per-line truncation', () => {
      const longLine = 'x'.repeat(100);
      const component = createComponent('echo');
      component.appendOutput(longLine);
      component.setComplete(0, false);

      const outputChild = component.children[2];
      expect(outputChild.content).toBe(longLine);
    });

    it('should handle truncation result', () => {
      const component = createComponent('cat largefile');
      component.appendOutput('line1\nline2');
      const truncationResult = { truncated: true, originalLength: 1000 };
      component.setComplete(0, false, truncationResult);

      const firstChild = component.children[0];
      expect(firstChild.content).toContain('[Done (2 lines) [output truncated]]');
    });
  });

  describe('setExpanded', () => {
    it('should toggle expanded state', () => {
      const component = createComponent('ls -la');
      component.appendOutput('line1\nline2\nline3\nline4\nline5\nline6');
      component.setComplete(0, false);
      component.setExpanded(true);
      let lastChild = component.children[component.children.length - 1];
      expect(lastChild.content).toContain('ctrl+o to collapse');
      component.setExpanded(false);
      lastChild = component.children[component.children.length - 1];
      expect(lastChild.content).toContain('ctrl+o to expand');
    });
  });
});

describe('LinearBashComponent internal rendering edge cases', () => {
  it('should render non-zero exit code when status is complete', () => {
    const component = new LinearBashComponent('test', false);
    (component as any).exitCode = 1;
    (component as any).status = 'complete';
    (component as any).outputLines = [];
    (component as any).renderCurrent();
    expect(component.children.length).toBeGreaterThan(0);
    const firstChild = component.children[0];
    expect(firstChild.content).toContain('[Exit 1]');
  });
});
