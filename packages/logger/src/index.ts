import pino, { type Logger } from "pino";
import type { NextFunction, Request, Response } from "express";

export function createLogger(service: string) {
  return pino({ base: { service }, level: process.env.LOG_LEVEL ?? "info" });
}

export type ApiErrorBody = {
  error: { code: string; message: string; requestId: string };
};

export function apiErrorBody(code: string, message: string, requestId: string): ApiErrorBody {
  return { error: { code, message, requestId } };
}

export function apiErrorFormatter(req: Request, res: Response, next: NextFunction) {
  const sendJson = res.json.bind(res);
  res.json = ((body?: unknown) => {
    if (res.statusCode >= 400 && body && typeof body === "object" && !("error" in body)) {
      const payload = body as { message?: unknown };
      const message = typeof payload.message === "string" ? payload.message : "The request could not be completed.";
      const code = res.statusCode === 404 ? "NOT_FOUND" : res.statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : `HTTP_${res.statusCode}`;
      const { message: _message, ...details } = payload;
      return sendJson({ ...details, ...apiErrorBody(code, message, getRequestId(req, res)) });
    }
    return sendJson(body);
  }) as Response["json"];
  next();
}

type CriticalFailure = {
  service: string;
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  occurrences: number;
  windowMinutes: number;
  summary?: string;
};

type MonitorOptions = {
  service: string;
  logger: Logger;
  report?: (failure: CriticalFailure) => Promise<unknown>;
  threshold?: number;
  windowMs?: number;
  cooldownMs?: number;
};

export function createCentralAlertReporter(service: string, internalApiUrl: string, sharedSecret: string) {
  return async (failure: CriticalFailure) => {
    const response = await fetch(`${internalApiUrl.replace(/\/$/, "")}/api/v1/monitoring/alerts`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-gateway-secret": sharedSecret, "x-request-id": failure.requestId },
      body: JSON.stringify({ ...failure, service }),
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) throw new Error(`Central alert endpoint returned HTTP ${response.status}`);
  };
}

const normalizedPath = (path: string) => path
  .split("?")[0]
  .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id")
  .replace(/\/\d+(?=\/|$)/g, "/:id");

export function createHttp5xxMonitor({ service, logger, report, threshold = 5, windowMs = 5 * 60_000, cooldownMs = 10 * 60_000 }: MonitorOptions) {
  const failures = new Map<string, number[]>();
  const lastAlert = new Map<string, number>();

  return (req: Request, res: Response, next: NextFunction) => {
    res.once("finish", () => {
      if (res.statusCode < 500) return;
      const path = normalizedPath(req.originalUrl || req.path);
      if (path === "/health" || path === "/api/v1/monitoring/alerts") return;
      const requestId = String(res.getHeader("x-request-id") ?? req.header("x-request-id") ?? "unknown");
      const key = `${req.method} ${path}`;
      const now = Date.now();
      const recent = (failures.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
      recent.push(now);
      failures.set(key, recent);
      if (failures.size > 500) {
        const oldest = failures.keys().next().value;
        if (oldest) { failures.delete(oldest); lastAlert.delete(oldest); }
      }
      logger.error({ requestId, method: req.method, path, statusCode: res.statusCode, occurrences: recent.length }, "HTTP 5xx response");
      if (!report || recent.length < threshold || now - (lastAlert.get(key) ?? 0) < cooldownMs) return;
      lastAlert.set(key, now);
      void report({ service, requestId, method: req.method, path, statusCode: res.statusCode, occurrences: recent.length, windowMinutes: Math.ceil(windowMs / 60_000) })
        .catch((error: unknown) => logger.error({ err: error, requestId }, "Critical error alert delivery failed"));
    });
    next();
  };
}

export function createBackgroundFailureMonitor({ service, logger, report }: Omit<MonitorOptions, "report"> & { report: NonNullable<MonitorOptions["report"]> }) {
  const failures = new Map<string, number[]>();
  const lastAlert = new Map<string, number>();
  const windowMs = 10 * 60_000;
  return {
    record(worker: string, error: unknown) {
      const now = Date.now();
      const recent = (failures.get(worker) ?? []).filter((timestamp) => now - timestamp < windowMs);
      recent.push(now);
      failures.set(worker, recent);
      logger.error({ worker, occurrences: recent.length, err: error }, "Background process failed");
      const summary = error instanceof Error ? error.message.slice(0, 300) : "Unknown failure";
      if (recent.length < 3 || now - (lastAlert.get(worker) ?? 0) < 10 * 60_000) return;
      lastAlert.set(worker, now);
      void report({ service, requestId: `worker-${Date.now()}`, method: "WORKER", path: `/background/${worker}`, statusCode: 500, occurrences: recent.length, windowMinutes: 10, summary: `${worker} failed repeatedly: ${summary}` })
        .catch((reportError: unknown) => {
          lastAlert.delete(worker);
          logger.error({ worker, err: reportError }, "Background failure alert delivery failed");
        });
    },
    clear(worker: string) { failures.delete(worker); },
  };
}

export function getRequestId(req: Request, res: Response) {
  return String(res.getHeader("x-request-id") ?? req.header("x-request-id") ?? "unknown");
}
