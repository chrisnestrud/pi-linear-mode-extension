import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import * as piCodingAgent from '@mariozechner/pi-coding-agent';
import toolRenderersExtension from '../src/extensions/tool-renderers.ts';
import { formatToolCall, formatToolResult, truncateForScreenReader } from '../src/lib/formatting.ts';

// Mock the underlying tool creation functions
vi.mock('@mariozechner/pi-coding-agent', () => {
  const createMockTool = () => ({
    description: 'Mock tool description',
    parameters: { type: 'object', properties: {} },
    execute: vi.fn(),
  });
  
  const mockTools = {
    read: createMockTool(),
    bash: createMockTool(),
    write: createMockTool(),
    edit: createMockTool(),
    find: createMockTool(),
    grep: createMockTool(),
    ls: createMockTool(),
  };
  
  return {
    createReadTool: vi.fn(() => mockTools.read),
    createBashTool: vi.fn(() => mockTools.bash),
    createWriteTool: vi.fn(() => mockTools.write),
    createEditTool: vi.fn(() => mockTools.edit),
    createFindTool: vi.fn(() => mockTools.find),
    createGrepTool: vi.fn(() => mockTools.grep),
    createLsTool: vi.fn(() => mockTools.ls),
  };
});

// Mock formatting functions
vi.mock('../src/lib/formatting.ts', () => ({
  formatToolCall: vi.fn().mockImplementation((name: string, args: any) => `[${name}] ${JSON.stringify(args)}`),
  formatToolResult: vi.fn().mockImplementation((text: string) => `Result: ${text}`),
  truncateForScreenReader: vi.fn().mockImplementation((text: string) => text.length > 50 ? text.substring(0, 47) + '...' : text),
}));

// Mock pi-tui Text (must be a class constructor)
vi.mock('@mariozechner/pi-tui', () => {
  class MockText {
    constructor(public content: string, public x: number, public y: number) {}
  }
  return { Text: MockText };
});

