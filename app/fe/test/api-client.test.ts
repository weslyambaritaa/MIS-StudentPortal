import assert from "node:assert/strict";
import test from "node:test";

import { apiRequest } from "../src/lib/api/client";

test("validation feedback omits technical reference IDs", async () => {
  const originalFetch = globalThis.fetch;
  const message = "Upload at least one RF Attachment before submitting to Admin (QPD)";
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { code: "VALIDATION_ERROR", message, requestId: "52a39c36-fb7f-4164-9a50-378da912930d" },
  }), { status: 400 });
  try {
    await assert.rejects(apiRequest("/test", "test-token", "sales"), { message });
  } finally { globalThis.fetch = originalFetch; }
});

test("non-JSON service errors show a plain-language message", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("Bad Gateway", { status: 502 });
  try {
    await assert.rejects(apiRequest("/test", "test-token", "sales"), {
      message: "We couldn't complete your request. Please try again.",
    });
  } finally { globalThis.fetch = originalFetch; }
});

test("central API client sends bearer token and active role headers", async () => {
  const originalFetch = globalThis.fetch;
  let requestHeaders: Headers | undefined;

  globalThis.fetch = async (_input, init) => {
    requestHeaders = new Headers(init?.headers);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await apiRequest("/api/v1/internal/me", "test-token", "sales");
    assert.equal(requestHeaders?.get("Authorization"), "Bearer test-token");
    assert.equal(requestHeaders?.get("X-Active-Role"), "sales");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("central API client accepts successful 204 responses without a JSON body", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 204 });

  try {
    const result = await apiRequest<void>(
      "/api/v1/internal/industries/test-id",
      "test-token",
      "sales",
      { method: "DELETE" },
    );
    assert.equal(result, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("central API client surfaces server validation messages for Account feedback", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ message: "Choose an active Industry" }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
  try {
    await assert.rejects(
      apiRequest("/api/v1/internal/accounts", "test-token", "sales", { method: "POST", body: "{}" }),
      { message: "Choose an active Industry" },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
