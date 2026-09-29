const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.GATEWAY_SHARED_SECRET = "gateway-test-secret";
process.env.SERVICE_SHARED_SECRET = "service-test-secret";
process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "mis-test";
process.env.DB_USER = "test";
process.env.DB_PASSWORD = "test";

const { authContext } = require("../dist/middlewares/auth-context.middleware.js");
const { authorizeActiveRole } = require("../dist/middlewares/authorize.middleware.js");

function invokeMiddleware(middleware, values, initialAuth) {
  const req = {
    auth: initialAuth,
    header(name) { return values[name.toLowerCase()]; },
  };
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let nextCalled = false;
  middleware(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
}

test("backend rejects missing gateway secret and invalid role context", () => {
  const noSecret = invokeMiddleware(authContext, {
    "x-auth-user-id": "user-123",
    "x-auth-user-roles": "sales",
    "x-auth-active-role": "sales",
  });
  assert.equal(noSecret.res.statusCode, 401);

  const unknownRole = invokeMiddleware(authContext, {
    "x-gateway-secret": "gateway-test-secret",
    "x-auth-user-id": "user-123",
    "x-auth-user-roles": "sales,super_admin",
    "x-auth-active-role": "sales",
  });
  assert.equal(unknownRole.res.statusCode, 403);
});

test("internal API validates active role membership and internal boundary", () => {
  const missingRole = invokeMiddleware(authContext, {
    "x-gateway-secret": "gateway-test-secret",
    "x-auth-user-id": "user-123",
    "x-auth-user-roles": "sales,management",
    "x-auth-active-role": "finance",
  });
  assert.equal(missingRole.res.statusCode, 403);

  const wrongBoundary = invokeMiddleware(authContext, {
    "x-gateway-secret": "gateway-test-secret",
    "x-auth-user-id": "user-123",
    "x-auth-user-roles": "trainer,management",
    "x-auth-active-role": "trainer",
  });
  assert.equal(wrongBoundary.res.statusCode, 403);

  const valid = invokeMiddleware(authContext, {
    "x-gateway-secret": "gateway-test-secret",
    "x-auth-user-id": "user-123",
    "x-auth-user-email": "person@example.test",
    "x-auth-user-roles": "sales,management",
    "x-auth-active-role": "sales",
  });
  assert.equal(valid.nextCalled, true);
  assert.deepEqual(valid.req.auth, {
    userId: "user-123",
    email: "person@example.test",
    roles: ["sales", "management"],
    activeRole: "sales",
  });
});

test("route authorization uses only activeRole, not another role in the context", () => {
  const auth = {
    userId: "user-123",
    roles: ["sales", "management"],
    activeRole: "management",
  };
  const denied = invokeMiddleware(authorizeActiveRole("sales"), {}, auth);
  assert.equal(denied.res.statusCode, 403);
  assert.equal(denied.nextCalled, false);

  const allowed = invokeMiddleware(authorizeActiveRole("management"), {}, auth);
  assert.equal(allowed.nextCalled, true);
});

test("/me returns the validated backend auth context", async (t) => {
  const { app } = require("../dist/app.js");
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/internal/me`, {
    headers: {
      "x-gateway-secret": "gateway-test-secret",
      "x-auth-user-id": "user-123",
      "x-auth-user-email": "person@example.test",
      "x-auth-user-roles": "sales,management",
      "x-auth-active-role": "management",
    },
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.auth.userId, "user-123");
  assert.deepEqual(body.auth.roles, ["sales", "management"]);
  assert.equal(body.auth.activeRole, "management");
});
