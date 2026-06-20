import type { APIRoute } from "astro";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  createLeaveifyTransferControl,
  LeaveifyTransferCancelledError,
  updateLeaveifyTransferControl,
  type LeaveifyTransferControl,
} from "../src/utils/leaveifyTransferControl";

const { PATCH } = (await import(
  "../src/pages/api/tools/leaveify/transfer/[requestId]"
)) as {
  PATCH: APIRoute;
};

const controls: LeaveifyTransferControl[] = [];

function createControl(requestId: string) {
  const control = createLeaveifyTransferControl(requestId);
  controls.push(control);
  return control;
}

async function flushAsyncWork() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function patchTransferControl(requestId: string, action: unknown) {
  return PATCH({
    params: { requestId },
    request: new Request(
      `http://localhost/api/tools/leaveify/transfer/${requestId}`,
      {
        body: JSON.stringify({ action }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      },
    ),
  } as unknown as Parameters<APIRoute>[0]);
}

afterEach(() => {
  for (const control of controls.splice(0)) {
    control.dispose();
  }
});

describe("Leaveify transfer control", () => {
  test("checkpoint blocks while paused and resume releases it", async () => {
    const requestId = "checkpoint-pause-resume";
    const control = createControl(requestId);
    const onPaused = vi.fn();
    let checkpointReleased = false;

    expect(updateLeaveifyTransferControl(requestId, "pause")).toMatchObject({
      ok: true,
      state: {
        cancelled: false,
        paused: true,
        requestId,
      },
    });

    const checkpoint = control.checkpoint({ onPaused }).then(() => {
      checkpointReleased = true;
    });

    await flushAsyncWork();

    expect(onPaused).toHaveBeenCalledTimes(1);
    expect(checkpointReleased).toBe(false);

    expect(updateLeaveifyTransferControl(requestId, "resume")).toMatchObject({
      ok: true,
      state: {
        cancelled: false,
        paused: false,
        requestId,
      },
    });

    await expect(checkpoint).resolves.toBeUndefined();
    expect(checkpointReleased).toBe(true);
  });

  test("cancel rejects a blocked checkpoint", async () => {
    const requestId = "checkpoint-cancel";
    const control = createControl(requestId);

    updateLeaveifyTransferControl(requestId, "pause");
    const checkpoint = control.checkpoint();

    await flushAsyncWork();

    expect(updateLeaveifyTransferControl(requestId, "cancel")).toMatchObject({
      ok: true,
      state: {
        cancelled: true,
        paused: false,
        requestId,
      },
    });

    await expect(checkpoint).rejects.toBeInstanceOf(
      LeaveifyTransferCancelledError,
    );
    await expect(control.checkpoint()).rejects.toBeInstanceOf(
      LeaveifyTransferCancelledError,
    );
  });

  test("disposed and unknown request ids return actionable 404 responses", async () => {
    const disposedRequestId = "disposed-control";
    const disposedControl = createControl(disposedRequestId);
    disposedControl.dispose();
    disposedControl.dispose();

    const disposedResponse = await patchTransferControl(
      disposedRequestId,
      "pause",
    );
    expect(disposedResponse.status).toBe(404);
    await expect(disposedResponse.json()).resolves.toMatchObject({
      action: "pause",
      code: "leaveify_transfer_control_inactive",
      processLocal: true,
      reason: "disposed",
      requestId: disposedRequestId,
      retryable: false,
    });

    const unknownRequestId = "unknown-control";
    const unknownResponse = await patchTransferControl(
      unknownRequestId,
      "resume",
    );
    expect(unknownResponse.status).toBe(404);
    const unknownBody = (await unknownResponse.json()) as {
      error?: string;
    };
    expect(unknownBody).toMatchObject({
      action: "resume",
      code: "leaveify_transfer_control_unavailable",
      processLocal: true,
      reason: "not_found",
      requestId: unknownRequestId,
      retryable: false,
    });
    expect(unknownBody.error).toContain("process-local");
    expect(unknownBody.error).toContain("serverless instance");
  });

  test("unsupported actions return supported actions", async () => {
    const response = await patchTransferControl("unsupported-action", "stop");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "leaveify_transfer_control_unsupported_action",
      error:
        "Unsupported transfer action. Expected one of: pause, resume, cancel.",
      supportedActions: ["pause", "resume", "cancel"],
    });
  });
});
