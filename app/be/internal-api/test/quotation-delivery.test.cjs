const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");

process.env.NODE_ENV = "test";
for (const key of ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "GATEWAY_SHARED_SECRET", "SERVICE_SHARED_SECRET",
  "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "MAIL_HOST", "MAIL_USERNAME", "MAIL_PASSWORD", "MAIL_FROM_ADDRESS"]) {
  process.env[key] = "delivery-test";
}

const { sequelize } = require("../dist/database/sequelize");
const models = require("../dist/database/models");
const { keycloakAccountProvisioner } = require("../dist/modules/accounts/keycloak-account-provisioner");
const document = require("../dist/modules/quotations/quotation-document");
const cloudinary = require("cloudinary").v2;
const nodemailer = require("nodemailer");
const { quotationsRouter } = require("../dist/modules/quotations/quotations.route");

for (const [initialStatus, mode] of [["SEND_FAILED", "resend"], ["WAITING", "resend"], ["WAITING", "edit"], ["SEND_FAILED", "edit"], ["WAITING", "approve"]]) {
  test(`${mode} records the original ${initialStatus} state even when update mutates the model`, async (t) => {
    const previousVersion = initialStatus === "WAITING" ? 1 : 0;
    const quote = {
      id: "quote-test", quotation_code: "QTN-TEST", account_id: "account-test", pic_profile_id: "pic-test",
      created_by_subject: "sales-test", class_type: "PRIVATE", status: initialStatus,
      get: () => ({ email: "pic@example.test" }),
      update: async function (values) { Object.assign(this, values); },
    };
    const audits = [], documents = [];
    let emails = 0;
    t.mock.method(models.RoleAccessMatrix, "findOne", async () => ({ can_edit: true }));
    t.mock.method(models.Quotation, "findOne", async () => quote);
    t.mock.method(models.Account, "findOne", async () => ({ name: "Test Account" }));
    t.mock.method(models.PicProfile, "findOne", async () => ({ name: "Test PIC", email: "pic@example.test" }));
    t.mock.method(models.Course, "findAll", async () => [{ id: "course-test", name: "Test Course", duration_minutes: 480 }]);
    t.mock.method(models.QuotationOrder, "findAll", async () => [{ course_id: "course-test", amount_student: 1, price: 100, location: "Test" }]);
    t.mock.method(models.QuotationOrder, "destroy", async () => 1);
    t.mock.method(models.QuotationOrder, "bulkCreate", async () => []);
    t.mock.method(models.QuotationDocument, "findAll", async () => previousVersion ? [{ version: previousVersion }] : []);
    t.mock.method(models.QuotationDocument, "create", async (row) => { documents.push(row); });
    t.mock.method(models.AuditTrail, "create", async (row) => { audits.push(row); });
    t.mock.method(sequelize, "transaction", async (run) => run({ LOCK: { UPDATE: "UPDATE" } }));
    // All external services are mocked: no real email, upload, PDF, or identity lookup.
    t.mock.method(keycloakAccountProvisioner, "getIdentity", async () => ({ firstName: "Sales", lastName: "Test" }));
    t.mock.method(document, "generateQuotationPdf", async () => Buffer.from("test pdf"));
    t.mock.method(cloudinary, "config", () => ({}));
    t.mock.method(cloudinary.uploader, "upload_stream", (_options, callback) => ({ end: () => callback(null, { public_id: "test", asset_id: "test" }) }));
    t.mock.method(nodemailer, "createTransport", () => ({ sendMail: async () => { emails += 1; } }));

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.auth = { userId: "sales-test", activeRole: "sales", roles: ["sales"] }; next(); });
    app.use(quotationsRouter);
    app.use((error, _req, res, _next) => res.status(500).json({ message: error.message }));
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/quote-test${mode === "resend" ? "/resend" : mode === "approve" ? "/status" : ""}`, {
        method: mode === "resend" ? "POST" : mode === "approve" ? "PATCH" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: mode === "resend" ? undefined : JSON.stringify(mode === "approve" ? { status: "APPROVED" } : {
          quotationCode: "QTN-TEST", accountId: "10000000-0000-4000-8000-000000000001", picId: "10000000-0000-4000-8000-000000000002", classType: "PRIVATE",
          lines: [{ courseId: "10000000-0000-4000-8000-000000000003", amountStudent: 2, pricePerPax: 100, location: "Test" }],
        }),
      });
      const body = await response.json();
      assert.equal(response.status, 200, body.message);
      if (mode === "approve") {
        assert.equal(body.item.status, "APPROVED");
        assert.equal(emails, 0);
        assert.equal(documents.length, 0);
        assert.deepEqual(JSON.parse(audits[0].data_before), { status: "WAITING" });
        assert.deepEqual(JSON.parse(audits[0].data_after), { status: "APPROVED" });
        return;
      }
      assert.equal(body.item.status, "WAITING");
      assert.equal(emails, 1);
      assert.equal(documents[0].version, previousVersion + 1);
      const deliveryAudit = audits.find((row) => row.object_type === "QUOTATION_DELIVERY");
      assert.deepEqual(JSON.parse(deliveryAudit.data_before), { status: mode === "edit" ? "SEND_FAILED" : initialStatus, version: previousVersion });
      assert.deepEqual(JSON.parse(deliveryAudit.data_after), { status: "WAITING", version: previousVersion + 1 });
      if (mode === "edit") {
        const editAudit = audits.find((row) => row.object_type === "QUOTATION");
        assert.equal(JSON.parse(editAudit.data_before).status, initialStatus);
        assert.equal(JSON.parse(editAudit.data_before).lines[0].amountStudent, 1);
        assert.equal(JSON.parse(editAudit.data_after).lines[0].amountStudent, 2);
      }
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
}
