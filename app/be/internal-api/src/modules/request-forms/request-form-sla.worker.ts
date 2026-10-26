import { randomUUID } from "node:crypto";
import { QueryTypes } from "sequelize";
import { ROLES } from "@mis/shared-types";
import { sequelize } from "../../database/sequelize";
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
  const forms = await sequelize.query<WaitingForm>(
    "SELECT id,request_form_number,training_title,updated_at,sla_due_at FROM request_form WHERE status='WAITING' AND sla_notified_at IS NULL ORDER BY updated_at",
    { type: QueryTypes.SELECT }
  );
  if (!forms.length) return 0;

  const dueForms: Array<{ form: WaitingForm; dueAt: Date }> = [];
  for (const form of forms) {
    // Recalculate from the original Waiting timestamp so existing Waiting forms
    // are aligned with the current SLA duration.
    const dueAt = new Date(asDate(form.updated_at).getTime() + SLA_DURATION_MS);
    if (!form.sla_due_at || asDate(form.sla_due_at).getTime() !== dueAt.getTime()) {
      await sequelize.query(
        "UPDATE request_form SET sla_due_at=:dueAt WHERE id=:id AND status='WAITING' AND sla_notified_at IS NULL",
        { replacements: { id: form.id, dueAt } }
      );
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
      const claimed = await sequelize.query<{ id: string }>(
        "UPDATE request_form SET sla_notified_at=:now WHERE id=:id AND status='WAITING' AND sla_notified_at IS NULL AND sla_due_at<=:now RETURNING id",
        { replacements: { id: form.id, now }, type: QueryTypes.SELECT, transaction }
      );
      if (!claimed.length) return;
      for (const admin of admins) {
        await sequelize.query(
          "INSERT INTO in_app_notification (id,recipient_subject,event_key,title,message,target_path,created_at,read_at) VALUES (:id,:recipient,:eventKey,:title,:message,:targetPath,:now,NULL)",
          {
            replacements: {
              id: randomUUID(),
              recipient: admin.userId,
              eventKey,
              title: "Request Form SLA overdue",
              message: `${form.request_form_number}${form.training_title ? ` · ${form.training_title}` : ""} has been Waiting for more than 24 hours.`,
              targetPath: "/admin/trainings",
              now,
            },
            transaction,
          }
        );
      }
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
