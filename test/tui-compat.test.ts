import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import tuiCompat from '../src/extensions/tui-compat.ts';
import { state, resetEphemeralState } from '../src/lib/state.ts';

describe('tui-compat extension', () => {
  let mockPi: ExtensionAPI & { sendMessage: ReturnType<typeof vi.fn> };
  let registeredCommands: Record<string, any>;
  let sessionStartHandler: ((event: any, ctx: any) => Promise<void>) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    resetEphemeralState();
    state.unsupportedWarnings.clear();
    registeredCommands = {};

    mockPi = {
      registerCommand: vi.fn((name: string, spec: any) => {
        registeredCommands[name] = spec;
      }),
      on: vi.fn((event: string, handler: any) => {
        if (event === 'session_start') sessionStartHandler = handler;
      }),
      sendMessage: vi.fn(),
    } as unknown as ExtensionAPI & { sendMessage: ReturnType<typeof vi.fn> };

    tuiCompat(mockPi);
  });

  it('registers commands and session_start hook', () => {
    expect(mockPi.registerCommand).toHaveBeenCalledTimes(3);
    expect(registeredCommands['linear-package-status']).toBeDefined();
    expect(registeredCommands['linear-test-fork-latest-user']).toBeDefined();
    expect(registeredCommands['linear-test-switch-current-session']).toBeDefined();
    expect(mockPi.on).toHaveBeenCalledWith('session_start', expect.any(Function));
    expect(sessionStartHandler).toBeDefined();
  });

  it('session_start handler is a no-op', async () => {
    const ctx = { ui: { notify: vi.fn() } };
    await sessionStartHandler!({}, ctx);
    expect(ctx.ui.notify).not.toHaveBeenCalled();
  });

  it('linear-package-status reports native dialog status and sends message', async () => {
    const ctx = { ui: { notify: vi.fn() } };
    await registeredCommands['linear-package-status'].handler('', ctx);

    expect(mockPi.sendMessage).toHaveBeenCalledWith({
      customType: 'linear-workflow/status',
      content: 'native pi dialogs active\ncustom interaction queue removed',
      display: true,
      details: {
        nativeDialogs: true,
        customInteractionQueue: false,
      },
    });
    expect(ctx.ui.notify).toHaveBeenCalledWith('[native pi dialogs active\ncustom interaction queue removed]', 'info');
  });

  it('linear-test-fork-latest-user warns when there is no user message', async () => {
    const ctx = {
      ui: { notify: vi.fn() },
      sessionManager: {
        getEntries: vi.fn().mockReturnValue([
          { type: 'message', message: { role: 'assistant' }, id: 'a1' },
        ]),
      },
      fork: vi.fn(),
    };

    await registeredCommands['linear-test-fork-latest-user'].handler('', ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith('[No user message available to fork from]', 'error');
    expect(ctx.fork).not.toHaveBeenCalled();
  });

  it('linear-test-fork-latest-user warns when fork is cancelled', async () => {
    const ctx = {
      ui: { notify: vi.fn() },
      sessionManager: {
        getEntries: vi.fn().mockReturnValue([
          { type: 'message', message: { role: 'assistant' }, id: 'a1' },
          { type: 'message', message: { role: 'user' }, id: 'u1' },
        ]),
      },
      fork: vi.fn().mockResolvedValue({ cancelled: true }),
    };

    await registeredCommands['linear-test-fork-latest-user'].handler('', ctx);

    expect(ctx.fork).toHaveBeenCalledWith('u1');
    expect(ctx.ui.notify).toHaveBeenCalledWith('[Fork cancelled]', 'warning');
    expect(mockPi.sendMessage).not.toHaveBeenCalled();
  });

  it('linear-test-fork-latest-user sends status on success', async () => {
    const ctx = {
      ui: { notify: vi.fn() },
      sessionManager: {
        getEntries: vi.fn().mockReturnValue([
          { type: 'message', message: { role: 'user' }, id: 'u1' },
          { type: 'message', message: { role: 'assistant' }, id: 'a1' },
          { type: 'message', message: { role: 'user' }, id: 'u2' },
        ]),
      },
      fork: vi.fn().mockResolvedValue({ cancelled: false }),
    };

    await registeredCommands['linear-test-fork-latest-user'].handler('', ctx);

    expect(ctx.fork).toHaveBeenCalledWith('u2');
    expect(mockPi.sendMessage).toHaveBeenCalledWith({
      customType: 'linear-workflow/status',
      content: 'forked from user message: u2',
      display: true,
      details: {
        action: 'fork',
        entryId: 'u2',
      },
    });
  });

  it('linear-test-switch-current-session warns when there is no current session file', async () => {
    const ctx = {
      ui: { notify: vi.fn() },
      sessionManager: {
        getSessionFile: vi.fn().mockReturnValue(undefined),
      },
      newSession: vi.fn(),
      switchSession: vi.fn(),
    };

    await registeredCommands['linear-test-switch-current-session'].handler('', ctx);

    expect(ctx.ui.notify).toHaveBeenCalledWith('[No current session file available to switch back to]', 'error');
    expect(ctx.newSession).not.toHaveBeenCalled();
  });

  it('linear-test-switch-current-session warns when new session is cancelled', async () => {
    const ctx = {
      ui: { notify: vi.fn() },
      sessionManager: {
        getSessionFile: vi.fn().mockReturnValue('/tmp/current.pi'),
      },
      newSession: vi.fn().mockResolvedValue({ cancelled: true }),
      switchSession: vi.fn(),
    };

    await registeredCommands['linear-test-switch-current-session'].handler('', ctx);

    expect(ctx.newSession).toHaveBeenCalled();
    expect(ctx.ui.notify).toHaveBeenCalledWith('[Session switch test cancelled while creating a fresh session]', 'warning');
    expect(ctx.switchSession).not.toHaveBeenCalled();
  });

  it('linear-test-switch-current-session warns when switching back is cancelled', async () => {
    state.unsupportedWarnings.add('test-warning');

    const ctx = {
      ui: { notify: vi.fn() },
      sessionManager: {
        getSessionFile: vi.fn().mockReturnValue('/tmp/current.pi'),
      },
      newSession: vi.fn().mockImplementation(async ({ setup }: any) => {
        await setup({ getSessionFile: () => '/tmp/fresh.pi' });
        return { cancelled: false };
      }),
      switchSession: vi.fn().mockResolvedValue({ cancelled: true }),
    };

    await registeredCommands['linear-test-switch-current-session'].handler('', ctx);

    expect(ctx.switchSession).toHaveBeenCalledWith('/tmp/current.pi');
    expect(ctx.ui.notify).toHaveBeenCalledWith('[Switch back to the original session was cancelled]', 'warning');
    expect(state.unsupportedWarnings.has('test-warning')).toBe(true);
  });

  it('linear-test-switch-current-session sends status on success', async () => {
    const ctx = {
      ui: { notify: vi.fn() },
      sessionManager: {
        getSessionFile: vi.fn().mockReturnValue('/tmp/current.pi'),
      },
      newSession: vi.fn().mockImplementation(async ({ setup }: any) => {
        await setup({ getSessionFile: () => '/tmp/fresh.pi' });
        return { cancelled: false };
      }),
      switchSession: vi.fn().mockResolvedValue({ cancelled: false }),
    };

    await registeredCommands['linear-test-switch-current-session'].handler('', ctx);

    expect(mockPi.sendMessage).toHaveBeenCalledWith({
      customType: 'linear-workflow/status',
      content: 'switched back to session: /tmp/current.pi',
      display: true,
      details: {
        action: 'switch-session',
        nativeDialogs: true,
        fromSessionFile: '/tmp/current.pi',
        freshSessionFile: '/tmp/fresh.pi',
      },
    });
  });
});
