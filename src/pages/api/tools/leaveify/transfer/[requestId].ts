import type { APIRoute } from "astro";

import {
  isLeaveifyTransferControlAction,
  LEAVEIFY_TRANSFER_CONTROL_ACTIONS,
  updateLeaveifyTransferControl,
} from "@/utils/leaveifyTransferControl";

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request }) => {
  const requestId = params.requestId?.trim();
  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown;
  };

  if (!requestId) {
    return Response.json(
      {
        code: "leaveify_transfer_control_missing_request_id",
        error: "Missing transfer request id.",
      },
      { status: 400 },
    );
  }

  if (!isLeaveifyTransferControlAction(body.action)) {
    return Response.json(
      {
        code: "leaveify_transfer_control_unsupported_action",
        error:
          "Unsupported transfer action. Expected one of: pause, resume, cancel.",
        supportedActions: LEAVEIFY_TRANSFER_CONTROL_ACTIONS,
      },
      { status: 400 },
    );
  }

  const nextState = updateLeaveifyTransferControl(requestId, body.action);
  if (!nextState.ok) {
    return Response.json(
      {
        action: nextState.action,
        code: nextState.code,
        error: nextState.message,
        processLocal: nextState.processLocal,
        reason: nextState.reason,
        requestId: nextState.requestId,
        retryable: nextState.retryable,
      },
      { status: 404 },
    );
  }

  return Response.json(nextState.state);
};
