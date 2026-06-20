export class LeaveifyTransferCancelledError extends Error {
  constructor(message = "Transfer cancelled.") {
    super(message);
    this.name = "LeaveifyTransferCancelledError";
  }
}

type TransferControlState = {
  abortController: AbortController;
  cancelled: boolean;
  disposed: boolean;
  paused: boolean;
  waiters: Set<() => void>;
};

type MaybePromise<T> = Promise<T> | T;

type InactiveTransferControlReason = "disposed" | "replaced";

type InactiveTransferControlDiagnostic = {
  inactiveAtMs: number;
  reason: InactiveTransferControlReason;
};

export const LEAVEIFY_TRANSFER_CONTROL_ACTIONS = [
  "pause",
  "resume",
  "cancel",
] as const;

export type LeaveifyTransferControlAction =
  (typeof LEAVEIFY_TRANSFER_CONTROL_ACTIONS)[number];

export type LeaveifyTransferControl = {
  checkpoint: (options?: {
    onPaused?: () => MaybePromise<void>;
  }) => Promise<void>;
  dispose: () => void;
  isCancelled: () => boolean;
  requestId: string;
  signal: AbortSignal;
};

export type LeaveifyTransferControlSnapshot = {
  cancelled: boolean;
  paused: boolean;
  requestId: string;
};

export type LeaveifyTransferControlUnavailableResult = {
  action: LeaveifyTransferControlAction;
  code:
    | "leaveify_transfer_control_inactive"
    | "leaveify_transfer_control_unavailable";
  message: string;
  ok: false;
  processLocal: true;
  reason: InactiveTransferControlReason | "not_found";
  requestId: string;
  retryable: false;
};

export type LeaveifyTransferControlUpdateResult =
  | {
      ok: true;
      state: LeaveifyTransferControlSnapshot;
    }
  | LeaveifyTransferControlUnavailableResult;

const transferControls = new Map<string, TransferControlState>();
const inactiveTransferControls = new Map<
  string,
  InactiveTransferControlDiagnostic
>();
const inactiveDiagnosticTtlMs = 15 * 60 * 1000;
const maxInactiveDiagnostics = 100;
const processLocalControlMessage =
  "Leaveify transfer controls are process-local and only work while the streaming transfer is still running on the same server instance. The transfer may have completed, been cancelled, expired, or this request may have reached a different serverless instance.";

export function isLeaveifyTransferControlAction(
  value: unknown,
): value is LeaveifyTransferControlAction {
  return (
    typeof value === "string" &&
    LEAVEIFY_TRANSFER_CONTROL_ACTIONS.includes(
      value as LeaveifyTransferControlAction,
    )
  );
}

function wakeWaiters(state: TransferControlState) {
  const waiters = [...state.waiters];
  state.waiters.clear();

  for (const resolve of waiters) {
    resolve();
  }
}

function waitForStateChange(state: TransferControlState) {
  let waiter: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    waiter = () => {
      if (waiter) {
        state.waiters.delete(waiter);
      }
      resolve();
    };
    state.waiters.add(waiter);
  });

  return promise.finally(() => {
    if (waiter) {
      state.waiters.delete(waiter);
    }
  });
}

function throwIfStopped(state: TransferControlState) {
  if (state.cancelled) {
    throw new LeaveifyTransferCancelledError();
  }

  if (state.disposed) {
    throw new LeaveifyTransferCancelledError(
      "Transfer control is no longer active.",
    );
  }
}

function createSnapshot(
  requestId: string,
  state: TransferControlState,
): LeaveifyTransferControlSnapshot {
  return {
    cancelled: state.cancelled,
    paused: state.paused,
    requestId,
  };
}

function trimInactiveDiagnostics(now = Date.now()) {
  for (const [requestId, diagnostic] of inactiveTransferControls) {
    if (now - diagnostic.inactiveAtMs > inactiveDiagnosticTtlMs) {
      inactiveTransferControls.delete(requestId);
    }
  }

  while (inactiveTransferControls.size > maxInactiveDiagnostics) {
    const oldestRequestId = inactiveTransferControls.keys().next().value;
    if (!oldestRequestId) {
      break;
    }
    inactiveTransferControls.delete(oldestRequestId);
  }
}

function rememberInactiveControl(
  requestId: string,
  reason: InactiveTransferControlReason,
) {
  inactiveTransferControls.set(requestId, {
    inactiveAtMs: Date.now(),
    reason,
  });
  trimInactiveDiagnostics();
}

function disposeTransferControl(
  requestId: string,
  state: TransferControlState,
  reason: InactiveTransferControlReason,
) {
  if (state.disposed) {
    return;
  }

  state.disposed = true;
  state.paused = false;

  if (transferControls.get(requestId) === state) {
    transferControls.delete(requestId);
  }

  rememberInactiveControl(requestId, reason);
  wakeWaiters(state);
}

function createUnavailableResult(
  requestId: string,
  action: LeaveifyTransferControlAction,
): LeaveifyTransferControlUnavailableResult {
  trimInactiveDiagnostics();

  const diagnostic = inactiveTransferControls.get(requestId);
  if (diagnostic) {
    return {
      action,
      code: "leaveify_transfer_control_inactive",
      message: `Transfer control is no longer active (${diagnostic.reason}). ${processLocalControlMessage}`,
      ok: false,
      processLocal: true,
      reason: diagnostic.reason,
      requestId,
      retryable: false,
    };
  }

  return {
    action,
    code: "leaveify_transfer_control_unavailable",
    message: `No active transfer control was found for this request id. ${processLocalControlMessage}`,
    ok: false,
    processLocal: true,
    reason: "not_found",
    requestId,
    retryable: false,
  };
}

export function createLeaveifyTransferControl(
  requestId: string,
): LeaveifyTransferControl {
  const existing = transferControls.get(requestId);
  if (existing) {
    existing.cancelled = true;
    existing.abortController.abort(new LeaveifyTransferCancelledError());
    disposeTransferControl(requestId, existing, "replaced");
  }

  const state: TransferControlState = {
    abortController: new AbortController(),
    cancelled: false,
    disposed: false,
    paused: false,
    waiters: new Set(),
  };
  transferControls.set(requestId, state);
  inactiveTransferControls.delete(requestId);

  return {
    async checkpoint(options) {
      throwIfStopped(state);

      if (state.paused && !state.cancelled) {
        await options?.onPaused?.();
      }

      while (state.paused && !state.cancelled && !state.disposed) {
        await waitForStateChange(state);
      }

      throwIfStopped(state);
    },
    dispose() {
      disposeTransferControl(requestId, state, "disposed");
    },
    isCancelled() {
      return state.cancelled;
    },
    requestId,
    signal: state.abortController.signal,
  };
}

export function updateLeaveifyTransferControl(
  requestId: string,
  action: LeaveifyTransferControlAction,
): LeaveifyTransferControlUpdateResult {
  const state = transferControls.get(requestId);
  if (!state || state.disposed) {
    return createUnavailableResult(requestId, action);
  }

  if (action === "cancel") {
    state.cancelled = true;
    state.paused = false;
    if (!state.abortController.signal.aborted) {
      state.abortController.abort(new LeaveifyTransferCancelledError());
    }
    wakeWaiters(state);
  } else if (action === "pause") {
    if (!state.cancelled) {
      state.paused = true;
    }
  } else {
    state.paused = false;
    wakeWaiters(state);
  }

  return {
    ok: true,
    state: createSnapshot(requestId, state),
  };
}
