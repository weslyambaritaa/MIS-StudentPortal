const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.DB_HOST ??= "127.0.0.1";
process.env.DB_NAME ??= "mis-test";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";
process.env.GATEWAY_SHARED_SECRET = "gateway-test-secret";
process.env.SERVICE_SHARED_SECRET = "service-test-secret";

const { serviceAuth } = require("../dist/middlewares/service-auth.middleware.js");

function invoke(values) {
  const req = { auth: undefined, header(name) { return values[name.toLowerCase()]; } };
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let nextCalled = false;
  serviceAuth(req, res, () => { nextCalled = true; });
  return { req, res, nextCalled };
}

test("service auth rejects missing, empty, and incorrect service credentials", () => {
  for (const secret of [undefined, "", "wrong-secret"]) {
    const values = {
      "x-actor-user-id": "kc-trainer-1",
      "x-actor-roles": "trainer",
      "x-actor-active-role": "trainer",
    };
    if (secret !== undefined) values["x-service-secret"] = secret;
    const result = invoke(values);
    assert.equal(result.res.statusCode, 401);
    assert.equal(result.nextCalled, false);
    assert.deepEqual(result.res.body, { message: "Invalid service credentials" });
  }
});

test("service auth rejects missing user ID, empty/unknown roles, and invalid active role", () => {
  const valid = {
    "x-service-secret": "service-test-secret",
    "x-actor-user-id": "kc-user-1",
    "x-actor-roles": "trainer",
    "x-actor-active-role": "trainer",
  };
  const invalidContexts = [
    { ...valid, "x-actor-user-id": undefined },
    { ...valid, "x-actor-user-id": " " },
    { ...valid, "x-actor-roles": undefined },
    { ...valid, "x-actor-roles": "" },
    { ...valid, "x-actor-roles": "trainer,unknown" },
    { ...valid, "x-actor-roles": "trainer," },
    { ...valid, "x-actor-roles": "trainer,trainer" },
    { ...valid, "x-actor-active-role": "unknown" },
    { ...valid, "x-actor-active-role": "pic" },
  ];

  for (const values of invalidContexts) {
    const result = invoke(values);
    assert.equal(result.res.statusCode, 403);
    assert.equal(result.nextCalled, false);
    assert.deepEqual(result.res.body, { message: "Invalid service actor context" });
  }
});

test("service auth trusts valid Trainer and PIC actors with consistent req.auth", () => {
  for (const role of ["trainer", "pic"]) {
    const result = invoke({
      "x-service-secret": "service-test-secret",
      "x-actor-user-id": `kc-${role}-1`,
      "x-actor-roles": `${role},student`,
      "x-actor-active-role": role,
    });
    assert.equal(result.nextCalled, true);
    assert.deepEqual(result.req.auth, {
      userId: `kc-${role}-1`,
      roles: [role, "student"],
      activeRole: role,
    });
  }
});

test("service-only namespace is protected and has no fake business handler", async (t) => {
  const { app } = require("../dist/app.js");
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const path = `http://127.0.0.1:${port}/api/v1/internal-service/test-only-check`;

  const denied = await fetch(path);
  assert.equal(denied.status, 401);

  const valid = await fetch(path, {
    headers: {
      "x-service-secret": "service-test-secret",
      "x-actor-user-id": "kc-trainer-1",
      "x-actor-roles": "trainer",
      "x-actor-active-role": "trainer",
    },
  });
  assert.equal(valid.status, 404);
});

test("public Internal API continues rejecting direct Trainer and PIC roles", () => {
  const { authContext } = require("../dist/middlewares/auth-context.middleware.js");
  for (const role of ["trainer", "pic"]) {
    const req = {
      header(name) {
        return {
          "x-gateway-secret": "gateway-test-secret",
          "x-auth-user-id": `kc-${role}-1`,
          "x-auth-user-roles": role,
          "x-auth-active-role": role,
        }[name.toLowerCase()];
      },
    };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json() { return this; },
    };
    let nextCalled = false;
    authContext(req, res, () => { nextCalled = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
  }
});
