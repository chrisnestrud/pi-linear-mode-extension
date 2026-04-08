/**
 * pi-linear-mode-extension - Main entry point
 * 
 * This extension provides a more linear workflow inside the pi CLI with:
 * - Numbered interactions for tool selection
 * - Custom tool renderers for linear display
 * - Selector renderer for interactive selection
 * - Message renderers for custom message display
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Import all extensions
import toolRenderers from "./src/extensions/tool-renderers.ts";
import messageRenderers from "./src/extensions/message-renderers.ts";
import selectorRenderer from "./src/extensions/selector-renderer.ts";
import workingMessageModifier from "./src/extensions/working-message-modifier.ts";
import footerSuppressor from "./src/extensions/footer-suppressor.ts";

export default function piLinearModeExtension(pi: ExtensionAPI) {
  // Register all extensions in order
  toolRenderers(pi);
  messageRenderers(pi);
  selectorRenderer(pi);
  workingMessageModifier(pi);
  footerSuppressor(pi);
  
  // Notify that extension is loaded
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("[pi-linear-mode extension loaded]", "info");
  });
}