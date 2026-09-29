const assert = require("node:assert/strict");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.GATEWAY_SHARED_SECRET ??= "gateway-test-secret";
process.env.SERVICE_SHARED_SECRET ??= "service-test-secret";
process.env.DB_HOST ??= "127.0.0.1";
process.env.DB_NAME ??= "mis-test";
process.env.DB_USER ??= "test";
process.env.DB_PASSWORD ??= "test";

const { TrainerProfile } = require("../dist/database/models/trainer-profile.model.js");
const { PicProfile } = require("../dist/database/models/pic-profile.model.js");
const { resolveTrainerIdentity } = require("../dist/modules/trainer/trainer-identity.js");
const { resolvePicIdentity } = require("../dist/modules/pic/pic-identity.js");
const { InvalidIdentitySubjectError } = require("../dist/modules/identity/identity-subject.js");

test("Trainer identity resolves by authenticated Keycloak subject and returns the profile ID", async () => {
  const originalFindOne = TrainerProfile.findOne;
  const originalCreate = TrainerProfile.create;
  const profile = { id: "trainer-profile-1", keycloak_subject: "kc-trainer-1" };
  let query;
  TrainerProfile.findOne = async (options) => { query = options; return profile; };
  TrainerProfile.create = async () => { throw new Error("Trainer resolver must not create profiles"); };

  try {
    const result = await resolveTrainerIdentity("kc-trainer-1");
    assert.deepEqual(query.where, { keycloak_subject: "kc-trainer-1" });
    assert.deepEqual(query.attributes, ["id", "keycloak_subject"]);
    assert.deepEqual(result, { status: "resolved", profile, profileId: "trainer-profile-1" });
  } finally {
    TrainerProfile.findOne = originalFindOne;
    TrainerProfile.create = originalCreate;
  }
});

test("Trainer identity reports a missing profile without provisioning one", async () => {
  const originalFindOne = TrainerProfile.findOne;
  const originalCreate = TrainerProfile.create;
  let createCalled = false;
  TrainerProfile.findOne = async () => null;
  TrainerProfile.create = async () => { createCalled = true; throw new Error("unexpected create"); };

  try {
    assert.deepEqual(await resolveTrainerIdentity("kc-trainer-missing"), { status: "missing" });
    assert.equal(createCalled, false);
  } finally {
    TrainerProfile.findOne = originalFindOne;
    TrainerProfile.create = originalCreate;
  }
});

test("Trainer resolver rejects an empty subject and propagates database failures", async () => {
  await assert.rejects(resolveTrainerIdentity(" "), InvalidIdentitySubjectError);

  const originalFindOne = TrainerProfile.findOne;
  const failure = new Error("database unavailable");
  TrainerProfile.findOne = async () => { throw failure; };
  try {
    await assert.rejects(resolveTrainerIdentity("kc-trainer-1"), (error) => error === failure);
  } finally {
    TrainerProfile.findOne = originalFindOne;
  }
});

test("PIC identity resolves by authenticated Keycloak subject and does not assign an Account", async () => {
  const originalFindOne = PicProfile.findOne;
  const originalCreate = PicProfile.create;
  const profile = { id: "pic-profile-1", keycloak_subject: "kc-pic-1" };
  let query;
  PicProfile.findOne = async (options) => { query = options; return profile; };
  PicProfile.create = async () => { throw new Error("PIC resolver must not create profiles"); };

  try {
    const result = await resolvePicIdentity("kc-pic-1");
    assert.deepEqual(query.where, { keycloak_subject: "kc-pic-1" });
    assert.deepEqual(query.attributes, ["id", "keycloak_subject"]);
    assert.deepEqual(result, { status: "resolved", profile, profileId: "pic-profile-1" });
  } finally {
    PicProfile.findOne = originalFindOne;
    PicProfile.create = originalCreate;
  }
});

test("PIC identity reports a missing profile without creating a profile or Account assignment", async () => {
  const originalFindOne = PicProfile.findOne;
  const originalCreate = PicProfile.create;
  let createCalled = false;
  PicProfile.findOne = async () => null;
  PicProfile.create = async () => { createCalled = true; throw new Error("unexpected create"); };

  try {
    assert.deepEqual(await resolvePicIdentity("kc-pic-missing"), { status: "missing" });
    assert.equal(createCalled, false);
  } finally {
    PicProfile.findOne = originalFindOne;
    PicProfile.create = originalCreate;
  }
});

test("PIC resolver rejects an empty subject", async () => {
  await assert.rejects(resolvePicIdentity(""), InvalidIdentitySubjectError);
});
