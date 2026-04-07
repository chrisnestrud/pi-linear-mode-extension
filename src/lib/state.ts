export interface ActiveInteractionOption {
  label: string;
  preview?: string;
  execute: () => Promise<void> | void;
}

export interface ActiveInteraction {
  id: string;
  title: string;
  options: ActiveInteractionOption[];
  createdAt: string;
  sessionFile?: string;
  sourceExtension?: string;
}

export interface LinearWorkflowState {
  activeInteraction?: ActiveInteraction;
  queuedInteractions: ActiveInteraction[];
  unsupportedWarnings: Set<string>;
  lastAbortFingerprint?: string;
  lastShownInteractionId?: string;
}

const STATE_KEY = "__piLinearWorkflowState";

function createState(): LinearWorkflowState {
  return {
    activeInteraction: undefined,
    queuedInteractions: [],
    unsupportedWarnings: new Set<string>(),
    lastAbortFingerprint: undefined,
    lastShownInteractionId: undefined,
  };
}

const globalState = globalThis as typeof globalThis & {
  [STATE_KEY]?: LinearWorkflowState;
};

export const state: LinearWorkflowState = globalState[STATE_KEY] ?? (globalState[STATE_KEY] = createState());

export function resetEphemeralState(): void {
  state.activeInteraction = undefined;
  state.queuedInteractions = [];
  state.lastAbortFingerprint = undefined;
  state.lastShownInteractionId = undefined;
}

export function promoteNextInteraction(): void {
  state.activeInteraction = state.queuedInteractions.shift();
}
