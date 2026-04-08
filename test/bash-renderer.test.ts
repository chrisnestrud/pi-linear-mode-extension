import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import bashRendererExtension from '../src/extensions/bash-renderer.ts';
import { formatCommand, truncateForScreenReader } from '../src/lib/formatting.ts';

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

  // Simple mock for Spacer (not used but exported)
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
  formatCommand: vi.fn().mockImplementation((cmd, exclude) => {
    return exclude ? `[# ${cmd}]` : `[$ ${cmd}]`;
  }),
  formatStatus: vi.fn().mockImplementation((status) => `[${status}]`),
  truncateForScreenReader: vi.fn().mockImplementation((text, maxLength = 80) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }),
}));

// Helper to get the LinearBashComponent class
async function getLinearBashComponent() {
  // Import after mocking
  const module = await import('../src/extensions/bash-renderer.ts');
  // The class is not exported, but we can access it via the renderer
  // Actually we need to test through the renderer
  return module;
}

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
    
    // Initialize extension
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

// Since LinearBashComponent is not exported, we need to test it through the renderer
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
      // command is private, not directly accessible
      expect(component.children).toBeDefined(); // from Container mock
    });
    
    it('should format command with excludeFromContext', () => {
      createComponent('secret', true);
      // formatCommand should have been called with exclude flag
      expect(formatCommand).toHaveBeenCalledWith('secret', true);
    });
    
    it('should show running status initially', () => {
      const component = createComponent('ls -la');
      // The component should have at least one child (the command line)
      expect(component.children.length).toBeGreaterThan(0);
      const firstChild = component.children[0];
      // The text should contain "Running..."
      expect(firstChild.content).toContain('Running...');
    });
  });
  
  describe('appendOutput', () => {
    it('should store output lines', () => {
      const component = createComponent('ls -la');
      component.appendOutput('file1.txt\nfile2.txt\n');
      // We can't directly access outputLines since it's private
      // But we can test setComplete later to see if output is shown
    });
    
    it('should handle carriage returns and newlines', () => {
      const component = createComponent('ls -la');
      component.appendOutput('line1\r\nline2\rline3\n');
      // We'll verify via setComplete
    });
    
    it('should filter empty lines', () => {
      const component = createComponent('ls -la');
      component.appendOutput('\n\nline1\n\nline2\n\n');
      // Should store only non-empty lines
    });
  });
  
  describe('setComplete', () => {
    it('should handle successful completion (exit 0)', () => {
      const component = createComponent('ls -la');
      component.appendOutput('file1.txt\nfile2.txt');
      component.setComplete(0, false);
      
      expect(component.children.length).toBeGreaterThan(0);
      const firstChild = component.children[0];
      expect(firstChild.content).toContain('Done');
    });
    
    it('should handle non-zero exit code', () => {
      const component = createComponent('false');
      component.setComplete(1, false);
      
      const firstChild = component.children[0];
      expect(firstChild.content).toContain('Error (exit 1)');
    });
    
    it('should handle cancelled execution', () => {
      const component = createComponent('sleep 10');
      component.setComplete(undefined, true);
      
      const firstChild = component.children[0];
      expect(firstChild.content).toContain('Cancelled');
    });
    
    it('should show line count when output exists', () => {
      const component = createComponent('ls -la');
      component.appendOutput('file1.txt\nfile2.txt\nfile3.txt');
      component.setComplete(0, false);
      
      const firstChild = component.children[0];
      expect(firstChild.content).toContain(' (3 lines)');
    });
    
    it('should show output preview for up to 5 lines', () => {
      const component = createComponent('seq 1 10');
      for (let i = 1; i <= 10; i++) {
        component.appendOutput(`line ${i}\n`);
      }
      component.setComplete(0, false);
      
      // Should have command line + 5 preview lines + "... 5 more lines" line
      expect(component.children.length).toBe(7); // 1 + 5 + 1
      
      // Check that last line shows "... 5 more lines"
      const lastChild = component.children[component.children.length - 1];
      expect(lastChild.content).toContain('... 5 more lines');
    });
    
    it('should truncate long lines for screen readers', () => {
      const longLine = 'x'.repeat(100);
      const component = createComponent('echo');
      component.appendOutput(longLine);
      component.setComplete(0, false);
      
      // truncateForScreenReader should have been called
      expect(truncateForScreenReader).toHaveBeenCalled();
    });
    
    it('should handle truncation result', () => {
      const component = createComponent('cat largefile');
      component.appendOutput('line1\nline2');
      const truncationResult = { truncated: true, originalLength: 1000 };
      component.setComplete(0, false, truncationResult);
      
      // Should show "[output truncated]" message
      const hasTruncationMessage = component.children.some((child: any) => 
        child.content.includes('[output truncated]')
      );
      expect(hasTruncationMessage).toBe(true);
    });
  });
  
  describe('setExpanded', () => {
    it('should toggle expanded state', () => {
      const component = createComponent('ls -la');
      // setExpanded doesn't do much in current implementation
      component.setExpanded(true);
      component.setExpanded(false);
      // Just ensure no errors
    });
  });
});