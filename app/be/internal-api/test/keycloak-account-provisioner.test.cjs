const assert = require("node:assert/strict");
const test = require("node:test");

const { KeycloakAccountProvisioner, KeycloakProvisioningError } = require("../dist/modules/accounts/keycloak-account-provisioner.js");

function mockResponse(status, body = undefined, headers = undefined) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers });
}

test("MIS provisioning creates a Keycloak account, assigns one known business role, and tags its source", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith("/protocol/openid-connect/token")) return mockResponse(200, { access_token: "service-token" });
    if (String(url).endsWith("/roles/student")) return mockResponse(200, { id: "student-role-id", name: "student" });
    if (String(url).endsWith("/users")) return mockResponse(201, undefined, { location: "http://keycloak/admin/realms/mis-student-portal/users/user-123" });
    if (String(url).endsWith("/users/user-123/role-mappings/realm")) return mockResponse(204);
    throw new Error(`Unexpected Keycloak call: ${url}`);
  };
  const provisioner = new KeycloakAccountProvisioner({ baseUrl: "http://keycloak:8080", realm: "mis-student-portal", clientId: "mis-account-provisioner", clientSecret: "secret" }, fetchImpl);

  const created = await provisioner.createAccount({ username: "student1", email: "student1@example.test", role: "student" });
  assert.deepEqual(created, { userId: "user-123", username: "student1", email: "student1@example.test", role: "student", enabled: true, source: "AUTOMATIC" });
  const createPayload = JSON.parse(calls.find((call) => call.options.method === "POST" && call.url.endsWith("/users")).options.body);
  assert.deepEqual(createPayload.attributes, { mis_account_source: ["AUTOMATIC"] });
  assert.equal(createPayload.enabled, true);
  assert.equal("credentials" in createPayload, false);
  assert.equal(calls.at(-1).options.method, "POST");
});

test("unknown role is rejected before any Keycloak call", async () => {
  let callCount = 0;
  const provisioner = new KeycloakAccountProvisioner({ baseUrl: "http://keycloak:8080", realm: "mis-student-portal", clientId: "client", clientSecret: "secret" }, async () => { callCount++; throw new Error("unexpected"); });
  await assert.rejects(provisioner.createAccount({ username: "bad", role: "master_admin" }), (error) => error instanceof KeycloakProvisioningError && error.statusCode === 400);
  assert.equal(callCount, 0);
});

test("failed Keycloak role assignment compensates by deleting the newly created account", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith("/protocol/openid-connect/token")) return mockResponse(200, { access_token: "service-token" });
    if (String(url).endsWith("/roles/trainer")) return mockResponse(200, { id: "trainer-role", name: "trainer" });
    if (String(url).endsWith("/users")) return mockResponse(201, undefined, { location: "http://keycloak/admin/realms/mis-student-portal/users/user-456" });
    if (String(url).endsWith("/role-mappings/realm")) return mockResponse(500);
    if (String(url).endsWith("/users/user-456")) return mockResponse(204);
    throw new Error(`Unexpected Keycloak call: ${url}`);
  };
  const provisioner = new KeycloakAccountProvisioner({ baseUrl: "http://keycloak:8080", realm: "mis-student-portal", clientId: "client", clientSecret: "secret" }, fetchImpl);
  await assert.rejects(provisioner.createAccount({ username: "trainer1", role: "trainer" }), KeycloakProvisioningError);
  assert.equal(calls.at(-1).options.method, "DELETE");
});

test("missing server-side service secret fails closed", async () => {
  let callCount = 0;
  const provisioner = new KeycloakAccountProvisioner({ baseUrl: "http://keycloak:8080", realm: "mis-student-portal", clientId: "client" }, async () => { callCount++; throw new Error("unexpected"); });
  await assert.rejects(provisioner.createAccount({ username: "student", role: "student" }), (error) => error instanceof KeycloakProvisioningError && error.statusCode === 503);
  assert.equal(callCount, 0);
});

test("domain Student directory is sourced from enabled Keycloak Student-role members", async () => {
  const fetchImpl = async (url) => {
    const parsed = new URL(String(url));
    if (parsed.pathname.endsWith("/protocol/openid-connect/token")) return mockResponse(200, { access_token: "service-token" });
    if (parsed.pathname.endsWith("/roles/student/users")) return mockResponse(200, [
      { id: "student-enabled", username: "student-one", firstName: "Student", lastName: "One", email: "one@example.test", enabled: true },
      { id: "student-disabled", username: "student-two", enabled: false },
    ]);
    throw new Error(`Unexpected Keycloak call: ${url}`);
  };
  const provisioner = new KeycloakAccountProvisioner({ baseUrl: "http://keycloak:8080", realm: "mis-student-portal", clientId: "client", clientSecret: "secret" }, fetchImpl);
  assert.deepEqual(await provisioner.listRoleMembers("student"), [{ userId: "student-enabled", username: "student-one", firstName: "Student", lastName: "One", email: "one@example.test", enabled: true }]);
  assert.equal((await provisioner.listRoleMembers("student", true)).length, 2);
});

