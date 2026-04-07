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

function renderPlainTextResult(
  output: string,
  options: {
    compactPreviewLines?: number;
    verbosePreviewLines?: number;
    truncated?: boolean;
    truncatedSuffix?: string;
  } = {},
): string {
  const rawLines = output.split("\n");
  const lines = rawLines.filter((line) => line.length > 0);
  let text = `${lines.length} lines`;
  if (options.truncated) {
    text += options.truncatedSuffix ? ` ${options.truncatedSuffix}` : " [truncated]";
  }

  // Always show some output preview (like pi's default behavior)
  const limit = options.verbosePreviewLines ?? 12; // Default to showing 12 lines
  if (lines.length > 0) {
    text += `\n${renderPreview(lines, limit, `... ${lines.length - limit} more lines`)}`;
  }
  return text;
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
      return new Text(`read ${args.path}`, 0, 0);
    },
    renderResult(result, { isPartial }, _theme, _context) {
      if (isPartial) return new Text("reading...", 0, 0);

      const details = result.details as ReadToolDetails | undefined;
      const content = result.content[0];
      if (content?.type !== "text") {
        return new Text("read complete", 0, 0);
      }

      const lines = content.text.split("\n");
      const truncated = details?.truncation?.truncated ? ` (truncated from ${details.truncation.totalLines} lines)` : "";
      let text = `${lines.length} lines${truncated}`;

      // Always show some output preview (like pi's default behavior)
      const limit = 12; // Show up to 12 lines of output
      if (lines.some((line) => line.length > 0)) {
        text += `\n${renderPreview(lines, limit, `... ${lines.length - limit} more lines`)}`;
      }

      return new Text(text, 0, 0);
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
      return new Text(`$ ${command}`, 0, 0);
    },
    renderResult(result, { isPartial }, theme, _context) {
      if (isPartial) return new Text("running...", 0, 0);

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
        text += " [truncated]";
      }

      // Always show some output preview (like pi's default behavior)
      const limit = 20; // Show up to 20 lines of output
      if (lines.length > 0) {
        text += `\n${renderPreview(lines, limit, `... ${lines.length - limit} more lines`)}`;
      }

      return new Text(text, 0, 0);
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
      return new Text(`ls ${args.path ?? "."}`, 0, 0);
    },
    renderResult(result, { isPartial }, _theme, _context) {
      if (isPartial) return new Text("listing...", 0, 0);

      const details = result.details as LsToolDetails | undefined;
      const content = result.content[0];
      const output = content?.type === "text" ? content.text : "";
      return new Text(
        renderPlainTextResult(output, {
          compactPreviewLines: 0,
          verbosePreviewLines: 20,
          truncated: Boolean(details?.truncation?.truncated || details?.entryLimitReached),
          truncatedSuffix: details?.entryLimitReached ? `[limit ${details.entryLimitReached}]` : undefined,
        }),
        0,
        0,
      );
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
      return new Text(`find ${args.pattern} in ${args.path ?? "."}`, 0, 0);
    },
    renderResult(result, { isPartial }, _theme, _context) {
      if (isPartial) return new Text("searching...", 0, 0);

      const details = result.details as FindToolDetails | undefined;
      const content = result.content[0];
      const output = content?.type === "text" ? content.text : "";
      return new Text(
        renderPlainTextResult(output, {
          compactPreviewLines: 0,
          verbosePreviewLines: 20,
          truncated: Boolean(details?.truncation?.truncated || details?.resultLimitReached),
          truncatedSuffix: details?.resultLimitReached ? `[limit ${details.resultLimitReached}]` : undefined,
        }),
        0,
        0,
      );
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
      return new Text(`grep ${args.pattern} in ${args.path ?? "."}`, 0, 0);
    },
    renderResult(result, { isPartial }, _theme, _context) {
      if (isPartial) return new Text("searching...", 0, 0);

      const details = result.details as GrepToolDetails | undefined;
      const content = result.content[0];
      const output = content?.type === "text" ? content.text : "";
      return new Text(
        renderPlainTextResult(output, {
          compactPreviewLines: 0,
          verbosePreviewLines: 20,
          truncated: Boolean(details?.truncation?.truncated || details?.matchLimitReached || details?.linesTruncated),
          truncatedSuffix: details?.matchLimitReached ? `[limit ${details.matchLimitReached}]` : undefined,
        }),
        0,
        0,
      );
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
      return new Text(`edit ${args.path}`, 0, 0);
    },
    renderResult(result, { isPartial }, _theme, _context) {
      if (isPartial) return new Text("editing...", 0, 0);

      const details = result.details as EditToolDetails | undefined;
      const content = result.content[0];
      if (content?.type === "text" && content.text.startsWith("Error")) {
        return new Text(content.text.split("\n")[0], 0, 0);
      }
      if (!details?.diff) {
        return new Text("applied", 0, 0);
      }

      const diffLines = details.diff.split("\n");
      let additions = 0;
      let removals = 0;
      for (const line of diffLines) {
        if (line.startsWith("+") && !line.startsWith("+++")) additions++;
        if (line.startsWith("-") && !line.startsWith("---")) removals++;
      }

      let text = `+${additions} / -${removals}`;
      // Always show some diff preview (like pi's default behavior)
      const limit = 20; // Show up to 20 lines of diff
      text += `\n${renderDiffPreview(details.diff, limit)}`;

      return new Text(text, 0, 0);
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
      const lineCount = args.content.split("\n").length;
      return new Text(`write ${args.path} (${lineCount} lines)`, 0, 0);
    },
    renderResult(result, { isPartial }, _theme, _context) {
      if (isPartial) return new Text("writing...", 0, 0);

      const content = result.content[0];
      if (content?.type === "text" && content.text.startsWith("Error")) {
        return new Text(content.text.split("\n")[0], 0, 0);
      }

      return new Text("written", 0, 0);
    },
  });
}
