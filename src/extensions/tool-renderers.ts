import type {
  BashToolDetails,
  EditToolDetails,
  ExtensionAPI,
  FindToolDetails,
  GrepToolDetails,
  LsToolDetails,
  ReadToolDetails,
} from "@mariozechner/pi-coding-agent";
import {
  createBashTool,
  createEditTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadTool,
  createWriteTool,
  keyHint,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { formatStatus, formatToolCall } from "../lib/formatting.ts";

function emptyCallComponent(): Text {
  return new Text("", 0, 0);
}

function buildCollapsedHint(hiddenCount: number, hiddenLabel: string): string {
  return `... (${hiddenCount} more ${hiddenLabel}, ${keyHint("app.tools.expand", "to expand")})`;
}

function buildExpandedHint(): string {
  return `[${keyHint("app.tools.expand", "to collapse")}]`;
}

function renderContentBlock(
  statusLine: string,
  callLine: string,
  lines: string[],
  limit: number,
  hiddenLabel: string,
  expanded: boolean,
): string {
  const parts: string[] = [`${callLine} ${formatStatus(statusLine)}`];

  if (lines.length === 0) {
    return parts.join("\n");
  }

  const visibleLines = expanded ? lines : lines.slice(0, limit);
  parts.push(...visibleLines);

  if (expanded && lines.length > limit) {
    parts.push(buildExpandedHint());
  } else if (!expanded && lines.length > limit) {
    parts.push(buildCollapsedHint(lines.length - limit, hiddenLabel));
  }

  return parts.join("\n");
}

function nonEmptyLines(text: string): string[] {
  return text.split("\n").filter((line) => line.length > 0);
}

function visibleDiffLines(diffText: string): string[] {
  return diffText
    .split("\n")
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith("---") && !line.startsWith("+++") && !line.startsWith("@@"));
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
    renderCall() {
      return emptyCallComponent();
    },
    renderResult(result, { isPartial, expanded }, _theme, context) {
      const callLine = formatToolCall("read", context?.args ?? {});
      if (isPartial) {
        return new Text(`${callLine} ${formatStatus("Reading...")}`, 0, 0);
      }

      const details = result.details as ReadToolDetails | undefined;
      const content = result.content[0];
      if (content?.type !== "text") {
        return new Text(`${callLine} ${formatStatus("Read complete")}`, 0, 0);
      }

      const lines = content.text.split("\n");
      const status = details?.truncation?.truncated
        ? `Done (${lines.length} lines, truncated from ${details.truncation.totalLines})`
        : `Done (${lines.length} lines)`;

      return new Text(renderContentBlock(status, callLine, lines, 8, "lines", !!expanded), 0, 0);
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
    renderCall() {
      return emptyCallComponent();
    },
    renderResult(result, { isPartial, expanded }, _theme, context) {
      const toolArgs = context?.args ?? {};
      const callLine = formatToolCall("bash", {
        command: toolArgs.command ?? "",
        excludeFromContext: toolArgs.excludeFromContext || false,
      });
      if (isPartial) {
        return new Text(`${callLine} ${formatStatus("Running...")}`, 0, 0);
      }

      const details = result.details as BashToolDetails | undefined;
      const content = result.content[0];
      const output = content?.type === "text" ? content.text : "";
      const lines = nonEmptyLines(output);
      const exitMatch = output.match(/exit code: (\d+)/);
      const exitCode = exitMatch ? Number.parseInt(exitMatch[1] ?? "0", 10) : null;

      let status = exitCode && exitCode !== 0 ? `Exit ${exitCode}` : "Done";
      if (lines.length > 0) {
        status += ` (${lines.length} line${lines.length === 1 ? "" : "s"})`;
      }
      if (details?.truncation?.truncated) {
        status += ` [truncated from ${details.truncation.totalLines} lines]`;
      }

      return new Text(renderContentBlock(status, callLine, lines, 6, "lines", !!expanded), 0, 0);
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
    renderCall() {
      return emptyCallComponent();
    },
    renderResult(_result, { isPartial }, _theme, context) {
      const callLine = formatToolCall("write", context?.args ?? {});
      const statusLine = isPartial ? "Writing..." : "Done";
      return new Text(`${callLine} ${formatStatus(statusLine)}`, 0, 0);
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
    renderCall() {
      return emptyCallComponent();
    },
    renderResult(result, { isPartial, expanded }, _theme, context) {
      const callLine = formatToolCall("edit", context?.args ?? {});
      if (isPartial) {
        return new Text(`${callLine} ${formatStatus("Editing...")}`, 0, 0);
      }

      const content = result.content[0];
      if (content?.type !== "text") {
        return new Text(`${callLine} ${formatStatus("Edit complete")}`, 0, 0);
      }

      const diffLines = visibleDiffLines(content.text);
      const allLines = nonEmptyLines(content.text);
      const status = `Done (${allLines.length} diff lines)`;
      return new Text(renderContentBlock(status, callLine, diffLines, 6, "diff lines", !!expanded), 0, 0);
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
    renderCall() {
      return emptyCallComponent();
    },
    renderResult(result, { isPartial, expanded }, _theme, context) {
      const callLine = formatToolCall("find", context?.args ?? {});
      if (isPartial) {
        return new Text(`${callLine} ${formatStatus("Finding...")}`, 0, 0);
      }

      const content = result.content[0];
      if (content?.type !== "text") {
        return new Text(`${callLine} ${formatStatus("Find complete")}`, 0, 0);
      }

      const lines = nonEmptyLines(content.text);
      const status = `Done (${lines.length} matches)`;
      return new Text(renderContentBlock(status, callLine, lines, 8, "matches", !!expanded), 0, 0);
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
    renderCall() {
      return emptyCallComponent();
    },
    renderResult(result, { isPartial, expanded }, _theme, context) {
      const callLine = formatToolCall("grep", context?.args ?? {});
      if (isPartial) {
        return new Text(`${callLine} ${formatStatus("Grepping...")}`, 0, 0);
      }

      const content = result.content[0];
      if (content?.type !== "text") {
        return new Text(`${callLine} ${formatStatus("Grep complete")}`, 0, 0);
      }

      const lines = nonEmptyLines(content.text);
      const status = `Done (${lines.length} matches)`;
      return new Text(renderContentBlock(status, callLine, lines, 8, "matches", !!expanded), 0, 0);
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
    renderCall() {
      return emptyCallComponent();
    },
    renderResult(result, { isPartial, expanded }, _theme, context) {
      const callLine = formatToolCall("ls", context?.args ?? {});
      if (isPartial) {
        return new Text(`${callLine} ${formatStatus("Listing...")}`, 0, 0);
      }

      const content = result.content[0];
      if (content?.type !== "text") {
        return new Text(`${callLine} ${formatStatus("List complete")}`, 0, 0);
      }

      const lines = nonEmptyLines(content.text);
      const status = `Done (${lines.length} items)`;
      return new Text(renderContentBlock(status, callLine, lines, 10, "items", !!expanded), 0, 0);
    },
  });
}
