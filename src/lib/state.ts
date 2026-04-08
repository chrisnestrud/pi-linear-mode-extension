export interface LinearWorkflowState {
  unsupportedWarnings: Set<string>;
}

const STATE_KEY = "__piLinearWorkflowState";

function createState(): LinearWorkflowState {
  return {
    unsupportedWarnings: new Set<string>(),
  };
}

const globalState = globalThis as typeof globalThis & {
  [STATE_KEY]?: LinearWorkflowState;
};

export const state: LinearWorkflowState = globalState[STATE_KEY] ?? (globalState[STATE_KEY] = createState());

export function resetEphemeralState(): void {
  state.unsupportedWarnings.clear();
}
