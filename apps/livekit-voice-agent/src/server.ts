import http from "http";
import type { IncomingMessage, ServerResponse } from "http";

import { getEnv, requireEnv, verifyBearerSecret } from "./config.js";
import { RuntimeAiKeyProvider } from "./runtime-keys.js";
import {
  LiveKitVoiceAgentSession,
  type JoinPayload,
} from "./session.js";

type ControlBody = {
  callId?: string;
  action?: "handoff" | "end" | "resume_ai";
};

const port = Number.parseInt(
  getEnv("PORT") ?? getEnv("LIVEKIT_AGENT_PORT") ?? "8082",
  10,
);
const host = getEnv("HOST") ?? "0.0.0.0";
const appUrl = requireEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
const streamSecret = requireEnv("VOICE_STREAM_SECRET");

const runtimeKeys = new RuntimeAiKeyProvider(appUrl, streamSecret);
const sessions = new Map<string, LiveKitVoiceAgentSession>();

function readJson<T>(request: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8") || "{}";
        resolve(JSON.parse(raw) as T);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: Record<string, unknown>,
): void {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function authorize(request: IncomingMessage): boolean {
  return verifyBearerSecret(request.headers.authorization, streamSecret);
}

async function handleJoin(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!authorize(request)) {
    sendJson(response, 401, { error: "Unauthorized" });
    return;
  }

  const body = await readJson<JoinPayload>(request);
  const callId = body.callId?.trim();
  const businessId = body.businessId?.trim();
  const roomName = body.roomName?.trim();
  const livekitUrl = body.livekitUrl?.trim();
  const token = body.token?.trim();
  const aiIdentity = body.aiIdentity?.trim();
  const callKey = body.callKey?.trim();

  if (
    !callId ||
    !businessId ||
    !roomName ||
    !livekitUrl ||
    !token ||
    !aiIdentity ||
    !callKey
  ) {
    sendJson(response, 400, { error: "Missing join fields" });
    return;
  }

  if (sessions.has(callId)) {
    sendJson(response, 200, { ok: true, reused: true });
    return;
  }

  const session = new LiveKitVoiceAgentSession(
    {
      callId,
      businessId,
      roomName,
      livekitUrl,
      token,
      aiIdentity,
      callKey,
    },
    appUrl,
    streamSecret,
    runtimeKeys,
    (closedCallId) => {
      sessions.delete(closedCallId);
    },
  );

  sessions.set(callId, session);
  sendJson(response, 202, { ok: true });

  void session.start().catch(async (error) => {
    console.error(
      "[livekit-voice-agent] start failed",
      error instanceof Error ? error.message : error,
    );
    await session.shutdown("start_failed");
  });
}

async function handleControl(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!authorize(request)) {
    sendJson(response, 401, { error: "Unauthorized" });
    return;
  }

  const body = await readJson<ControlBody>(request);
  const callId = body.callId?.trim();
  const action = body.action;

  if (!callId || !action) {
    sendJson(response, 400, { error: "Missing callId or action" });
    return;
  }

  const session = sessions.get(callId);
  if (!session) {
    // Idempotent: call may already have ended.
    sendJson(response, 200, { ok: true, missing: true });
    return;
  }

  if (action === "handoff") {
    await session.handoff();
  } else if (action === "end") {
    await session.shutdown("control_end");
  }

  sendJson(response, 200, { ok: true });
}

async function handleHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

  if (
    request.method === "GET" &&
    (pathname === "/health" || pathname === "/health/")
  ) {
    sendJson(response, 200, {
      ok: true,
      service: "livekit-voice-agent",
      activeSessions: sessions.size,
    });
    return;
  }

  if (request.method === "POST" && pathname === "/join") {
    await handleJoin(request, response);
    return;
  }

  if (request.method === "POST" && pathname === "/control") {
    await handleControl(request, response);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

runtimeKeys.start();

const server = http.createServer((request, response) => {
  void handleHttpRequest(request, response).catch((error) => {
    console.error(
      "[livekit-voice-agent] request failed",
      error instanceof Error ? error.message : error,
    );
    if (!response.headersSent) {
      sendJson(response, 500, { error: "Internal error" });
    }
  });
});

server.listen(port, host, () => {
  console.info(
    `[livekit-voice-agent] listening on http://${host}:${port} app=${appUrl}`,
  );
});

process.on("SIGTERM", () => {
  runtimeKeys.stop();
  server.close();
});
