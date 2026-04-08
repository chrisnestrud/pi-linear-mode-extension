import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { logger } from "../lib/logger.ts";

/**
 * Working message modifier for pi-linear-mode.
 * 
 * Replaces the animated "⠋ Working..." spinner with a static "Working..." message
 * when text is sent to the LLM. This is screen-reader friendly while still providing
 * user feedback that processing is happening.
 * 
 * Shows "Working..." during LLM processing, clears when done.
 */
export default function workingMessageModifier(pi: ExtensionAPI) {
  // Use a simple static message with brackets
  const workingMessage = "[Working...]";
  const workingWidgetKey = "pi-linear-mode-working-message";
  
  let workingMessageActive = false;
  let workingMessageTimeout: NodeJS.Timeout | null = null;
  
  function setWorkingMessage(ctx: any) {
    try {
      if (ctx.hasUI === false) {
        return;
      }
      // Suppress pi's built-in loader/spinner entirely.
      // In pi core, an empty string hides the loader, while any non-empty string
      // still renders the animated braille spinner.
      ctx.ui.setWorkingMessage("");
      // Show a static, screen-reader-friendly replacement instead.
      // Place it below the editor so it behaves more like a transient status line
      // than persistent header content.
      ctx.ui.setWidget(workingWidgetKey, [workingMessage], { placement: "belowEditor" });
      workingMessageActive = true;
      
      // Safety timeout: clear working message after 2 minutes if not cleared
      if (workingMessageTimeout) {
        clearTimeout(workingMessageTimeout);
      }
      workingMessageTimeout = setTimeout(() => {
        if (workingMessageActive) {
          logger.warn(`Working message timeout after 2 minutes`);
          clearWorkingMessage(ctx);
        }
      }, 2 * 60 * 1000); // 2 minutes
    } catch (error) {
      logger.error(`Error setting working message:`, error);
    }
  }
  
  function clearWorkingMessage(ctx: any) {
    try {
      if (ctx.hasUI === false) {
        return;
      }
      // Keep the built-in loader hidden so the animated spinner never appears.
      ctx.ui.setWorkingMessage("");
      ctx.ui.setWidget(workingWidgetKey, undefined);
      workingMessageActive = false;
      
      // Clear timeout if set
      if (workingMessageTimeout) {
        clearTimeout(workingMessageTimeout);
        workingMessageTimeout = null;
      }
    } catch (error) {
      logger.error(`Error clearing working message:`, error);
    }
  }
  
  pi.on("session_start", async (_event, ctx) => {
    // Start with no working message
    clearWorkingMessage(ctx);
  });

  pi.on("agent_start", async (_event, ctx) => {
    // Clear any existing working message when agent starts
    clearWorkingMessage(ctx);
  });

  pi.on("turn_start", async (_event, ctx) => {
    // Show "Working..." when a turn starts (when text is sent to LLM)
    setWorkingMessage(ctx);
  });

  pi.on("agent_end", async (_event, ctx) => {
    // Clear working message when agent ends
    clearWorkingMessage(ctx);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    // Clean up
    clearWorkingMessage(ctx);
  });
}