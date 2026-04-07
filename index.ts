/**
 * pi-linear-mode-extension - Main entry point
 * 
 * This extension provides a more linear workflow inside the pi CLI with:
 * - Numbered interactions for tool selection
 * - Custom tool renderers for linear display
 * - Selector renderer for interactive selection
 * - Bash renderer for command output
 * - Message renderers for custom message display
 * - TUI compatibility layer
 * - Interaction manager for handling user interactions
 * - Abort marker for tracking aborted operations
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

// Import all extensions
import interactionManager from "./src/extensions/interaction-manager.js";
import abortMarker from "./src/extensions/abort-marker.js";
import numberedInteractions from "./src/extensions/numbered-interactions.js";
import tuiCompat from "./src/extensions/tui-compat.js";
import toolRenderers from "./src/extensions/tool-renderers.js";
import messageRenderers from "./src/extensions/message-renderers.js";
import bashRenderer from "./src/extensions/bash-renderer.js";
import selectorRenderer from "./src/extensions/selector-renderer.js";
import workingMessageSuppressor from "./src/extensions/working-message-suppressor.js";

export default function piLinearModeExtension(pi: ExtensionAPI) {
  // Register all extensions in order
  interactionManager(pi);
  abortMarker(pi);
  numberedInteractions(pi);
  tuiCompat(pi);
  toolRenderers(pi);
  messageRenderers(pi);
  bashRenderer(pi);
  selectorRenderer(pi);
  workingMessageSuppressor(pi);
  
  // Notify that extension is loaded
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("pi-linear-mode extension loaded", "info");
  });
}