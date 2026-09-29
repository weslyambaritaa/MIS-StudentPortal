const assert = require("node:assert/strict");
const test = require("node:test");
const { UniqueConstraintError } = require("sequelize");

process.env.NODE_ENV = "test";
process.env.DB_HOST ??= "127.0.0.1";
process.env.DB_NAME ??= "student-test";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";
process.env.GATEWAY_SHARED_SECRET ??= "gateway-test-secret";
process.env.SERVICE_SHARED_SECRET ??= "service-test-secret";
process.env.INTERNAL_API_URL ??= "http://internal-api:4002";

const { StudentProfile } = require("../dist/database/models/student-profile.model.js");
const {
  ensureStudentIdentity,
  findStudentIdentity,
  InvalidStudentIdentityContextError,
} = require("../dist/modules/students/student-identity.js");

const studentAuth = (overrides = {}) => ({
  userId: "kc-student-123",
  roles: ["student"],
  activeRole: "student",
  ...overrides,
});

test("Student identity lookup uses only the Keycloak subject", async () => {
  const originalFindOne = StudentProfile.findOne;
  let queryOptions;
  StudentProfile.findOne = async (options) => { queryOptions = options; return null; };

  try {
    await findStudentIdentity("kc-student-123");
  } finally {
    StudentProfile.findOne = originalFindOne;
  }

  assert.deepEqual(queryOptions.attributes, ["student_id", "keycloak_subject"]);
  assert.deepEqual(queryOptions.where, { keycloak_subject: "kc-student-123" });
});

test("existing StudentProfile is reused without creating another row", async () => {
  const originalFindOne = StudentProfile.findOne;
  const originalCreate = StudentProfile.create;
  const profile = { student_id: "student-id-1", keycloak_subject: "kc-student-123" };
  StudentProfile.findOne = async () => profile;
  StudentProfile.create = async () => { throw new Error("existing identity must not be recreated"); };

  try {
    assert.equal(await ensureStudentIdentity(studentAuth()), profile);
  } finally {
    StudentProfile.findOne = originalFindOne;
    StudentProfile.create = originalCreate;
  }
});

test("missing StudentProfile is lazily created only for activeRole student", async () => {
  const originalFindOne = StudentProfile.findOne;
  const originalCreate = StudentProfile.create;
  const profile = { student_id: "student-id-new", keycloak_subject: "kc-student-123" };
  let findCalls = 0;
  let createValues;
  StudentProfile.findOne = async () => (++findCalls === 1 ? null : profile);
  StudentProfile.create = async (values) => { createValues = values; return profile; };

  try {
    assert.equal(await ensureStudentIdentity(studentAuth()), profile);
    assert.deepEqual(createValues, { keycloak_subject: "kc-student-123" });
    assert.equal(findCalls, 1);
  } finally {
    StudentProfile.findOne = originalFindOne;
    StudentProfile.create = originalCreate;
  }
});

test("second Student request reuses the identity created by the first request", async () => {
  const originalFindOne = StudentProfile.findOne;
  const originalCreate = StudentProfile.create;
  const profile = { student_id: "student-id-new", keycloak_subject: "kc-student-123" };
  let exists = false;
  let createCalls = 0;
  StudentProfile.findOne = async () => (exists ? profile : null);
  StudentProfile.create = async () => { createCalls += 1; exists = true; return profile; };

  try {
    assert.equal(await ensureStudentIdentity(studentAuth()), profile);
    assert.equal(await ensureStudentIdentity(studentAuth()), profile);
    assert.equal(createCalls, 1);
  } finally {
    StudentProfile.findOne = originalFindOne;
    StudentProfile.create = originalCreate;
  }
});

test("concurrent first Student requests recover from unique-subject conflict", async () => {
  const originalFindOne = StudentProfile.findOne;
  const originalCreate = StudentProfile.create;
  const profile = { student_id: "student-id-race", keycloak_subject: "kc-student-123" };
  let findCalls = 0;
  let createCalls = 0;
  StudentProfile.findOne = async () => (++findCalls <= 2 ? null : profile);
  StudentProfile.create = async () => {
    createCalls += 1;
    if (createCalls === 1) return profile;
    throw new UniqueConstraintError({ fields: { keycloak_subject: "kc-student-123" } });
  };

  try {
    const identities = await Promise.all([
      ensureStudentIdentity(studentAuth()),
      ensureStudentIdentity(studentAuth()),
    ]);
    assert.equal(createCalls, 2);
    assert.deepEqual(identities, [profile, profile]);
  } finally {
    StudentProfile.findOne = originalFindOne;
    StudentProfile.create = originalCreate;
  }
});

test("non-Student active roles cannot create Student identity even if student is also assigned", async () => {
  const originalFindOne = StudentProfile.findOne;
  const originalCreate = StudentProfile.create;
  let findCalls = 0;
  let createCalls = 0;
  StudentProfile.findOne = async () => { findCalls += 1; return null; };
  StudentProfile.create = async () => { createCalls += 1; return {}; };

  try {
    await assert.rejects(
      ensureStudentIdentity(studentAuth({ roles: ["student", "trainer"], activeRole: "trainer" })),
      InvalidStudentIdentityContextError,
    );
    await assert.rejects(
      ensureStudentIdentity(studentAuth({ roles: ["student", "pic"], activeRole: "pic" })),
      InvalidStudentIdentityContextError,
    );
    assert.equal(findCalls, 0);
    assert.equal(createCalls, 0);
  } finally {
    StudentProfile.findOne = originalFindOne;
    StudentProfile.create = originalCreate;
  }
});

test("activeRole student must be present in the validated roles context", async () => {
  await assert.rejects(
    ensureStudentIdentity(studentAuth({ roles: ["trainer"] })),
    InvalidStudentIdentityContextError,
  );
});

test("Student identity rejects a missing trusted subject", async () => {
  await assert.rejects(
    ensureStudentIdentity(studentAuth({ userId: " " })),
    InvalidStudentIdentityContextError,
  );
  assert.throws(() => findStudentIdentity(""), InvalidStudentIdentityContextError);
});

test("non-unique database failures are propagated instead of treated as race conflicts", async () => {
  const originalFindOne = StudentProfile.findOne;
  const failure = new Error("database unavailable");
  StudentProfile.findOne = async () => { throw failure; };
  try {
    await assert.rejects(ensureStudentIdentity(studentAuth()), (error) => error === failure);
  } finally {
    StudentProfile.findOne = originalFindOne;
  }
});
