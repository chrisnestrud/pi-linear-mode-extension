import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * Working message suppressor for pi-linear-mode.
 * 
 * Suppresses the "⠋ Working..." spinner that appears when text is sent to the LLM.
 * In linear mode, we want a cleaner, spinner-free interface.
 * 
 * Strategy: Use empty string ("") to hide the loader completely.
 * With our fixes to pi, `setWorkingMessage("")` will hide the "⠋ Working..." spinner.
 * 
 * Note: pi's `resetExtensionUI()` method may reset the working message to default
 * at times (e.g., on session change or reload). We handle this by setting the
 * message again on `turn_start` and `agent_start` events.
 */
export default function workingMessageSuppressor(pi: ExtensionAPI) {
  console.error(`[pi-linear-mode] workingMessageSuppressor extension loading`);
  
  // With our fix to pi, empty string ("") will hide the loader
  // We'll use empty string to completely suppress the "⠋ Working..." spinner
  const hideMessage = "";
  
  let currentMessageIndex = 0; // Always use empty string
  let workingMessageSet = false;
  
  function setMinimalWorkingMessage(ctx: any) {
    console.error(`[pi-linear-mode] setMinimalWorkingMessage called`);
    ctx.ui.setWorkingMessage(hideMessage);
    workingMessageSet = true;
    console.error(`[pi-linear-mode] Working message set to empty string (hiding loader)`);
  }
  
  pi.on("session_start", async (_event, ctx) => {
    console.error(`[pi-linear-mode] session_start event`);
    setMinimalWorkingMessage(ctx);
  });

  pi.on("agent_start", async (_event, ctx) => {
    console.error(`[pi-linear-mode] agent_start event, workingMessageSet=${workingMessageSet}`);
    if (!workingMessageSet) {
      setMinimalWorkingMessage(ctx);
    }
  });

  pi.on("turn_start", async (_event, ctx) => {
    console.error(`[pi-linear-mode] turn_start event (text sent to LLM)`);
    // Set working message when a turn starts (when text is sent to LLM)
    setMinimalWorkingMessage(ctx);
  });

  pi.on("agent_end", async (_event, ctx) => {
    // Restore default working message when agent ends
    ctx.ui.setWorkingMessage();
    workingMessageSet = false;
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    // Clean up
    if (workingMessageSet) {
      ctx.ui.setWorkingMessage();
      workingMessageSet = false;
    }
  });
}