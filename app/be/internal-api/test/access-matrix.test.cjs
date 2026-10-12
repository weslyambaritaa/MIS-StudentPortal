const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.DB_HOST ??= "127.0.0.1";
process.env.DB_NAME ??= "mis-test";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";
process.env.GATEWAY_SHARED_SECRET ??= "gateway-test-secret";
process.env.SERVICE_SHARED_SECRET ??= "service-test-secret";

const { ACCESS_ACTIONS } = require("@mis/shared-types");
const { RoleAccessMatrix } = require("../dist/database/models/role-access-matrix.model.js");
const { authorizeCapability } = require("../dist/middlewares/authorize-capability.middleware.js");
const { canRoleAccess } = require("../dist/modules/authorization/role-access-matrix.service.js");

function invoke(middleware, auth, body = {}) {
  const req = { auth, body, query: {}, headers: { "x-active-role": "sales" } };
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  let nextCalled = false;
  let nextError;
  const result = middleware(req, res, (error) => {
    if (error) nextError = error;
    else nextCalled = true;
  });
  return Promise.resolve(result).then(() => ({ req, res, nextCalled, nextError }));
}

async function withMatrixLookup(lookup, action) {
  const original = RoleAccessMatrix.findOne;
  RoleAccessMatrix.findOne = lookup;
  try {
    return await action();
  } finally {
    RoleAccessMatrix.findOne = original;
  }
}

test("known role/resource/action is allowed only when its stored matrix bit is true", async () => {
  await withMatrixLookup(async (options) => {
    assert.deepEqual(options.where, { role: "sales", resource_group: "ACCOUNT" });
    assert.deepEqual(options.attributes, ["can_view"]);
    return { can_view: true };
  }, async () => {
    assert.equal(await canRoleAccess("sales", "ACCOUNT", ACCESS_ACTIONS.VIEW), true);
  });
});

test("a false action and a missing matrix row are denied", async () => {
  await withMatrixLookup(async () => ({ can_delete: false }), async () => {
    assert.equal(await canRoleAccess("sales", "ACCOUNT", ACCESS_ACTIONS.DELETE), false);
  });
  await withMatrixLookup(async () => null, async () => {
    assert.equal(await canRoleAccess("finance", "ACCOUNT", ACCESS_ACTIONS.VIEW), false);
  });
});

test("unknown roles, resources, and actions deny without querying the matrix", async () => {
  await withMatrixLookup(async () => { throw new Error("must not query for invalid vocabulary"); }, async () => {
    assert.equal(await canRoleAccess("master_admin", "ACCOUNT", "VIEW"), false);
    assert.equal(await canRoleAccess("sales", "UNKNOWN_RESOURCE", "VIEW"), false);
    assert.equal(await canRoleAccess("sales", "ACCOUNT", "EXPORT"), false);
  });
});

test("middleware uses req.auth.activeRole, not another JWT role or client-selected role", async () => {
  await withMatrixLookup(async (options) => {
    assert.deepEqual(options.where, { role: "trainer", resource_group: "ACCOUNT" });
    return { can_view: false };
  }, async () => {
    const result = await invoke(
      authorizeCapability("ACCOUNT", ACCESS_ACTIONS.VIEW),
      { userId: "user-1", roles: ["sales", "trainer"], activeRole: "trainer" },
      { role: "sales" },
    );
    assert.equal(result.res.statusCode, 403);
    assert.equal(result.nextCalled, false);
  });
});

test("middleware denies missing auth and matrix lookup failures never allow", async () => {
  const noAuth = await invoke(authorizeCapability("ACCOUNT", ACCESS_ACTIONS.VIEW), undefined);
  assert.equal(noAuth.res.statusCode, 403);
  assert.equal(noAuth.nextCalled, false);

  const failure = new Error("database unavailable");
  await withMatrixLookup(async () => { throw failure; }, async () => {
    const result = await invoke(
      authorizeCapability("ACCOUNT", ACCESS_ACTIONS.VIEW),
      { userId: "user-1", roles: ["sales"], activeRole: "sales" },
    );
    assert.equal(result.nextCalled, false);
    assert.equal(result.nextError, failure);
  });
});

test("role access model has the pair uniqueness key and deny-by-default action columns", () => {
  assert.ok(RoleAccessMatrix.options.indexes.some((index) =>
    index.unique && index.fields.join(",") === "role,resource_group"));
  for (const name of ["can_view", "can_create", "can_edit", "can_delete"]) {
    assert.equal(RoleAccessMatrix.rawAttributes[name].allowNull, false);
    assert.equal(RoleAccessMatrix.rawAttributes[name].defaultValue, false);
  }
  assert.equal(RoleAccessMatrix.rawAttributes.role.references, undefined);
});
