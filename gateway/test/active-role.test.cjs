const assert = require("node:assert/strict");
const test = require("node:test");
const { createServer } = require("node:http");
const { exportJWK, generateKeyPair, SignJWT } = require("jose");
const {
  isRoleWithinBoundary,
  overwriteTrustedAuthHeaders,
  validateActiveRole,
} = require("../dist/auth/active-role.js");

let authenticate;
let keycloakServer;
let privateKey;
let issuer;
const audience = "mis-frontend-test";

test.before(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const publicJwk = await exportJWK(pair.publicKey);
  publicJwk.kid = "mis-test-key";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";

  keycloakServer = createServer((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ keys: [publicJwk] }));
  });
  await new Promise((resolve) => keycloakServer.listen(0, "127.0.0.1", resolve));
  const { port } = keycloakServer.address();

  issuer = `http://127.0.0.1:${port}/realms/mis-test`;
  process.env.STUDENT_API_URL = "http://127.0.0.1:4001";
  process.env.INTERNAL_API_URL = "http://127.0.0.1:4002";
  process.env.KEYCLOAK_INTERNAL_URL = `http://127.0.0.1:${port}`;
  process.env.KEYCLOAK_PUBLIC_HOST = `127.0.0.1:${port}`;
  process.env.KEYCLOAK_ISSUER = issuer;
  process.env.KEYCLOAK_JWKS_INTERNAL_URL = `${issuer}/protocol/openid-connect/certs`;
  process.env.KEYCLOAK_AUDIENCE = audience;
  process.env.GATEWAY_SHARED_SECRET = "gateway-test-secret";

  ({ authenticate } = require("../dist/middlewares/authenticate.middleware.js"));
});

test.after(async () => {
  if (keycloakServer?.listening) {
    await new Promise((resolve, reject) => keycloakServer.close((error) => error ? reject(error) : resolve()));
  }
});

async function makeToken(roles, subject = "user-123") {
  return new SignJWT({
    email: "person@example.test",
    realm_access: { roles },
  })
    .setProtectedHeader({ alg: "RS256", kid: "mis-test-key" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setExpirationTime("2m")
    .sign(privateKey);
}

function makeRequest(token, activeRole, extraHeaders = {}) {
  const headers = {
    authorization: token ? `Bearer ${token}` : undefined,
    "x-active-role": activeRole,
    ...extraHeaders,
  };
  const req = {
    headers: { ...headers },
    header(name) {
      return headers[name.toLowerCase()];
    },
  };
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  return { req, res };
}

async function runAuthenticate(token, activeRole, extraHeaders) {
  const { req, res } = makeRequest(token, activeRole, extraHeaders);
  let nextCalled = false;
  await authenticate(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
}

test("JWT role ordering is preserved as claims; only business roles are forwarded", () => {
  assert.equal(validateActiveRole(["management", "sales"], "sales"), "sales");
  assert.equal(validateActiveRole(["management", "sales"], "finance"), null);
  assert.equal(validateActiveRole(["management", "sales"], "super_admin"), null);
  assert.equal(validateActiveRole(["sales"], undefined), null);
});

test("boundary follows active role rather than another role in the token", () => {
  assert.equal(isRoleWithinBoundary("trainer", ["sales", "admin", "finance", "management"]), false);
  assert.equal(isRoleWithinBoundary("management", ["sales", "admin", "finance", "management"]), true);
  assert.equal(isRoleWithinBoundary("sales", ["student", "pic", "trainer"]), false);
});

test("Gateway validates JWT, active role membership, and overwrites spoofed auth headers", async () => {
  const token = await makeToken(["management", "sales", "offline_access"]);
  const result = await runAuthenticate(token, "sales", {
    "x-auth-user-id": "attacker",
    "x-auth-user-email": "spoof@example.test",
    "x-auth-user-roles": "finance",
    "x-auth-active-role": "management",
    "x-gateway-secret": "spoofed-secret",
  });

  assert.equal(result.nextCalled, true);
  assert.equal(result.req.auth.payload.sub, "user-123");
  assert.deepEqual(result.req.auth.roles, ["management", "sales"]);
  assert.equal(result.req.auth.activeRole, "sales");
  assert.equal(result.req.headers["x-auth-user-id"], "user-123");
  assert.equal(result.req.headers["x-auth-user-email"], "person@example.test");
  assert.equal(result.req.headers["x-auth-user-roles"], "management,sales");
  assert.equal(result.req.headers["x-auth-active-role"], "sales");
  assert.equal(result.req.headers["x-gateway-secret"], "gateway-test-secret");
  assert.equal(result.req.headers["x-active-role"], undefined);
});

test("Gateway rejects missing, unknown, and unassigned active roles", async () => {
  const token = await makeToken(["sales", "management"]);

  for (const activeRole of [undefined, "unknown", "finance"]) {
    const result = await runAuthenticate(token, activeRole);
    assert.equal(result.res.statusCode, 403, `active role ${String(activeRole)} should be denied`);
    assert.equal(result.nextCalled, false);
  }
});

test("Gateway rejects an invalid JWT", async () => {
  const result = await runAuthenticate("not-a-jwt", "sales");
  assert.equal(result.res.statusCode, 401);
  assert.equal(result.nextCalled, false);
});
