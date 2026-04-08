import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Container, Text, Spacer } from "@mariozechner/pi-tui";
import { formatCommand, formatStatus, truncateForScreenReader } from "../lib/formatting.ts";

// Define local types since they might not be exported
interface BashComponent {
  appendOutput(chunk: string): void;
  setComplete(exitCode: number | undefined, cancelled: boolean, truncationResult?: any, fullOutputPath?: string): void;
  setExpanded(expanded: boolean): void;
}

type BashRenderer = (command: string, ui: any, excludeFromContext?: boolean) => BashComponent;

type TruncationResult = any;

/**
 * Linear bash component for pi-linear-mode.
 * 
 * Features:
 * - No animated spinner (static "Running..." text) - screen-reader friendly
 * - Compact/verbose mode support (matches tool renderers)
 * - Simple, linear presentation without borders
 * - Shows command, status, and optional output preview
 * - Accessibility focused: static text instead of visual animations
 */
export class LinearBashComponent extends Container implements BashComponent {
  private command: string;
  private excludeFromContext: boolean;
  private outputLines: string[] = [];
  private status: "running" | "complete" | "cancelled" | "error" = "running";
  private exitCode: number | undefined = undefined;
  private expanded = false;
  private truncationResult?: TruncationResult;
  private fullOutputPath?: string;

  constructor(command: string, excludeFromContext: boolean) {
    super();
    this.command = command;
    this.excludeFromContext = excludeFromContext;

    // Initial render
    this.renderInitial();
  }

  private renderInitial(): void {
    this.clear();
    
    // Command line with status on same line
    const statusText = this.status === "running" ? "Running..." : 
                      this.status === "cancelled" ? "Cancelled" :
                      this.status === "error" ? `Error (exit ${this.exitCode})` : "Done";
    
    const commandLine = formatCommand(this.command, this.excludeFromContext);
    const fullLine = `${commandLine} ${statusText}`;
    this.addChild(new Text(fullLine, 0, 0));
  }

  private renderComplete(): void {
    this.clear();
    
    // Build status line
    let statusLine: string;
    if (this.status === "cancelled") {
      statusLine = "Cancelled";
    } else if (this.status === "error" && this.exitCode !== undefined) {
      statusLine = `Error (exit ${this.exitCode})`;
    } else if (this.exitCode !== undefined && this.exitCode !== 0) {
      statusLine = `Exit ${this.exitCode}`;
    } else {
      statusLine = "Done";
    }
    
    // Add line count if we have output
    if (this.outputLines.length > 0) {
      statusLine += ` (${this.outputLines.length} line${this.outputLines.length === 1 ? '' : 's'})`;
    }
    
    // Command line with status on same line
    const commandLine = formatCommand(this.command, this.excludeFromContext);
    const fullLine = `${commandLine} ${statusLine}`;
    this.addChild(new Text(fullLine, 0, 0));
    
    // Show output preview if we have output (like pi's default behavior)
    if (this.outputLines.length > 0) {
      // Show last 5 lines as preview (reduced for screen readers)
      const linesToShow = Math.min(this.outputLines.length, 5);
      const startIndex = Math.max(0, this.outputLines.length - linesToShow);
      
      for (let i = startIndex; i < this.outputLines.length; i++) {
        // Truncate long lines for screen readers
        const truncatedLine = truncateForScreenReader(this.outputLines[i]);
        this.addChild(new Text(`  ${truncatedLine}`, 0, 0));
      }
      
      // Only show "... x more lines" if there are lines not shown
      if (this.outputLines.length > 5) {
        this.addChild(new Text(`  ... ${this.outputLines.length - 5} more lines`, 0, 0));
      }
      
      if (this.truncationResult?.truncated) {
        this.addChild(new Text(`  [output truncated]`, 0, 0));
      }
    }
  }

  appendOutput(chunk: string): void {
    // Clean and store output
    const clean = chunk.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const newLines = clean.split("\n");
    
    // Append to output lines, filtering empty lines
    for (const line of newLines) {
      if (line.length > 0) {
        this.outputLines.push(line);
      }
    }
    
    // We could update display here to show progress, but for linear mode
    // we typically just show final result
  }

  setComplete(
    exitCode: number | undefined,
    cancelled: boolean,
    truncationResult?: TruncationResult,
    fullOutputPath?: string
  ): void {
    this.exitCode = exitCode;
    this.status = cancelled ? "cancelled" : 
                  (exitCode !== 0 && exitCode !== undefined) ? "error" : "complete";
    this.truncationResult = truncationResult;
    this.fullOutputPath = fullOutputPath;
    
    this.renderComplete();
  }

  setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    // In a more advanced implementation, we could show more/less output
    // based on expansion state
  }
}

/**
 * Creates a linear-style bash renderer for pi-linear-mode.
 * 
 * This renderer provides accessibility benefits:
 * - Static text instead of animated spinners (screen-reader friendly)
 * - Explicit status messages instead of visual indicators
 * - Reduced visual motion for users with motion sensitivity
 */
const linearBashRenderer: BashRenderer = (command, ui, excludeFromContext) => {
  return new LinearBashComponent(command, excludeFromContext || false);
};

/**
 * Bash renderer extension for pi-linear-mode.
 * 
 * Replaces the default BashExecutionComponent (with spinner) with a
 * linear, spinner-free component that matches the linear workflow aesthetic.
 */
export default function bashRendererExtension(pi: ExtensionAPI) {
  // Register our linear bash renderer
  (pi as any).registerBashRenderer(linearBashRenderer);
  
  // Optional UI notification in interactive sessions
  pi.on("session_start", async (_event, ctx) => {
    if (ctx.hasUI) {
      ctx.ui.notify("[Linear bash rendering enabled]", "info");
    }
  });
}