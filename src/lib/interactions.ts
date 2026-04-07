import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { promoteNextInteraction, state, type ActiveInteraction, type ActiveInteractionOption } from "./state.ts";

export interface EnqueueInteractionInput {
  title: string;
  options: ActiveInteractionOption[];
  sessionFile?: string;
  sourceExtension?: string;
}

function makeInteractionId(): string {
  return `interaction-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function renderInteractionText(interaction: ActiveInteraction): string {
  const lines = [
    "Selection pending",
    interaction.title,
    "",
  ];
  for (const [index, option] of interaction.options.entries()) {
    lines.push(`${index + 1}. ${option.label}`);
    if (option.preview) {
      lines.push(`   ${option.preview}`);
    }
  }
  return lines.join("\n");
}

export function publishActiveInteraction(pi: ExtensionAPI, options?: { force?: boolean }): void {
  const active = state.activeInteraction;
  if (!active) return;
  if (!options?.force && state.lastShownInteractionId === active.id) return;

  state.lastShownInteractionId = active.id;
  pi.sendMessage({
    customType: "linear-workflow/interaction",
    content: renderInteractionText(active),
    display: true,
    details: {
      interactionId: active.id,
      sourceExtension: active.sourceExtension,
      createdAt: active.createdAt,
      sessionFile: active.sessionFile,
      options: active.options.map((option, index) => ({
        index: index + 1,
        label: option.label,
        preview: option.preview,
      })),
    },
  });
}

export function enqueueInteraction(input: EnqueueInteractionInput): ActiveInteraction {
  const interaction: ActiveInteraction = {
    id: makeInteractionId(),
    title: input.title,
    options: input.options,
    createdAt: new Date().toISOString(),
    sessionFile: input.sessionFile,
    sourceExtension: input.sourceExtension,
  };

  if (!state.activeInteraction) {
    state.activeInteraction = interaction;
  } else {
    state.queuedInteractions.push(interaction);
  }

  return interaction;
}

export function createAndPublishInteraction(pi: ExtensionAPI, input: EnqueueInteractionInput): ActiveInteraction {
  const interaction = enqueueInteraction(input);
  publishActiveInteraction(pi, { force: true });
  return interaction;
}

export function cancelActiveInteraction(): void {
  state.activeInteraction = undefined;
  state.lastShownInteractionId = undefined;
  promoteNextInteraction();
}

export function discardInteractionsForSessionChange(sessionFile: string | undefined): boolean {
  const activeMismatch = state.activeInteraction && state.activeInteraction.sessionFile !== sessionFile;
  const queuedMismatch = state.queuedInteractions.some((interaction) => interaction.sessionFile !== sessionFile);
  if (!activeMismatch && !queuedMismatch) return false;

  state.activeInteraction = undefined;
  state.queuedInteractions = [];
  state.lastShownInteractionId = undefined;
  return true;
}

export function cancelInteractionForNormalHandoff(pi: ExtensionAPI): boolean {
  if (!state.activeInteraction) return false;

  cancelActiveInteraction();
  publishActiveInteraction(pi);
  return true;
}

export async function resolveActiveInteraction(
  pi: ExtensionAPI,
  _ctx: ExtensionContext,
  selected: ActiveInteractionOption,
): Promise<void> {
  state.activeInteraction = undefined;
  state.lastShownInteractionId = undefined;
  promoteNextInteraction();
  await selected.execute();
  publishActiveInteraction(pi);
}
