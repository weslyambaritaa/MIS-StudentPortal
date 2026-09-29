import assert from "node:assert/strict";
import test from "node:test";

import { apiRequest } from "../src/lib/api/client";

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
