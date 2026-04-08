import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { formatCustomMessage } from "../lib/formatting.ts";

function renderContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((item): item is { type: string; text: string } => Boolean(item) && typeof item === "object" && "type" in item && "text" in item)
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n");
}

function renderWithOptionalDetails(content: string, expanded: boolean, details: unknown, theme: any): string {
  if (!expanded || details === undefined) return content;
  return `${content}\n${theme.fg("dim", JSON.stringify(details, null, 2))}`;
}

export default function messageRenderers(pi: ExtensionAPI) {
  for (const customType of [
    "linear-workflow/interaction",
    "linear-workflow/status",
    "footer-snapshot",
    "footer-status",
  ]) {
    pi.registerMessageRenderer(customType, (message, options, theme) => {
      const content = renderContent(message.content);
      const formattedContent = formatCustomMessage(customType, content);
      return new Text(renderWithOptionalDetails(formattedContent, options.expanded, message.details, theme), 0, 0);
    });
  }
}