describe('tool-renderers extension', () => {
  let mockPi: ExtensionAPI;
  let registeredTools: Map<string, any>;
  
  beforeEach(() => {
    vi.clearAllMocks();
    registeredTools = new Map();
    mockPi = {
      registerTool: vi.fn((tool: any) => {
        registeredTools.set(tool.name, tool);
      }),
    } as unknown as ExtensionAPI;
    
    // Initialize extension
    toolRenderersExtension(mockPi);
  });
  
  it('should register all 7 tools', () => {
    expect(mockPi.registerTool).toHaveBeenCalledTimes(7);
    const expectedTools = ['read', 'bash', 'write', 'edit', 'find', 'grep', 'ls'];
    for (const name of expectedTools) {
      expect(registeredTools.has(name)).toBe(true);
    }
  });
  
  function getTool(name: string) {
    const tool = registeredTools.get(name);
    expect(tool).toBeDefined();
    return tool;
  }
  
  describe('read tool', () => {
    it('should render call with args', () => {
      const tool = getTool('read');
      const args = { path: '/tmp/file.txt', offset: 0, limit: 100 };
      const component = tool.renderCall(args, {}, {});
      expect(component.content).toBe('[read] {"path":"/tmp/file.txt","offset":0,"limit":100}');
      expect(formatToolCall).toHaveBeenCalledWith('read', args);
    });
    
    it('should render partial result', () => {
      const tool = getTool('read');
      const component = tool.renderResult({} as any, { isPartial: true }, {}, {});
      expect(component.content).toBe('[reading...]');
    });
    
    it('should render result with non-text content', () => {
      const tool = getTool('read');
      const result = {
        content: [{ type: 'image' as const }],
        details: undefined,
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toBe('Result: read complete');
      expect(formatToolResult).toHaveBeenCalledWith('read complete');
    });
    
    it('should render result with empty text content', () => {
      const tool = getTool('read');
      const result = {
        content: [{ type: 'text' as const, text: '' }],
        details: { truncation: { truncated: false, totalLines: 0 } },
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      // Empty string split by newline gives one empty line
      expect(component.content).toContain('1 lines');
      expect(component.content).not.toContain('...'); // no preview because no non-empty lines
    });
    
    it('should render result with text content and truncation', () => {
      const tool = getTool('read');
      const result = {
        content: [{ type: 'text' as const, text: 'line1\nline2\nline3' }],
        details: { truncation: { truncated: true, totalLines: 10 } },
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toContain('3 lines (truncated from 10 lines)');
    });
    
    it('should render preview when lines exceed limit', () => {
      const tool = getTool('read');
      const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n');
      const result = {
        content: [{ type: 'text' as const, text: lines }],
        details: { truncation: { truncated: false, totalLines: 20 } },
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toContain('20 lines');
      expect(component.content).toContain('... 12 more lines'); // limit is 8
    });
  });
  
  describe('bash tool', () => {
    it('should render call with short command', () => {
      const tool = getTool('bash');
      const args = { command: 'ls -la', excludeFromContext: false };
      const component = tool.renderCall(args, {}, {});
      expect(component.content).toBe('[bash] {"command":"ls -la","excludeFromContext":false}');
      expect(formatToolCall).toHaveBeenCalledWith('bash', { command: 'ls -la', excludeFromContext: false });
    });
    
    it('should render call with long command (truncated)', () => {
      const tool = getTool('bash');
      const longCommand = 'x'.repeat(150);
      const args = { command: longCommand, excludeFromContext: false };
      const component = tool.renderCall(args, {}, {});
      // formatToolCall should be called with truncated command
      expect(formatToolCall).toHaveBeenCalledWith('bash', {
        command: longCommand.slice(0, 97) + '...',
        excludeFromContext: false,
      });
      // Component content is whatever mock returns
      expect(component.content).toBe('[bash] {"command":"' + longCommand.slice(0, 97) + '...","excludeFromContext":false}');
    });
    
    it('should render partial result', () => {
      const tool = getTool('bash');
      const component = tool.renderResult({} as any, { isPartial: true }, {}, {});
      expect(component.content).toBe('[running...]');
    });
    
    it('should render result with exit code 0', () => {
      const tool = getTool('bash');
      const result = {
        content: [{ type: 'text' as const, text: 'output line1\noutput line2\nexit code: 0' }],
        details: { truncation: { truncated: false, totalLines: 3 } },
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toContain('done (3 lines)');
    });
    
    it('should render result with non-zero exit code', () => {
      const tool = getTool('bash');
      const result = {
        content: [{ type: 'text' as const, text: 'error output\nexit code: 1' }],
        details: { truncation: { truncated: false, totalLines: 2 } },
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toContain('exit 1 (2 lines)');
    });
    
    it('should render result with truncated output', () => {
      const tool = getTool('bash');
      const result = {
        content: [{ type: 'text' as const, text: 'output' }],
        details: { truncation: { truncated: true, totalLines: 100 } },
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toContain('[truncated from 100 lines]');
    });
    
    it('should render result with no lines', () => {
      const tool = getTool('bash');
      const result = {
        content: [{ type: 'text' as const, text: '' }],
        details: { truncation: { truncated: false, totalLines: 0 } },
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toContain('done');
      expect(component.content).not.toContain('('); // no lines count
    });

    it('should render result with non-text content', () => {
      const tool = getTool('bash');
      const result = {
        content: [{ type: 'image' as const }],
        details: undefined,
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toBe('Result: done');
    });

    it('should render result with no exit code in output', () => {
      const tool = getTool('bash');
      const result = {
        content: [{ type: 'text' as const, text: 'some output without exit code' }],
        details: undefined,
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toContain('done');
      expect(component.content).toContain('1 line');
    });

    it('should render result with undefined details', () => {
      const tool = getTool('bash');
      const result = {
        content: [{ type: 'text' as const, text: 'output' }],
        details: undefined,
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toContain('done');
      expect(component.content).not.toContain('truncated');
    });

    it('should handle missing capture group in exit code regex', () => {
      // This tests the ?? "0" fallback in line 92
      const tool = getTool('bash');
      const output = 'exit code: '; // No number after colon
      // Mock match to return array with missing capture group
      const originalMatch = String.prototype.match;
      const mockMatch = vi.fn().mockReturnValue(['exit code: ', undefined]);
      String.prototype.match = mockMatch;
      try {
        const result = {
          content: [{ type: 'text' as const, text: output }],
          details: undefined,
        };
        const component = tool.renderResult(result, { isPartial: false }, {}, {});
        // Should not crash, exitCode should be 0 (default)
        expect(mockMatch).toHaveBeenCalled();
        expect(component.content).toContain('done');
      } finally {
        String.prototype.match = originalMatch;
      }
    });
  });
  
  describe('write tool', () => {
    it('should render call with args', () => {
      const tool = getTool('write');
      const args = { path: '/tmp/file.txt', content: 'hello' };
      const component = tool.renderCall(args, {}, {});
      expect(component.content).toBe('[write] {"path":"/tmp/file.txt","content":"hello"}');
    });
    
    it('should render partial result', () => {
      const tool = getTool('write');
      const component = tool.renderResult({} as any, { isPartial: true }, {}, {});
      expect(component.content).toBe('[writing...]');
    });
    
    it('should render complete result', () => {
      const tool = getTool('write');
      const component = tool.renderResult({} as any, { isPartial: false }, {}, {});
      expect(component.content).toBe('Result: written');
    });
  });
  
  describe('edit tool', () => {
    it('should render call with args', () => {
      const tool = getTool('edit');
      const args = { path: '/tmp/file.txt', edits: [] };
      const component = tool.renderCall(args, {}, {});
      expect(component.content).toBe('[edit] {"path":"/tmp/file.txt","edits":[]}');
    });
    
    it('should render partial result', () => {
      const tool = getTool('edit');
      const component = tool.renderResult({} as any, { isPartial: true }, {}, {});
      expect(component.content).toBe('[editing...]');
    });
    
    it('should render result with non-text content', () => {
      const tool = getTool('edit');
      const result = {
        content: [{ type: 'image' as const }],
        details: undefined,
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toBe('Result: edit complete');
    });
    
    it('should render result with diff text', () => {
      const tool = getTool('edit');
      const diffText = '--- a/file.txt\n+++ b/file.txt\n@@ -1,1 +1,1 @@\n-old\n+new';
      const result = {
        content: [{ type: 'text' as const, text: diffText }],
        details: undefined,
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      // Total non-empty lines: 5 (---, +++, @@, -old, +new)
      expect(component.content).toContain('5 diff lines');
      // Preview filters header lines
      expect(component.content).not.toContain('---'); // diff lines filtered
    });
    
    it('should render preview when diff lines exceed limit', () => {
      const tool = getTool('edit');
      // Create many diff lines (filtered lines only count non-header)
      const lines = Array.from({ length: 20 }, (_, i) => `+line ${i + 1}`).join('\n');
      const diffText = `--- a/file.txt\n+++ b/file.txt\n@@ -1,1 +1,20 @@\n${lines}`;
      const result = {
        content: [{ type: 'text' as const, text: diffText }],
        details: undefined,
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      // Total non-empty lines: 3 headers + 20 content = 23
      expect(component.content).toContain('23 diff lines');
      // Preview shows filtered content lines (limit 6)
      expect(component.content).toContain('... 14 more diff lines');
    });

    it('should render result with empty diff text', () => {
      const tool = getTool('edit');
      const result = {
        content: [{ type: 'text' as const, text: '' }],
        details: undefined,
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toContain('0 diff lines');
      // Should not add preview since lines.length === 0
    });
  });
  
  describe('find tool', () => {
    it('should render call with args', () => {
      const tool = getTool('find');
      const args = { pattern: '*.ts', path: '.' };
      const component = tool.renderCall(args, {}, {});
      expect(component.content).toBe('[find] {"pattern":"*.ts","path":"."}');
    });
    
    it('should render partial result', () => {
      const tool = getTool('find');
      const component = tool.renderResult({} as any, { isPartial: true }, {}, {});
      expect(component.content).toBe('[finding...]');
    });
    
    it('should render result with non-text content', () => {
      const tool = getTool('find');
      const result = {
        content: [{ type: 'image' as const }],
        details: undefined,
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toBe('Result: find complete');
    });
    
    it('should render result with matches', () => {
      const tool = getTool('find');
      const result = {
        content: [{ type: 'text' as const, text: 'file1.ts\nfile2.ts\nfile3.ts' }],
        details: undefined,
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toContain('3 matches');
    });
    
    it('should render preview when matches exceed limit', () => {
      const tool = getTool('find');
      const lines = Array.from({ length: 15 }, (_, i) => `file${i + 1}.ts`).join('\n');
      const result = {
        content: [{ type: 'text' as const, text: lines }],
        details: undefined,
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toContain('15 matches');
      expect(component.content).toContain('... 7 more matches'); // limit 8
    });

    it('should render result with empty matches', () => {
      const tool = getTool('find');
      const result = {
        content: [{ type: 'text' as const, text: '' }],
        details: undefined,
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toContain('0 matches');
      // Should not add preview since lines.length === 0
    });
  });
  
  describe('grep tool', () => {
    it('should render call with args', () => {
      const tool = getTool('grep');
      const args = { pattern: 'function', path: '.' };
      const component = tool.renderCall(args, {}, {});
      expect(component.content).toBe('[grep] {"pattern":"function","path":"."}');
    });
    
    it('should render partial result', () => {
      const tool = getTool('grep');
      const component = tool.renderResult({} as any, { isPartial: true }, {}, {});
      expect(component.content).toBe('[grepping...]');
    });
    
    it('should render result with non-text content', () => {
      const tool = getTool('grep');
      const result = {
        content: [{ type: 'image' as const }],
        details: undefined,
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toBe('Result: grep complete');
    });
    
    it('should render result with matches', () => {
      const tool = getTool('grep');
      const result = {
        content: [{ type: 'text' as const, text: 'file1.ts:10:function foo\nfile2.ts:20:function bar' }],
        details: undefined,
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toContain('2 matches');
    });

    it('should render result with empty matches', () => {
      const tool = getTool('grep');
      const result = {
        content: [{ type: 'text' as const, text: '' }],
        details: undefined,
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toContain('0 matches');
      // Should not add preview since lines.length === 0
    });
  });
  
  describe('ls tool', () => {
    it('should render call with args', () => {
      const tool = getTool('ls');
      const args = { path: '.' };
      const component = tool.renderCall(args, {}, {});
      expect(component.content).toBe('[ls] {"path":"."}');
    });
    
    it('should render partial result', () => {
      const tool = getTool('ls');
      const component = tool.renderResult({} as any, { isPartial: true }, {}, {});
      expect(component.content).toBe('[listing...]');
    });
    
    it('should render result with non-text content', () => {
      const tool = getTool('ls');
      const result = {
        content: [{ type: 'image' as const }],
        details: undefined,
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toBe('Result: ls complete');
    });
    
    it('should render result with items', () => {
      const tool = getTool('ls');
      const result = {
        content: [{ type: 'text' as const, text: 'file1.ts\nfile2.ts\ndir/' }],
        details: undefined,
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toContain('3 items');
    });
    
    it('should render preview when items exceed limit', () => {
      const tool = getTool('ls');
      const lines = Array.from({ length: 15 }, (_, i) => `item${i + 1}`).join('\n');
      const result = {
        content: [{ type: 'text' as const, text: lines }],
        details: undefined,
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toContain('15 items');
      expect(component.content).toContain('... 5 more items'); // limit 10
    });

    it('should render result with empty items', () => {
      const tool = getTool('ls');
      const result = {
        content: [{ type: 'text' as const, text: '' }],
        details: undefined,
      };
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toContain('0 items');
      // Should not add preview since lines.length === 0
    });
  });
  
  // Test edge cases for helper functions (via tool renderers)
  describe('helper functions edge cases', () => {
    it('should handle empty lines in renderPreview', () => {
      const tool = getTool('read');
      const result = {
        content: [{ type: 'text' as const, text: 'line1\n\nline3' }],
        details: { truncation: { truncated: false, totalLines: 3 } },
      };
      // read tool: lines = content.text.split('\n') - includes empty lines
      const component = tool.renderResult(result, { isPartial: false }, {}, {});
      expect(component.content).toContain('3 lines'); // empty line counted
    });
    
    it('should handle truncateForScreenReader being called', () => {
      // Ensure truncateForScreenReader is called for long lines
      const tool = getTool('bash');
      const longLine = 'x'.repeat(100);
      const result = {
        content: [{ type: 'text' as const, text: longLine }],
        details: { truncation: { truncated: false, totalLines: 1 } },
      };
      tool.renderResult(result, { isPartial: false }, {}, {});
      expect(truncateForScreenReader).toHaveBeenCalled();
    });
  });

  describe('execute delegation', () => {
    it('should delegate read tool execution', async () => {
      const tool = getTool('read');
      const mockTool = vi.mocked(piCodingAgent.createReadTool).mock.results[0].value;
      const params = { path: '/tmp/test.txt' };
      await tool.execute('call-123', params, undefined, undefined);
      expect(mockTool.execute).toHaveBeenCalledWith('call-123', params, undefined, undefined);
    });

    it('should delegate bash tool execution', async () => {
      const tool = getTool('bash');
      const mockTool = vi.mocked(piCodingAgent.createBashTool).mock.results[0].value;
      const params = { command: 'ls' };
      await tool.execute('call-456', params, undefined, undefined);
      expect(mockTool.execute).toHaveBeenCalledWith('call-456', params, undefined, undefined);
    });

    it('should delegate write tool execution', async () => {
      const tool = getTool('write');
      const mockTool = vi.mocked(piCodingAgent.createWriteTool).mock.results[0].value;
      const params = { path: '/tmp/test.txt', content: 'hello' };
      await tool.execute('call-789', params, undefined, undefined);
      expect(mockTool.execute).toHaveBeenCalledWith('call-789', params, undefined, undefined);
    });

    it('should delegate edit tool execution', async () => {
      const tool = getTool('edit');
      const mockTool = vi.mocked(piCodingAgent.createEditTool).mock.results[0].value;
      const params = { path: '/tmp/test.txt', edits: [] };
      await tool.execute('call-999', params, undefined, undefined);
      expect(mockTool.execute).toHaveBeenCalledWith('call-999', params, undefined, undefined);
    });

    it('should delegate find tool execution', async () => {
      const tool = getTool('find');
      const mockTool = vi.mocked(piCodingAgent.createFindTool).mock.results[0].value;
      const params = { pattern: '*.ts', path: '.' };
      await tool.execute('call-find', params, undefined, undefined);
      expect(mockTool.execute).toHaveBeenCalledWith('call-find', params, undefined, undefined);
    });

    it('should delegate grep tool execution', async () => {
      const tool = getTool('grep');
      const mockTool = vi.mocked(piCodingAgent.createGrepTool).mock.results[0].value;
      const params = { pattern: 'function', path: '.' };
      await tool.execute('call-grep', params, undefined, undefined);
      expect(mockTool.execute).toHaveBeenCalledWith('call-grep', params, undefined, undefined);
    });

    it('should delegate ls tool execution', async () => {
      const tool = getTool('ls');
      const mockTool = vi.mocked(piCodingAgent.createLsTool).mock.results[0].value;
      const params = { path: '.' };
      await tool.execute('call-ls', params, undefined, undefined);
      expect(mockTool.execute).toHaveBeenCalledWith('call-ls', params, undefined, undefined);
    });
  });
});