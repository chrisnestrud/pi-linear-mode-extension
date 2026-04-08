import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { keyHint } from "@mariozechner/pi-coding-agent";
import { Container, Text } from "@mariozechner/pi-tui";
import { formatCommand, formatStatus } from "../lib/formatting.ts";

interface BashComponent {
  appendOutput(chunk: string): void;
  setComplete(exitCode: number | undefined, cancelled: boolean, truncationResult?: any, fullOutputPath?: string): void;
  setExpanded(expanded: boolean): void;
}

type BashRenderer = (command: string, ui: any, excludeFromContext?: boolean) => BashComponent;
type TruncationResult = any;

export class LinearBashComponent extends Container implements BashComponent {
  private command: string;
  private excludeFromContext: boolean;
  private outputLines: string[] = [];
  private status: "running" | "complete" | "cancelled" | "error" = "running";
  private exitCode: number | undefined = undefined;
  private expanded = false;
  private truncationResult?: TruncationResult;
  private fullOutputPath?: string;
  private readonly previewLimit = 5;

  constructor(command: string, excludeFromContext: boolean) {
    super();
    this.command = command;
    this.excludeFromContext = excludeFromContext;
    this.renderCurrent();
  }

  private getStatusText(): string {
    if (this.status === "running") return "Running...";
    if (this.status === "cancelled") return "Cancelled";
    if (this.status === "error" && this.exitCode !== undefined) return `Exit ${this.exitCode}`;
    if (this.exitCode !== undefined && this.exitCode !== 0) return `Exit ${this.exitCode}`;
    return "Done";
  }

  private renderCurrent(): void {
    this.clear();

    let statusText = this.getStatusText();
    if (this.status !== "running" && this.outputLines.length > 0) {
      statusText += ` (${this.outputLines.length} line${this.outputLines.length === 1 ? "" : "s"})`;
    }
    if (this.truncationResult?.truncated) {
      statusText += " [output truncated]";
    }

    this.addChild(new Text(formatStatus(statusText), 0, 0));
    this.addChild(new Text(formatCommand(this.command, this.excludeFromContext), 0, 0));

    if (this.status === "running" || this.outputLines.length === 0) {
      return;
    }

    const linesToRender = this.expanded ? this.outputLines : this.outputLines.slice(0, this.previewLimit);
    for (const line of linesToRender) {
      this.addChild(new Text(line, 0, 0));
    }

    if (this.expanded && this.outputLines.length > this.previewLimit) {
      this.addChild(new Text(`[${keyHint("app.tools.expand", "to collapse")}]`, 0, 0));
    } else if (!this.expanded && this.outputLines.length > this.previewLimit) {
      const hiddenCount = this.outputLines.length - this.previewLimit;
      this.addChild(new Text(`... (${hiddenCount} more lines, ${keyHint("app.tools.expand", "to expand")})`, 0, 0));
    }
  }

  appendOutput(chunk: string): void {
    const clean = chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const newLines = clean.split("\n");

    for (const line of newLines) {
      if (line.length > 0) {
        this.outputLines.push(line);
      }
    }
  }

  setComplete(
    exitCode: number | undefined,
    cancelled: boolean,
    truncationResult?: TruncationResult,
    fullOutputPath?: string,
  ): void {
    this.exitCode = exitCode;
    this.status = cancelled ? "cancelled" : (exitCode !== 0 && exitCode !== undefined) ? "error" : "complete";
    this.truncationResult = truncationResult;
    this.fullOutputPath = fullOutputPath;
    this.renderCurrent();
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.renderCurrent();
  }
}

const linearBashRenderer: BashRenderer = (command, ui, excludeFromContext) => {
  return new LinearBashComponent(command, excludeFromContext || false);
};

export default function bashRendererExtension(pi: ExtensionAPI) {
  (pi as any).registerBashRenderer(linearBashRenderer);

  pi.on("session_start", async (_event, ctx) => {
    if (ctx.hasUI) {
      ctx.ui.notify("[Linear bash rendering enabled]", "info");
    }
  });
}
