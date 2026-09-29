const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.DB_HOST ??= "127.0.0.1";
process.env.DB_NAME ??= "student-test";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";
process.env.GATEWAY_SHARED_SECRET ??= "gateway-test-secret";
process.env.INTERNAL_API_URL = "http://internal-api:4002";
process.env.SERVICE_SHARED_SECRET = "service-test-secret";

const {
  requestInternalApi,
  InternalApiResponseError,
  InternalApiUnavailableError,
} = require("../dist/integrations/internal-api/internal-api.client.js");

const actor = {
  userId: "kc-trainer-1",
  email: "not-forwarded@example.test",
  roles: ["trainer", "management"],
  activeRole: "trainer",
};

test("Internal API client constructs trusted headers from auth context, not incoming spoofed headers", async () => {
  let requestedUrl;
  let requestInit;
  const result = await requestInternalApi("/api/v1/internal-service/next", actor, {
    fetchImpl: async (url, init) => {
      requestedUrl = url;
      requestInit = init;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
    headers: new Headers({
      "x-actor-user-id": "attacker",
      "x-actor-active-role": "management",
      "x-service-secret": "attacker-secret",
    }),
  });

  assert.equal(requestedUrl.href, "http://internal-api:4002/api/v1/internal-service/next");
  assert.equal(requestInit.headers.get("x-service-secret"), "service-test-secret");
  assert.equal(requestInit.headers.get("x-actor-user-id"), "kc-trainer-1");
  assert.equal(requestInit.headers.get("x-actor-roles"), "trainer,management");
  assert.equal(requestInit.headers.get("x-actor-active-role"), "trainer");
  assert.equal(requestInit.headers.get("x-actor-user-id"), "kc-trainer-1");
  assert.equal(requestInit.headers.get("x-actor-user-email"), null);
  assert.equal(result.ok, true);
});

test("Internal API client rejects non-service paths", async () => {
  await assert.rejects(requestInternalApi("//attacker.example", actor), TypeError);
  await assert.rejects(requestInternalApi("/api/v1/internal/me", actor), TypeError);
});

test("Internal API timeout becomes a clear unavailable error", async () => {
  await assert.rejects(
    requestInternalApi("/api/v1/internal-service/slow", actor, {
      timeoutMs: 10,
      fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }),
    }),
    (error) => error instanceof InternalApiUnavailableError && /timed out/.test(error.message),
  );
});

test("Internal API network failure becomes a clear unavailable error", async () => {
  await assert.rejects(
    requestInternalApi("/api/v1/internal-service/unavailable", actor, {
      fetchImpl: async () => { throw new TypeError("network down"); },
    }),
    InternalApiUnavailableError,
  );
});

test("Internal API domain errors retain status without leaking response details", async () => {
  await assert.rejects(
    requestInternalApi("/api/v1/internal-service/denied", actor, {
      fetchImpl: async () => new Response(JSON.stringify({ message: "private internal detail" }), { status: 403 }),
    }),
    (error) => error instanceof InternalApiResponseError && error.status === 403 && !error.message.includes("private internal detail"),
  );
});

test("Internal API errors map to safe upstream responses", () => {
  const { internalApiError } = require("../dist/middlewares/internal-api-error.middleware.js");
  const invoke = (error) => {
    const res = {
      statusCode: 200,
      body: undefined,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    let forwarded;
    internalApiError(error, {}, res, (nextError) => { forwarded = nextError; });
    return { res, forwarded };
  };

  const unavailable = invoke(new InternalApiUnavailableError("Internal API request timed out"));
  assert.equal(unavailable.res.statusCode, 503);
  assert.deepEqual(unavailable.res.body, { message: "Internal API request timed out" });

  const domainError = invoke(new InternalApiResponseError(403));
  assert.equal(domainError.res.statusCode, 403);
  assert.deepEqual(domainError.res.body, { message: "Internal service request failed" });

  const unexpected = new Error("unexpected");
  assert.equal(invoke(unexpected).forwarded, unexpected);
});
