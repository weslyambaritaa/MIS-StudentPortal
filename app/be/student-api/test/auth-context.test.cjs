const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.GATEWAY_SHARED_SECRET = "gateway-test-secret";
process.env.SERVICE_SHARED_SECRET = "service-test-secret";
process.env.INTERNAL_API_URL = "http://internal-api:4002";
process.env.DB_HOST = "127.0.0.1";
process.env.DB_NAME = "student-test";
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

test("student API rejects missing gateway secret", () => {
  const result = invokeMiddleware(authContext, {
    "x-auth-user-id": "student-123",
    "x-auth-user-roles": "student",
    "x-auth-active-role": "student",
  });
  assert.equal(result.res.statusCode, 401);
  assert.equal(result.nextCalled, false);
});

test("student API accepts assigned external active role and rejects internal role", () => {
  const allowed = invokeMiddleware(authContext, {
    "x-gateway-secret": "gateway-test-secret",
    "x-auth-user-id": "student-123",
    "x-auth-user-roles": "student,trainer",
    "x-auth-active-role": "trainer",
  });
  assert.equal(allowed.nextCalled, true);
  assert.deepEqual(allowed.req.auth, {
    userId: "student-123",
    email: undefined,
    roles: ["student", "trainer"],
    activeRole: "trainer",
  });

  const denied = invokeMiddleware(authContext, {
    "x-gateway-secret": "gateway-test-secret",
    "x-auth-user-id": "student-123",
    "x-auth-user-roles": "student,sales",
    "x-auth-active-role": "sales",
  });
  assert.equal(denied.res.statusCode, 403);
});

test("student route authorization uses activeRole only", () => {
  const auth = {
    userId: "student-123",
    roles: ["student", "trainer"],
    activeRole: "trainer",
  };
  const denied = invokeMiddleware(authorizeActiveRole("student"), {}, auth);
  assert.equal(denied.res.statusCode, 403);

  const allowed = invokeMiddleware(authorizeActiveRole("trainer"), {}, auth);
  assert.equal(allowed.nextCalled, true);
});

test("/me returns the validated student auth context", async (t) => {
  const { app } = require("../dist/app.js");
  const { StudentProfile } = require("../dist/database/models/student-profile.model.js");
  const originalFindOne = StudentProfile.findOne;
  const originalCreate = StudentProfile.create;
  let created = false;
  StudentProfile.findOne = async () => null;
  StudentProfile.create = async (values) => {
    created = true;
    return { student_id: "student-id-1", ...values };
  };
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    StudentProfile.findOne = originalFindOne;
    StudentProfile.create = originalCreate;
    await new Promise((resolve) => server.close(resolve));
  });

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/external/me`, {
    headers: {
      "x-gateway-secret": "gateway-test-secret",
      "x-auth-user-id": "student-123",
      "x-auth-user-email": "student@example.test",
      "x-auth-user-roles": "student,trainer",
      "x-auth-active-role": "student",
    },
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.auth.userId, "student-123");
  assert.deepEqual(body.auth.roles, ["student", "trainer"]);
  assert.equal(body.auth.activeRole, "student");
  assert.equal(created, true);
});

test("/me does not provision Student identity when activeRole is trainer", async (t) => {
  const { app } = require("../dist/app.js");
  const { StudentProfile } = require("../dist/database/models/student-profile.model.js");
  const originalFindOne = StudentProfile.findOne;
  const originalCreate = StudentProfile.create;
  let identityLookupCalled = false;
  let identityCreateCalled = false;
  StudentProfile.findOne = async () => { identityLookupCalled = true; return null; };
  StudentProfile.create = async () => { identityCreateCalled = true; return {}; };
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    StudentProfile.findOne = originalFindOne;
    StudentProfile.create = originalCreate;
    await new Promise((resolve) => server.close(resolve));
  });

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/external/me`, {
    headers: {
      "x-gateway-secret": "gateway-test-secret",
      "x-auth-user-id": "trainer-123",
      "x-auth-user-roles": "student,trainer",
      "x-auth-active-role": "trainer",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(identityLookupCalled, false);
  assert.equal(identityCreateCalled, false);
});
