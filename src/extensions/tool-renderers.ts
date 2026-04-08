import type {
  BashToolDetails,
  EditToolDetails,
  ExtensionAPI,
  FindToolDetails,
  GrepToolDetails,
  LsToolDetails,
  ReadToolDetails,
} from "@mariozechner/pi-coding-agent";
import { createBashTool, createEditTool, createFindTool, createGrepTool, createLsTool, createReadTool, createWriteTool } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { formatToolCall, formatToolResult, truncateForScreenReader } from "../lib/formatting.ts";

function renderPreview(lines: string[], limit: number, suffix: string): string {
  const visible = lines.slice(0, limit);
  let text = visible.join("\n");
  // Only add suffix if there are lines not shown
  if (lines.length > limit) {
    text += `\n${suffix}`;
  }
  return text;
}

function renderDiffPreview(diffText: string, limit: number): string {
  const rawLines = diffText.split("\n");
  const visibleLines = rawLines.filter((line) => !line.startsWith("---") && !line.startsWith("+++") && !line.startsWith("@@"));
  return renderPreview(visibleLines, limit, `... ${visibleLines.length - limit} more diff lines`);
}


export default function toolRenderers(pi: ExtensionAPI) {
  const cwd = process.cwd();

  const readTool = createReadTool(cwd);
  pi.registerTool({
    name: "read",
    label: "read",
    description: readTool.description,
    parameters: readTool.parameters,
    async execute(toolCallId, params, signal, onUpdate) {
      return readTool.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, _theme, _context) {
      return new Text(formatToolCall("read", args), 0, 0);
    },
    renderResult(result, { isPartial }, _theme, _context) {
      if (isPartial) return new Text("[reading...]", 0, 0);

      const details = result.details as ReadToolDetails | undefined;
      const content = result.content[0];
      if (content?.type !== "text") {
        return new Text(formatToolResult("read complete"), 0, 0);
      }

      const lines = content.text.split("\n");
      const truncated = details?.truncation?.truncated ? ` (truncated from ${details.truncation.totalLines} lines)` : "";
      let text = `${lines.length} lines${truncated}`;

      // Always show some output preview (like pi's default behavior)
      const limit = 8; // Reduced for screen readers
      if (lines.some((line) => line.length > 0)) {
        // Truncate lines for screen readers
        const truncatedLines = lines.map(line => truncateForScreenReader(line));
        text += `\n${renderPreview(truncatedLines, limit, `... ${lines.length - limit} more lines`)}`;
      }

      return new Text(formatToolResult(text), 0, 0);
    },
  });

  const bashTool = createBashTool(cwd);
  pi.registerTool({
    name: "bash",
    label: "bash",
    description: bashTool.description,
    parameters: bashTool.parameters,
    async execute(toolCallId, params, signal, onUpdate) {
      return bashTool.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, _theme, _context) {
      const command = args.command.length > 100 ? `${args.command.slice(0, 97)}...` : args.command;
      return new Text(formatToolCall("bash", { command, excludeFromContext: false }), 0, 0);
    },
    renderResult(result, { isPartial }, theme, _context) {
      if (isPartial) return new Text("[running...]", 0, 0);

      const details = result.details as BashToolDetails | undefined;
      const content = result.content[0];
      const output = content?.type === "text" ? content.text : "";
      const lines = output.split("\n").filter((line) => line.length > 0);
      const exitMatch = output.match(/exit code: (\d+)/);
      const exitCode = exitMatch ? Number.parseInt(exitMatch[1] ?? "0", 10) : null;
      
      // Build status line
      let text = exitCode && exitCode !== 0 ? `exit ${exitCode}` : "done";
      if (lines.length > 0) {
        text += ` (${lines.length} line${lines.length === 1 ? '' : 's'})`;
      }
      if (details?.truncation?.truncated) {
        text += ` [truncated from ${details.truncation.totalLines} lines]`;
      }

      // Show output preview
      const limit = 6; // Reduced for screen readers
      if (lines.length > 0) {
        // Truncate lines for screen readers
        const truncatedLines = lines.map(line => truncateForScreenReader(line));
        text += `\n${renderPreview(truncatedLines, limit, `... ${lines.length - limit} more lines`)}`;
      }

      return new Text(formatToolResult(text), 0, 0);
    },
  });

  const writeTool = createWriteTool(cwd);
  pi.registerTool({
    name: "write",
    label: "write",
    description: writeTool.description,
    parameters: writeTool.parameters,
    async execute(toolCallId, params, signal, onUpdate) {
      return writeTool.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, _theme, _context) {
      return new Text(formatToolCall("write", args), 0, 0);
    },
    renderResult(result, { isPartial }, _theme, _context) {
      if (isPartial) return new Text("[writing...]", 0, 0);
      return new Text(formatToolResult("written"), 0, 0);
    },
  });

  const editTool = createEditTool(cwd);
  pi.registerTool({
    name: "edit",
    label: "edit",
    description: editTool.description,
    parameters: editTool.parameters,
    async execute(toolCallId, params, signal, onUpdate) {
      return editTool.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, _theme, _context) {
      return new Text(formatToolCall("edit", args), 0, 0);
    },
    renderResult(result, { isPartial }, _theme, _context) {
      if (isPartial) return new Text("[editing...]", 0, 0);

      const details = result.details as EditToolDetails | undefined;
      const content = result.content[0];
      if (content?.type !== "text") {
        return new Text(formatToolResult("edit complete"), 0, 0);
      }

      const diffText = content.text;
      const lines = diffText.split("\n").filter((line) => line.length > 0);
      let text = `${lines.length} diff lines`;

      // Show diff preview
      const limit = 6; // Reduced for screen readers
      if (lines.length > 0) {
        text += `\n${renderDiffPreview(diffText, limit)}`;
      }

      return new Text(formatToolResult(text), 0, 0);
    },
  });

  const findTool = createFindTool(cwd);
  pi.registerTool({
    name: "find",
    label: "find",
    description: findTool.description,
    parameters: findTool.parameters,
    async execute(toolCallId, params, signal, onUpdate) {
      return findTool.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, _theme, _context) {
      return new Text(formatToolCall("find", args), 0, 0);
    },
    renderResult(result, { isPartial }, _theme, _context) {
      if (isPartial) return new Text("[finding...]", 0, 0);

      const details = result.details as FindToolDetails | undefined;
      const content = result.content[0];
      if (content?.type !== "text") {
        return new Text(formatToolResult("find complete"), 0, 0);
      }

      const output = content.text;
      const lines = output.split("\n").filter((line) => line.length > 0);
      let text = `${lines.length} matches`;

      // Show preview
      const limit = 8; // Reduced for screen readers
      if (lines.length > 0) {
        // Truncate lines for screen readers
        const truncatedLines = lines.map(line => truncateForScreenReader(line));
        text += `\n${renderPreview(truncatedLines, limit, `... ${lines.length - limit} more matches`)}`;
      }

      return new Text(formatToolResult(text), 0, 0);
    },
  });

  const grepTool = createGrepTool(cwd);
  pi.registerTool({
    name: "grep",
    label: "grep",
    description: grepTool.description,
    parameters: grepTool.parameters,
    async execute(toolCallId, params, signal, onUpdate) {
      return grepTool.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, _theme, _context) {
      return new Text(formatToolCall("grep", args), 0, 0);
    },
    renderResult(result, { isPartial }, _theme, _context) {
      if (isPartial) return new Text("[grepping...]", 0, 0);

      const details = result.details as GrepToolDetails | undefined;
      const content = result.content[0];
      if (content?.type !== "text") {
        return new Text(formatToolResult("grep complete"), 0, 0);
      }

      const output = content.text;
      const lines = output.split("\n").filter((line) => line.length > 0);
      let text = `${lines.length} matches`;

      // Show preview
      const limit = 8; // Reduced for screen readers
      if (lines.length > 0) {
        // Truncate lines for screen readers
        const truncatedLines = lines.map(line => truncateForScreenReader(line));
        text += `\n${renderPreview(truncatedLines, limit, `... ${lines.length - limit} more matches`)}`;
      }

      return new Text(formatToolResult(text), 0, 0);
    },
  });

  const lsTool = createLsTool(cwd);
  pi.registerTool({
    name: "ls",
    label: "ls",
    description: lsTool.description,
    parameters: lsTool.parameters,
    async execute(toolCallId, params, signal, onUpdate) {
      return lsTool.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, _theme, _context) {
      return new Text(formatToolCall("ls", args), 0, 0);
    },
    renderResult(result, { isPartial }, _theme, _context) {
      if (isPartial) return new Text("[listing...]", 0, 0);

      const details = result.details as LsToolDetails | undefined;
      const content = result.content[0];
      if (content?.type !== "text") {
        return new Text(formatToolResult("ls complete"), 0, 0);
      }

      const output = content.text;
      const lines = output.split("\n").filter((line) => line.length > 0);
      let text = `${lines.length} items`;

      // Show preview
      const limit = 10; // Reduced for screen readers
      if (lines.length > 0) {
        // Truncate lines for screen readers
        const truncatedLines = lines.map(line => truncateForScreenReader(line));
        text += `\n${renderPreview(truncatedLines, limit, `... ${lines.length - limit} more items`)}`;
      }

      return new Text(formatToolResult(text), 0, 0);
    },
  });
}