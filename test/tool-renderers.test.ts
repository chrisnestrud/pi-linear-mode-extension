import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import * as piCodingAgent from '@mariozechner/pi-coding-agent';
import toolRenderersExtension from '../src/extensions/tool-renderers.ts';
import { formatToolCall } from '../src/lib/formatting.ts';

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
    keyHint: vi.fn().mockImplementation((_key: string, description: string) => `ctrl+o ${description}`),
  };
});

vi.mock('../src/lib/formatting.ts', () => ({
  formatToolCall: vi.fn().mockImplementation((name: string, args: any) => `[${name}] ${JSON.stringify(args)}`),
  formatStatus: vi.fn().mockImplementation((text: string) => `[${text}]`),
}));

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
    it('should render empty call slot', () => {
      const tool = getTool('read');
      const args = { path: '/tmp/file.txt', offset: 0, limit: 100 };
      const component = tool.renderCall(args, {}, {});
      expect(component.content).toBe('');
    });

    it('should render partial result with status first', () => {
      const tool = getTool('read');
      const args = { path: '/tmp/file.txt' };
      const component = tool.renderResult({} as any, { isPartial: true, expanded: false }, {}, { args });
      expect(component.content).toBe('[Reading...]\n[read] {"path":"/tmp/file.txt"}');
    });

    it('should render result with non-text content', () => {
      const tool = getTool('read');
      const args = { path: '/tmp/file.txt' };
      const result = { content: [{ type: 'image' as const }], details: undefined };
      const component = tool.renderResult(result, { isPartial: false, expanded: false }, {}, { args });
      expect(component.content).toBe('[Read complete]\n[read] {"path":"/tmp/file.txt"}');
    });

    it('should render result with empty text content', () => {
      const tool = getTool('read');
      const args = { path: '/tmp/file.txt' };
      const result = {
        content: [{ type: 'text' as const, text: '' }],
        details: { truncation: { truncated: false, totalLines: 0 } },
      };
      const component = tool.renderResult(result, { isPartial: false, expanded: false }, {}, { args });
      expect(component.content).toContain('[Done (1 lines)]');
      expect(component.content).toContain('[read] {"path":"/tmp/file.txt"}');
    });

    it('should render result with text content and truncation', () => {
      const tool = getTool('read');
      const args = { path: '/tmp/file.txt' };
      const result = {
        content: [{ type: 'text' as const, text: 'line1\nline2\nline3' }],
        details: { truncation: { truncated: true, totalLines: 10 } },
      };
      const component = tool.renderResult(result, { isPartial: false, expanded: false }, {}, { args });
      expect(component.content).toContain('[Done (3 lines, truncated from 10)]');
    });

    it('should render preview when lines exceed limit', () => {
      const tool = getTool('read');
      const args = { path: '/tmp/file.txt' };
      const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n');
      const result = {
        content: [{ type: 'text' as const, text: lines }],
        details: { truncation: { truncated: false, totalLines: 20 } },
      };
      const component = tool.renderResult(result, { isPartial: false, expanded: false }, {}, { args });
      expect(component.content).toContain('[Done (20 lines)]');
      expect(component.content).toContain('... (12 more lines, ctrl+o to expand)');
    });
  });

  describe('bash tool', () => {
    it('should render empty call slot', () => {
      const tool = getTool('bash');
      const args = { command: 'ls -la', excludeFromContext: false };
      const component = tool.renderCall(args, {}, {});
      expect(component.content).toBe('');
    });

    it('should still use full command in result call line', () => {
      const tool = getTool('bash');
      const longCommand = 'x'.repeat(150);
      const args = { command: longCommand, excludeFromContext: false };
      tool.renderResult({ content: [{ type: 'text' as const, text: '' }], details: undefined }, { isPartial: false, expanded: false }, {}, { args });
      expect(formatToolCall).toHaveBeenCalledWith('bash', {
        command: longCommand,
        excludeFromContext: false,
      });
    });

    it('should render partial result', () => {
      const tool = getTool('bash');
      const args = { command: 'ls -la', excludeFromContext: false };
      const component = tool.renderResult({} as any, { isPartial: true, expanded: false }, {}, { args });
      expect(component.content).toBe('[Running...]\n[bash] {"command":"ls -la","excludeFromContext":false}');
    });

    it('should render result with exit code 0', () => {
      const tool = getTool('bash');
      const args = { command: 'ls -la', excludeFromContext: false };
      const result = {
        content: [{ type: 'text' as const, text: 'output line1\noutput line2\nexit code: 0' }],
        details: { truncation: { truncated: false, totalLines: 3 } },
      };
      const component = tool.renderResult(result, { isPartial: false, expanded: false }, {}, { args });
      expect(component.content).toContain('[Done (3 lines)]');
    });

    it('should render result with non-zero exit code', () => {
      const tool = getTool('bash');
      const args = { command: 'false', excludeFromContext: false };
      const result = {
        content: [{ type: 'text' as const, text: 'error output\nexit code: 1' }],
        details: { truncation: { truncated: false, totalLines: 2 } },
      };
      const component = tool.renderResult(result, { isPartial: false, expanded: false }, {}, { args });
      expect(component.content).toContain('[Exit 1 (2 lines)]');
    });

    it('should render result with truncated output', () => {
      const tool = getTool('bash');
      const args = { command: 'cat large', excludeFromContext: false };
      const result = {
        content: [{ type: 'text' as const, text: 'output' }],
        details: { truncation: { truncated: true, totalLines: 100 } },
      };
      const component = tool.renderResult(result, { isPartial: false, expanded: false }, {}, { args });
      expect(component.content).toContain('[Done (1 line) [truncated from 100 lines]]');
    });

    it('should render result with no lines', () => {
      const tool = getTool('bash');
      const args = { command: 'true', excludeFromContext: false };
      const result = {
        content: [{ type: 'text' as const, text: '' }],
        details: { truncation: { truncated: false, totalLines: 0 } },
      };
      const component = tool.renderResult(result, { isPartial: false, expanded: false }, {}, { args });
      expect(component.content).toContain('[Done]');
    });

    it('should render result with non-text content', () => {
      const tool = getTool('bash');
      const args = { command: 'true', excludeFromContext: false };
      const result = { content: [{ type: 'image' as const }], details: undefined };
      const component = tool.renderResult(result, { isPartial: false, expanded: false }, {}, { args });
      expect(component.content).toContain('[Done]');
    });

    it('should preserve full lines without per-line truncation', () => {
      const tool = getTool('bash');
      const args = { command: 'echo', excludeFromContext: false };
      const longLine = 'x'.repeat(100);
      const result = {
        content: [{ type: 'text' as const, text: longLine }],
        details: { truncation: { truncated: false, totalLines: 1 } },
      };
      const component = tool.renderResult(result, { isPartial: false, expanded: true }, {}, { args });
      expect(component.content).toContain(longLine);
    });
  });

  describe('write tool', () => {
    it('should render empty call slot', () => {
      const tool = getTool('write');
      const args = { path: '/tmp/file.txt', content: 'hello' };
      const component = tool.renderCall(args, {}, {});
      expect(component.content).toBe('');
    });

    it('should render partial result', () => {
      const tool = getTool('write');
      const args = { path: '/tmp/file.txt', content: 'hello' };
      const component = tool.renderResult({} as any, { isPartial: true, expanded: false }, {}, { args });
      expect(component.content).toBe('[Writing...]\n[write] {"path":"/tmp/file.txt","content":"hello"}');
    });

    it('should render complete result', () => {
      const tool = getTool('write');
      const args = { path: '/tmp/file.txt', content: 'hello' };
      const component = tool.renderResult({} as any, { isPartial: false, expanded: false }, {}, { args });
      expect(component.content).toBe('[Done]\n[write] {"path":"/tmp/file.txt","content":"hello"}');
    });
  });

  describe('edit tool', () => {
    it('should render empty call slot', () => {
      const tool = getTool('edit');
      const args = { path: '/tmp/file.txt', edits: [] };
      const component = tool.renderCall(args, {}, {});
      expect(component.content).toBe('');
    });

    it('should render partial result', () => {
      const tool = getTool('edit');
      const args = { path: '/tmp/file.txt', edits: [] };
      const component = tool.renderResult({} as any, { isPartial: true, expanded: false }, {}, { args });
      expect(component.content).toBe('[Editing...]\n[edit] {"path":"/tmp/file.txt","edits":[]}');
    });

    it('should render result with non-text content', () => {
      const tool = getTool('edit');
      const args = { path: '/tmp/file.txt', edits: [] };
      const result = { content: [{ type: 'image' as const }], details: undefined };
      const component = tool.renderResult(result, { isPartial: false, expanded: false }, {}, { args });
      expect(component.content).toBe('[Edit complete]\n[edit] {"path":"/tmp/file.txt","edits":[]}');
    });

    it('should render result with diff text', () => {
      const tool = getTool('edit');
      const args = { path: '/tmp/file.txt', edits: [] };
      const diffText = '--- a/file.txt\n+++ b/file.txt\n@@ -1,1 +1,1 @@\n-old\n+new';
      const result = { content: [{ type: 'text' as const, text: diffText }], details: undefined };
      const component = tool.renderResult(result, { isPartial: false, expanded: false }, {}, { args });
      expect(component.content).toContain('[Done (5 diff lines)]');
      expect(component.content).toContain('-old');
      expect(component.content).toContain('+new');
      expect(component.content).not.toContain('--- a/file.txt');
    });
  });

  describe('find tool', () => {
    it('should render empty call slot', () => {
      const tool = getTool('find');
      const args = { pattern: '*.ts', path: '.' };
      const component = tool.renderCall(args, {}, {});
      expect(component.content).toBe('');
    });

    it('should render partial result', () => {
      const tool = getTool('find');
      const args = { pattern: '*.ts', path: '.' };
      const component = tool.renderResult({} as any, { isPartial: true, expanded: false }, {}, { args });
      expect(component.content).toBe('[Finding...]\n[find] {"pattern":"*.ts","path":"."}');
    });

    it('should render result with matches', () => {
      const tool = getTool('find');
      const args = { pattern: '*.ts', path: '.' };
      const result = { content: [{ type: 'text' as const, text: 'file1.ts\nfile2.ts\nfile3.ts' }], details: undefined };
      const component = tool.renderResult(result, { isPartial: false, expanded: false }, {}, { args });
      expect(component.content).toContain('[Done (3 matches)]');
    });
  });

  describe('grep tool', () => {
    it('should render empty call slot', () => {
      const tool = getTool('grep');
      const args = { pattern: 'function', path: '.' };
      const component = tool.renderCall(args, {}, {});
      expect(component.content).toBe('');
    });

    it('should render partial result', () => {
      const tool = getTool('grep');
      const args = { pattern: 'function', path: '.' };
      const component = tool.renderResult({} as any, { isPartial: true, expanded: false }, {}, { args });
      expect(component.content).toBe('[Grepping...]\n[grep] {"pattern":"function","path":"."}');
    });

    it('should render result with matches', () => {
      const tool = getTool('grep');
      const args = { pattern: 'function', path: '.' };
      const result = {
        content: [{ type: 'text' as const, text: 'file1.ts:10:function foo\nfile2.ts:20:function bar' }],
        details: undefined,
      };
      const component = tool.renderResult(result, { isPartial: false, expanded: false }, {}, { args });
      expect(component.content).toContain('[Done (2 matches)]');
    });
  });

  describe('ls tool', () => {
    it('should render empty call slot', () => {
      const tool = getTool('ls');
      const args = { path: '.' };
      const component = tool.renderCall(args, {}, {});
      expect(component.content).toBe('');
    });

    it('should render partial result', () => {
      const tool = getTool('ls');
      const args = { path: '.' };
      const component = tool.renderResult({} as any, { isPartial: true, expanded: false }, {}, { args });
      expect(component.content).toBe('[Listing...]\n[ls] {"path":"."}');
    });

    it('should render result with items', () => {
      const tool = getTool('ls');
      const args = { path: '.' };
      const result = { content: [{ type: 'text' as const, text: 'file1.ts\nfile2.ts\ndir/' }], details: undefined };
      const component = tool.renderResult(result, { isPartial: false, expanded: false }, {}, { args });
      expect(component.content).toContain('[Done (3 items)]');
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