test("bulk email lookup normalizes addresses and detects existing exact Keycloak emails", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    const parsed = new URL(String(url));
    calls.push(parsed);
    if (parsed.pathname.endsWith("/protocol/openid-connect/token")) return mockResponse(200, { access_token: "service-token" });
    if (parsed.pathname.endsWith("/users")) {
      const email = parsed.searchParams.get("email");
      assert.equal(parsed.searchParams.get("exact"), "true");
      return mockResponse(200, email === "used@example.test" ? [{ id: "existing", email: "Used@Example.Test" }] : []);
    }
    throw new Error(`Unexpected Keycloak call: ${url}`);
  };
  const provisioner = new KeycloakAccountProvisioner({ baseUrl: "http://keycloak:8080", realm: "mis-student-portal", clientId: "client", clientSecret: "secret" }, fetchImpl);

  const result = await provisioner.findUsersByEmails([" USED@example.test ", "used@example.test", "new@example.test", ""]);
  assert.deepEqual([...result], ["used@example.test"]);
  assert.equal(calls.filter((url) => url.pathname.endsWith("/protocol/openid-connect/token")).length, 1);
  assert.equal(calls.filter((url) => url.pathname.endsWith("/users")).length, 2);
});

test("PIC activation uses a Keycloak required-action email with the requested one-day lifetime", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith("/protocol/openid-connect/token")) return mockResponse(200, { access_token: "service-token" });
    if (String(url).endsWith("/users/pic-123")) return mockResponse(200, { id: "pic-123", username: "pic@example.test", email: "pic@example.test", enabled: true, requiredActions: [] });
    if (String(url).includes("/execute-actions-email?lifespan=86400")) return mockResponse(204);
    throw new Error(`Unexpected Keycloak call: ${url}`);
  };
  const provisioner = new KeycloakAccountProvisioner({ baseUrl: "http://keycloak:8080", realm: "mis-student-portal", clientId: "client", clientSecret: "secret" }, fetchImpl);
  await provisioner.setRequiredActions("pic-123", ["UPDATE_PASSWORD"]);
  await provisioner.sendRequiredActionsEmail("pic-123", ["UPDATE_PASSWORD"], 86400, "mis-student-portal-frontend", "http://localhost:3000/dashboard");
  const userUpdate = calls.find((call) => call.options.method === "PUT" && call.url.endsWith("/users/pic-123"));
  assert.deepEqual(JSON.parse(userUpdate.options.body).requiredActions, ["UPDATE_PASSWORD"]);
  const emailRequest = calls.find((call) => call.url.includes("execute-actions-email"));
  assert.equal(emailRequest.options.method, "PUT");
  assert.equal(JSON.parse(emailRequest.options.body)[0], "UPDATE_PASSWORD");
  const emailUrl = new URL(emailRequest.url);
  assert.equal(emailUrl.searchParams.get("client_id"), "mis-student-portal-frontend");
  assert.equal(emailUrl.searchParams.get("redirect_uri"), "http://localhost:3000/dashboard");
});

test("PIC status reconciliation can inspect remaining Keycloak required actions", async () => {
  const fetchImpl = async (url) => {
    if (String(url).endsWith("/protocol/openid-connect/token")) return mockResponse(200, { access_token: "service-token" });
    if (String(url).endsWith("/users/pic-123")) return mockResponse(200, { id: "pic-123", username: "pic@example.test", enabled: true, requiredActions: ["UPDATE_PASSWORD"] });
    throw new Error(`Unexpected Keycloak call: ${url}`);
  };
  const provisioner = new KeycloakAccountProvisioner({ baseUrl: "http://keycloak:8080", realm: "mis-student-portal", clientId: "client", clientSecret: "secret" }, fetchImpl);
  const user = await provisioner.getIdentity("pic-123");
  assert.deepEqual(user.requiredActions, ["UPDATE_PASSWORD"]);
});

