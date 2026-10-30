import { randomUUID } from "node:crypto";
import { Op, type WhereOptions } from "sequelize";
import Joi from "joi";
import { Router } from "express";
import { PicAccountAssignment, PicProfile } from "../../database/models";
import { sequelize } from "../../database/sequelize";
import { AppError } from "../../errors/app-error";
import { asyncHandler } from "../../utils/async-handler";

export const picDomainRouter = Router();
const uuid = Joi.string().guid({ version: ["uuidv4", "uuidv5"] });
const statusSchema = Joi.string().valid("PENDING", "ACTIVE", "INACTIVE");

const assignmentShape = (assignment: PicAccountAssignment) => ({
  id: assignment.id,
  account_id: assignment.account_id,
  assigned_at: assignment.assigned_at,
  ended_at: assignment.ended_at,
  assigned_by_subject: assignment.assigned_by_subject,
  ended_by_subject: assignment.ended_by_subject,
});

const itemShape = async (profile: PicProfile) => ({
  id: profile.id,
  keycloak_subject: profile.keycloak_subject,
  name: profile.name,
  email: profile.email,
  status: profile.status,
  activation_expires_at: profile.activation_expires_at,
  position: profile.position,
  created_at: profile.created_at,
  updated_at: profile.updated_at,
  assignments: (await PicAccountAssignment.findAll({ where: { pic_profile_id: profile.id }, order: [["assigned_at", "ASC"]] })).map(assignmentShape),
});

picDomainRouter.get("/", asyncHandler(async (req, res) => {
  const schema = Joi.object({ id: uuid.optional(), profileIds: Joi.string().max(20000).allow("").optional(), accountId: uuid.optional(), accountIds: Joi.string().max(20000).allow("").optional(), status: statusSchema.optional(), search: Joi.string().max(150).allow("").optional() }).unknown(false);
  const { error, value } = schema.validate(req.query);
  if (error) throw new AppError(400, "Invalid PIC search filters");
  const accountIds = value.accountIds ? String(value.accountIds).split(",").filter(Boolean) : [];
  const profileIds = value.profileIds ? String(value.profileIds).split(",").filter(Boolean) : [];
  if (accountIds.some((accountId) => uuid.validate(accountId).error)) throw new AppError(400, "Invalid Account filter");
  if (profileIds.some((profileId) => uuid.validate(profileId).error)) throw new AppError(400, "Invalid PIC filter");
  const where: WhereOptions = {
    ...(value.id ? { id: value.id } : {}),
    ...(profileIds.length ? { id: { [Op.in]: profileIds } } : {}),
    ...(value.status ? { status: value.status } : {}),
    ...(value.search ? { [Op.or]: [{ name: { [Op.iLike]: `%${value.search}%` } }, { email: { [Op.iLike]: `%${value.search}%` } }] } : {}),
  };
  const profiles = await PicProfile.findAll({ where, order: [["name", "ASC"], ["id", "ASC"]] });
  const wantedAccountIds = accountIds.length ? accountIds : value.accountId ? [value.accountId] : null;
  const items = [];
  for (const profile of profiles) {
    const item = await itemShape(profile);
    const activeAssignments = item.assignments.filter((assignment) => !assignment.ended_at && (!wantedAccountIds || wantedAccountIds.includes(assignment.account_id)));
    if (wantedAccountIds && !activeAssignments.length) continue;
    items.push({ ...item, assignments: item.assignments.filter((assignment) => !wantedAccountIds || wantedAccountIds.includes(assignment.account_id)) });
  }
  return res.json({ items });
}));

picDomainRouter.post("/", asyncHandler(async (req, res) => {
  const schema = Joi.object({
    id: uuid.required(), keycloakSubject: Joi.string().max(255).required(), name: Joi.string().max(200).required(),
    email: Joi.string().email().max(254).required(), position: Joi.string().max(255).required(),
    status: statusSchema.required(), activationExpiresAt: Joi.date().allow(null).required(),
    accountId: uuid.required(), assignedBySubject: Joi.string().max(255).allow(null).required(),
  }).unknown(false);
  const { error, value } = schema.validate(req.body);
  if (error) throw new AppError(400, "Invalid PIC profile details");
  const result = await sequelize.transaction(async (transaction) => {
    const profile = await PicProfile.create({ id: value.id, keycloak_subject: value.keycloakSubject, name: value.name, email: value.email, position: value.position, status: value.status, activation_expires_at: value.activationExpiresAt }, { transaction });
    await PicAccountAssignment.create({ id: randomUUID(), pic_profile_id: profile.id, account_id: value.accountId, assigned_by_subject: value.assignedBySubject, ended_by_subject: null, ended_at: null }, { transaction });
    return profile;
  });
  return res.status(201).json({ item: await itemShape(result) });
}));

picDomainRouter.patch("/:id", asyncHandler(async (req, res) => {
  const { error: idError, value: id } = uuid.validate(req.params.id);
  if (idError) throw new AppError(400, "Invalid PIC ID");
  const schema = Joi.object({ name: Joi.string().max(200).optional(), status: statusSchema.optional(), activationExpiresAt: Joi.date().allow(null).optional() }).min(1).unknown(false);
  const { error, value } = schema.validate(req.body);
  if (error) throw new AppError(400, "Invalid PIC profile update");
  const profile = await PicProfile.findByPk(id);
  if (!profile) throw new AppError(404, "PIC not found");
  await profile.update({ ...(value.name !== undefined ? { name: value.name } : {}), ...(value.status !== undefined ? { status: value.status } : {}), ...(value.activationExpiresAt !== undefined ? { activation_expires_at: value.activationExpiresAt } : {}) });
  return res.json({ item: await itemShape(profile) });
}));

picDomainRouter.delete("/accounts/:accountId/assignments", asyncHandler(async (req, res) => {
  const { error, value } = uuid.validate(req.params.accountId);
  if (error) throw new AppError(400, "Invalid Account ID");
  const [ended] = await PicAccountAssignment.update({ ended_at: new Date(), ended_by_subject: req.auth!.userId }, { where: { account_id: value, ended_at: null } });
  return res.json({ ended });
}));

picDomainRouter.delete("/:id", asyncHandler(async (req, res) => {
  const { error, value } = uuid.validate(req.params.id);
  if (error) throw new AppError(400, "Invalid PIC ID");
  const profile = await PicProfile.findByPk(value);
  if (!profile) return res.status(204).end();
  await sequelize.transaction(async (transaction) => {
    await PicAccountAssignment.destroy({ where: { pic_profile_id: value }, transaction });
    await profile.destroy({ transaction });
  });
  return res.status(204).end();
}));

