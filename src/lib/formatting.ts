/**
 * Formatting utilities for linear-mode extensions.
 * Provides consistent formatting for screen reader accessibility.
 *
 * Principles:
 * 1. Use `[` and `]` to mark UI/system lines (differentiates from LLM/tool output)
 * 2. Minimize blank lines
 * 3. Maximize useful information per line
 * 4. Keep lines concise for screen readers
 */

/**
 * Format a UI/system message with brackets
 * Example: `[Command: read file.txt]`
 */
export function formatUIMessage(message: string): string {
  return `[${message}]`;
}

/**
 * Format a command execution
 * Example: `[$ ls -la]` or `[# secret-command]`
 */
export function formatCommand(command: string, excludeFromContext: boolean = false): string {
  const prefix = excludeFromContext ? "# " : "$ ";
  return formatUIMessage(`${prefix}${command}`);
}

/**
 * Format a status message
 * Example: `[Running...]` or `[Done (5 lines)]`
 */
export function formatStatus(status: string): string {
  return formatUIMessage(status);
}

/**
 * Format a tool call
 * Example: `[read: package.json]`
 */
export function formatToolCall(toolName: string, args: any): string {
  if (toolName === "read" || toolName === "write" || toolName === "edit") {
    return formatUIMessage(`${toolName}: ${args.path}`);
  } else if (toolName === "bash") {
    const excludeFromContext = args.excludeFromContext || false;
    return formatCommand(args.command, excludeFromContext);
  } else if (toolName === "find" || toolName === "grep") {
    return formatUIMessage(`${toolName}: ${args.pattern}`);
  } else if (toolName === "ls") {
    return formatUIMessage(`ls: ${args.path || "."}`);
  }
  return formatUIMessage(`${toolName}: ${JSON.stringify(args)}`);
}

/**
 * Format a tool result
 * Example: `[Result: 25 lines]` or `[Error: File not found]`
 */
export function formatToolResult(result: string): string {
  return formatUIMessage(`Result: ${result}`);
}

/**
 * Format a selector item
 * Example: `[1] Item label`
 */
export function formatSelectorItem(index: number, label: string, isSelected: boolean = false): string {
  const prefix = isSelected ? "> " : "  ";
  return `${prefix}[${index + 1}] ${label}`;
}

/**
 * Format a custom message (interaction, status, abort, etc.)
 * Example: `[Interaction: Choose an option]`
 */
export function formatCustomMessage(type: string, content: string): string {
  const typeMap: Record<string, string> = {
    "linear-workflow/interaction": "Interaction",
    "linear-workflow/status": "Status",
    "footer-snapshot": "Footer",
    "footer-status": "Footer",
  };
  const displayType = typeMap[type] || type.split("/").pop() || "Message";
  return formatUIMessage(`${displayType}: ${content}`);
}

/**
 * Check if a line should have a spacer before it
 * Returns true for major section changes
 */
export function needsSpacerBefore(previousType: string, currentType: string): boolean {
  const transitions = [
    ["tool_result", "tool_call"],
    ["assistant_message", "tool_call"],
    ["user_message", "tool_call"],
    ["custom_message", "tool_call"],
  ];

  return transitions.some(([prev, curr]) => prev === previousType && curr === currentType);
}
