import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { state } from "../lib/state.ts";

function fingerprintFromMessage(message: { timestamp?: number; errorMessage?: string }): string {
  return `${message.timestamp ?? 0}:${message.errorMessage ?? "aborted"}`;
}

function maybePersistAbortMarker(
  pi: ExtensionAPI,
  message: { role?: string; stopReason?: string; timestamp?: number; errorMessage?: string },
): void {
  if (message.role !== "assistant") return;
  if (message.stopReason !== "aborted") return;

  const fingerprint = fingerprintFromMessage(message);
  if (state.lastAbortFingerprint === fingerprint) return;
  state.lastAbortFingerprint = fingerprint;

  pi.sendMessage({
    customType: "linear-workflow/abort",
    content: "Operation aborted",
    display: true,
    details: {
      timestamp: new Date().toISOString(),
      source: "ctrl+c",
    },
  });
}

export default function abortMarker(pi: ExtensionAPI) {
  pi.on("agent_end", async (event) => {
    const abortedAssistant = [...event.messages].reverse().find((message) => {
      return message.role === "assistant" && message.stopReason === "aborted";
    });
    if (!abortedAssistant) return;

    maybePersistAbortMarker(pi, abortedAssistant);
  });
}
