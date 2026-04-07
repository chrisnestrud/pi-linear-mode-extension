import type { ExtensionAPI, InputEventResult } from "@mariozechner/pi-coding-agent";
import {
  cancelInteractionForNormalHandoff,
  discardInteractionsForSessionChange,
  publishActiveInteraction,
  resolveActiveInteraction,
} from "../lib/interactions.ts";
import { resetEphemeralState, state } from "../lib/state.ts";

function isBareNumber(text: string): boolean {
  return /^\d+$/.test(text.trim());
}

export default function interactionManager(pi: ExtensionAPI) {
  resetEphemeralState();

  pi.on("session_start", () => {
    resetEphemeralState();
  });

  pi.on("session_shutdown", () => {
    resetEphemeralState();
  });

  pi.on("input", async (event, ctx): Promise<InputEventResult> => {
    discardInteractionsForSessionChange(ctx.sessionManager.getSessionFile());

    const text = event.text.trim();
    const active = state.activeInteraction;

    if (!active) {
      return { action: "continue" };
    }

    if (!isBareNumber(text)) {
      cancelInteractionForNormalHandoff(pi);
      return { action: "continue" };
    }

    const selectedIndex = Number.parseInt(text, 10) - 1;
    const selected = active.options[selectedIndex];
    if (!selected) {
      ctx.ui.notify(`[Invalid selection: ${text}]`, "warning");
      publishActiveInteraction(pi, { force: true });
      return { action: "handled" };
    }

    await resolveActiveInteraction(pi, ctx, selected);

    return { action: "handled" };
  });
}
