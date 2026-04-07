import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { cancelInteractionForNormalHandoff } from "../lib/interactions.js";
import { resetEphemeralState, state } from "../lib/state.js";

function warnOnce(ctx: ExtensionContext, key: string, message: string) {
  if (state.unsupportedWarnings.has(key)) return;
  state.unsupportedWarnings.add(key);
  ctx.ui.notify(message, "error");
}

export default function tuiCompat(pi: ExtensionAPI) {
  pi.registerCommand("linear-package-status", {
    description: "Show current linear workflow package status",
    handler: async (_args, ctx) => {
      cancelInteractionForNormalHandoff(pi);
      const lines = [
        `active interaction: ${state.activeInteraction ? "yes" : "no"}`,
        `queued interactions: ${state.queuedInteractions.length}`,
      ];
      const content = lines.join("\n");
      pi.sendMessage({
        customType: "linear-workflow/status",
        content,
        display: true,
        details: {
          activeInteraction: Boolean(state.activeInteraction),
          queuedInteractions: state.queuedInteractions.length,
        },
      });
      ctx.ui.notify(content, "info");
    },
  });

  pi.registerCommand("linear-test-fork-latest-user", {
    description: "Fork from the latest user message without cancelling active interaction state",
    handler: async (_args, ctx) => {
      const entries = ctx.sessionManager.getEntries();
      const latestUserEntry = [...entries].reverse().find((entry) => entry.type === "message" && entry.message.role === "user");
      if (!latestUserEntry) {
        ctx.ui.notify("No user message available to fork from", "error");
        return;
      }

      const result = await ctx.fork(latestUserEntry.id);
      if (result.cancelled) {
        ctx.ui.notify("Fork cancelled", "warning");
        return;
      }

      pi.sendMessage({
        customType: "linear-workflow/status",
        content: `forked from user message: ${latestUserEntry.id}`,
        display: true,
        details: {
          action: "fork",
          entryId: latestUserEntry.id,
        },
      });
    },
  });

  pi.registerCommand("linear-test-switch-current-session", {
    description: "Create a fresh session, then switch back to the current session without cancelling active interaction state",
    handler: async (_args, ctx) => {
      const currentSessionFile = ctx.sessionManager.getSessionFile();
      const hadActiveInteraction = Boolean(state.activeInteraction);
      if (!currentSessionFile) {
        ctx.ui.notify("No current session file available to switch back to", "error");
        return;
      }

      let freshSessionFile: string | undefined;
      const newResult = await ctx.newSession({
        setup: async (sessionManager) => {
          freshSessionFile = sessionManager.getSessionFile();
        },
      });
      if (newResult.cancelled) {
        ctx.ui.notify("Session switch test cancelled while creating a fresh session", "warning");
        return;
      }
      resetEphemeralState();

      const switchResult = await ctx.switchSession(currentSessionFile);
      if (switchResult.cancelled) {
        ctx.ui.notify("Switch back to the original session was cancelled", "warning");
        return;
      }
      resetEphemeralState();

      pi.sendMessage({
        customType: "linear-workflow/status",
        content: `switched back to session: ${currentSessionFile}`,
        display: true,
        details: {
          action: "switch-session",
          hadActiveInteraction,
          fromSessionFile: currentSessionFile,
          freshSessionFile,
        },
      });
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    // Placeholder: future TUI API compatibility shims can publish package-owned
    // interactions instead of trying to render richer UI directly.
    void warnOnce;
    void ctx;
  });
}
