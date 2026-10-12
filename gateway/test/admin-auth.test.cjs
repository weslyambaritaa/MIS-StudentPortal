const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.STUDENT_API_URL ??= "http://student-api:4001";
process.env.INTERNAL_API_URL ??= "http://internal-api:4002";
process.env.KEYCLOAK_INTERNAL_URL ??= "http://keycloak:8080";
process.env.KEYCLOAK_PUBLIC_HOST ??= "auth.localhost:4000";
process.env.KEYCLOAK_ISSUER ??= "http://auth.localhost:4000/realms/mis-student-portal";
process.env.KEYCLOAK_JWKS_INTERNAL_URL ??= "http://keycloak:8080/realms/mis-student-portal/protocol/openid-connect/certs";
process.env.KEYCLOAK_AUDIENCE ??= "mis-student-portal-frontend";
process.env.GATEWAY_SHARED_SECRET ??= "gateway-test-secret";

const { getUserProvisionerRole, overwriteTrustedAdminHeaders } = require("../dist/middlewares/authenticate-user-provisioner.middleware.js");

test("MIS account provisioning authority is separate from business roles", () => {
  assert.equal(getUserProvisionerRole(["sales", "management"]), null);
  assert.equal(getUserProvisionerRole(["mis-access-admin"]), null);
  assert.equal(getUserProvisionerRole(["mis-user-provisioner"]), "mis-user-provisioner");
  assert.equal(getUserProvisionerRole(["sales", "mis-user-provisioner"]), "mis-user-provisioner");
});

test("Gateway overwrites all client-provided business/admin context on provisioning requests", () => {
  const headers = {
    "x-active-role": "sales",
    "x-auth-user-id": "forged-user",
    "x-auth-user-roles": "admin",
    "x-auth-active-role": "admin",
    "x-auth-admin-user-id": "forged-admin",
    "x-auth-admin-role": "mis-user-provisioner",
    "x-gateway-secret": "forged-secret",
  };
  overwriteTrustedAdminHeaders(headers, "verified-subject", "mis-user-provisioner", "gateway-secret");
  assert.deepEqual(headers, {
    "x-auth-admin-user-id": "verified-subject",
    "x-auth-admin-role": "mis-user-provisioner",
    "x-gateway-secret": "gateway-secret",
  });
});
