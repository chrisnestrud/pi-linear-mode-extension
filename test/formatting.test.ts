import { describe, it, expect } from 'vitest';
import {
  formatUIMessage,
  formatCommand,
  formatStatus,
  formatToolCall,
  formatToolResult,
  formatSelectorItem,
  formatCustomMessage,
  needsSpacerBefore,
} from '../src/lib/formatting.ts';

describe('formatting utilities', () => {
  describe('formatUIMessage', () => {
    it('wraps message in brackets', () => {
      expect(formatUIMessage('Hello')).toBe('[Hello]');
      expect(formatUIMessage('Command: read file.txt')).toBe('[Command: read file.txt]');
    });

    it('handles empty string', () => {
      expect(formatUIMessage('')).toBe('[]');
    });
  });

  describe('formatCommand', () => {
    it('formats regular command with $', () => {
      expect(formatCommand('ls -la')).toBe('[$ ls -la]');
    });

    it('formats excluded command with #', () => {
      expect(formatCommand('secret', true)).toBe('[# secret]');
    });

    it('defaults to not excluded', () => {
      expect(formatCommand('pwd')).toBe('[$ pwd]');
    });
  });

  describe('formatStatus', () => {
    it('formats status with brackets', () => {
      expect(formatStatus('Running...')).toBe('[Running...]');
      expect(formatStatus('Done (5 lines)')).toBe('[Done (5 lines)]');
    });
  });

  describe('formatToolCall', () => {
    it('formats read tool', () => {
      expect(formatToolCall('read', { path: 'file.txt' })).toBe('[read: file.txt]');
    });

    it('formats write tool', () => {
      expect(formatToolCall('write', { path: 'data.json' })).toBe('[write: data.json]');
    });

    it('formats edit tool', () => {
      expect(formatToolCall('edit', { path: 'src/index.ts' })).toBe('[edit: src/index.ts]');
    });

    it('formats bash tool', () => {
      expect(formatToolCall('bash', { command: 'echo hi', excludeFromContext: false })).toBe('[$ echo hi]');
      expect(formatToolCall('bash', { command: 'secret', excludeFromContext: true })).toBe('[# secret]');
    });

    it('formats find tool', () => {
      expect(formatToolCall('find', { pattern: '*.ts' })).toBe('[find: *.ts]');
    });

    it('formats grep tool', () => {
      expect(formatToolCall('grep', { pattern: 'function' })).toBe('[grep: function]');
    });

    it('formats ls tool', () => {
      expect(formatToolCall('ls', { path: 'src' })).toBe('[ls: src]');
      expect(formatToolCall('ls', {})).toBe('[ls: .]');
    });

    it('formats unknown tool with JSON', () => {
      expect(formatToolCall('custom', { foo: 'bar' })).toBe('[custom: {"foo":"bar"}]');
    });
  });

  describe('formatToolResult', () => {
    it('formats result with prefix', () => {
      expect(formatToolResult('25 lines')).toBe('[Result: 25 lines]');
      expect(formatToolResult('Error: File not found')).toBe('[Result: Error: File not found]');
    });
  });

  describe('formatSelectorItem', () => {
    it('formats unselected item', () => {
      expect(formatSelectorItem(0, 'Option 1')).toBe('  [1] Option 1');
      expect(formatSelectorItem(4, 'Option 5')).toBe('  [5] Option 5');
    });

    it('formats selected item', () => {
      expect(formatSelectorItem(0, 'Option 1', true)).toBe('> [1] Option 1');
    });
  });

  describe('formatCustomMessage', () => {
    it('formats known message types', () => {
      expect(formatCustomMessage('linear-workflow/interaction', 'Choose option')).toBe('[Interaction: Choose option]');
      expect(formatCustomMessage('linear-workflow/status', 'Ready')).toBe('[Status: Ready]');
      expect(formatCustomMessage('footer-snapshot', '0.0%/128k')).toBe('[Footer: 0.0%/128k]');
      expect(formatCustomMessage('footer-status', '0.0%/128k')).toBe('[Footer: 0.0%/128k]');
    });

    it('formats unknown message types', () => {
      expect(formatCustomMessage('custom/type', 'Message')).toBe('[type: Message]');
      expect(formatCustomMessage('unknown', 'Message')).toBe('[unknown: Message]');
    });

    it('handles edge cases', () => {
      expect(formatCustomMessage('', 'Message')).toBe('[Message: Message]');
      expect(formatCustomMessage('linear-workflow/', 'Message')).toBe('[Message: Message]');
      expect(formatCustomMessage('a/b/c', 'Message')).toBe('[c: Message]');
      expect(formatCustomMessage('/', 'Message')).toBe('[Message: Message]');
    });
  });

  describe('needsSpacerBefore', () => {
    it('returns true for major transitions', () => {
      expect(needsSpacerBefore('tool_result', 'tool_call')).toBe(true);
      expect(needsSpacerBefore('assistant_message', 'tool_call')).toBe(true);
      expect(needsSpacerBefore('user_message', 'tool_call')).toBe(true);
      expect(needsSpacerBefore('custom_message', 'tool_call')).toBe(true);
    });

    it('returns false for non-transitions', () => {
      expect(needsSpacerBefore('tool_call', 'tool_result')).toBe(false);
      expect(needsSpacerBefore('tool_call', 'tool_call')).toBe(false);
      expect(needsSpacerBefore('user_message', 'assistant_message')).toBe(false);
      expect(needsSpacerBefore('', '')).toBe(false);
    });
  });
});