test("account listing filters by a canonical business role and enabled status, with source and business roles", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(String(url));
    calls.push({ url: parsed, options });
    if (parsed.pathname.endsWith("/protocol/openid-connect/token")) return mockResponse(200, { access_token: "service-token" });
    if (parsed.pathname.endsWith("/roles/sales/users")) return mockResponse(200, [
      { id: "sales-1", username: "sales-one", enabled: true, attributes: { mis_account_source: ["AUTOMATIC"] } },
      { id: "sales-2", username: "sales-two", enabled: false, attributes: { mis_account_source: ["MANUAL"] } },
    ]);
    if (parsed.pathname.endsWith("/users/sales-1/role-mappings/realm/composite")) return mockResponse(200, [{ name: "sales" }, { name: "management" }, { name: "mis-user-provisioner" }]);
    throw new Error(`Unexpected Keycloak call: ${url}`);
  };
  const provisioner = new KeycloakAccountProvisioner({ baseUrl: "http://keycloak:8080", realm: "mis-student-portal", clientId: "client", clientSecret: "secret" }, fetchImpl);

  const result = await provisioner.listAccounts({ role: "sales", status: "enabled", page: 1, pageSize: 10 });
  assert.deepEqual(result, {
    accounts: [{ userId: "sales-1", username: "sales-one", enabled: true, roles: ["sales", "management"], source: "AUTOMATIC" }],
    page: 1,
    pageSize: 10,
    total: 1,
    totalPages: 1,
  });
  assert.ok(calls.some(({ url }) => url.pathname.endsWith("/roles/sales/users")));
  assert.equal(result.accounts[0].roles.includes("mis-user-provisioner"), false);
});

test("account listing filters status at Keycloak, paginates, and reports unknown provenance explicitly", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    const parsed = new URL(String(url));
    calls.push(parsed);
    if (parsed.pathname.endsWith("/protocol/openid-connect/token")) return mockResponse(200, { access_token: "service-token" });
    if (parsed.pathname.endsWith("/users") && parsed.searchParams.get("first") === "0") {
      assert.equal(parsed.searchParams.get("enabled"), "false");
      return mockResponse(200, [{ id: "disabled-1", username: "disabled-user", enabled: false }]);
    }
    if (parsed.pathname.endsWith("/users") && parsed.pathname.includes("/users/") === false) return mockResponse(200, []);
    if (parsed.pathname.endsWith("/users/disabled-1/role-mappings/realm/composite")) return mockResponse(200, [{ name: "trainer" }, { name: "unknown-role" }]);
    throw new Error(`Unexpected Keycloak call: ${url}`);
  };
  const provisioner = new KeycloakAccountProvisioner({ baseUrl: "http://keycloak:8080", realm: "mis-student-portal", clientId: "client", clientSecret: "secret" }, fetchImpl);

  const result = await provisioner.listAccounts({ status: "disabled", page: 1, pageSize: 10 });
  assert.equal(result.total, 1);
  assert.equal(result.accounts[0].source, "UNKNOWN");
  assert.deepEqual(result.accounts[0].roles, ["trainer"]);
  assert.ok(calls.every((url) => !url.pathname.endsWith("/users/disabled-1/credentials")));
});

test("Keycloak account deletion is idempotent when the identity is already absent", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith("/protocol/openid-connect/token")) return mockResponse(200, { access_token: "service-token" });
    if (String(url).endsWith("/users/pic-user-1")) return mockResponse(404);
    throw new Error(`Unexpected Keycloak call: ${url}`);
  };
  const provisioner = new KeycloakAccountProvisioner({ baseUrl: "http://keycloak:8080", realm: "mis-student-portal", clientId: "client", clientSecret: "secret" }, fetchImpl);

  await assert.doesNotReject(provisioner.deleteAccount("pic-user-1"));
  assert.equal(calls.at(-1).options.method, "DELETE");
  assert.ok(calls.at(-1).url.endsWith("/users/pic-user-1"));
});

test("Keycloak business-role lookup excludes infrastructure roles", async () => {
  const fetchImpl = async (url) => {
    if (String(url).endsWith("/protocol/openid-connect/token")) return mockResponse(200, { access_token: "service-token" });
    if (String(url).endsWith("/users/user-1/role-mappings/realm/composite")) {
      return mockResponse(200, [{ name: "pic" }, { name: "realm-admin" }, { name: "student" }]);
    }
    throw new Error(`Unexpected Keycloak call: ${url}`);
  };
  const provisioner = new KeycloakAccountProvisioner({ baseUrl: "http://keycloak:8080", realm: "mis-student-portal", clientId: "client", clientSecret: "secret" }, fetchImpl);

  assert.deepEqual(await provisioner.getBusinessRoles("user-1"), ["student", "pic"]);
});
