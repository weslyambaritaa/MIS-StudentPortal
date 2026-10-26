import { randomUUID } from "node:crypto";
import { Op } from "sequelize";
import { ROLES } from "@mis/shared-types";
import { sequelize } from "../../database/sequelize";
import { InAppNotification, RequestForm } from "../../database/models";
import { keycloakAccountProvisioner } from "../accounts/keycloak-account-provisioner";
import { backgroundFailure } from "../monitoring/background-failure";
// Business SLA: one elapsed day after the form enters Waiting.
const SLA_DURATION_MS = 24 * 60 * 60 * 1000;
const INTERVAL_MS = 60 * 1000;
type WaitingForm = {
  id: string;
  request_form_number: string;
  training_title: string | null;
  updated_at: Date | string;
  sla_due_at: Date | string | null;
};

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

export async function processRequestFormSla(now = new Date()) {
  const forms = await RequestForm.findAll({
    attributes: ["id", "request_form_number", "training_title", "updated_at", "sla_due_at"],
    where: { status: "WAITING", sla_notified_at: null },
    order: [["updated_at", "ASC"]],
  }) as unknown as WaitingForm[];
  if (!forms.length) return 0;

  const dueForms: Array<{ form: WaitingForm; dueAt: Date }> = [];
  for (const form of forms) {
    // Recalculate from the original Waiting timestamp so existing Waiting forms
    // are aligned with the current SLA duration.
    const dueAt = new Date(asDate(form.updated_at).getTime() + SLA_DURATION_MS);
    if (!form.sla_due_at || asDate(form.sla_due_at).getTime() !== dueAt.getTime()) {
      await RequestForm.update({ sla_due_at: dueAt }, {
        where: { id: form.id, status: "WAITING", sla_notified_at: null },
      });
    }
    if (dueAt <= now) dueForms.push({ form, dueAt });
  }
  if (!dueForms.length) return 0;

  const admins = await keycloakAccountProvisioner.listRoleMembers(ROLES.ADMIN);
  if (!admins.length) return 0;
  let notifiedCount = 0;
  for (const { form, dueAt } of dueForms) {
    const waitingSince = asDate(form.updated_at).toISOString();
    const eventKey = `REQUEST_FORM_SLA:${form.id}:${waitingSince}`;
    await sequelize.transaction(async (transaction) => {
      const [claimedCount] = await RequestForm.update({ sla_notified_at: now }, {
        where: { id: form.id, status: "WAITING", sla_notified_at: null, sla_due_at: { [Op.lte]: now } },
        transaction,
      });
      if (!claimedCount) return;
      await InAppNotification.bulkCreate(admins.map((admin) => ({
        id: randomUUID(),
        recipient_subject: admin.userId,
        event_key: eventKey,
        title: "Request Form SLA overdue",
        message: `${form.request_form_number}${form.training_title ? ` · ${form.training_title}` : ""} has been Waiting for more than 24 hours.`,
        target_path: "/admin/trainings",
        created_at: now,
        read_at: null,
      })), { transaction });
      notifiedCount += admins.length;
    });
  }
  return notifiedCount;
}

export function startRequestFormSlaWorker() {
  const run = () => {
    void processRequestFormSla()
      .then((count) => {
        backgroundFailure.clear("request-form-sla");
        if (count) console.info(`Sent ${count} Request Form SLA in-app notification(s)`);
      })
      .catch((error: unknown) => {
        backgroundFailure.record("request-form-sla", error);
      });
  };
  run();
  const timer = setInterval(run, INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
