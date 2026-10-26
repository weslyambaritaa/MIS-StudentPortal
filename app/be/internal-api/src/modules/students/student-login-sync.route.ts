import { col, fn } from "sequelize";
import { Router } from "express";
import { ROLES } from "@mis/shared-types";
import { StudentMasterProfile } from "../../database/models";
import { asyncHandler } from "../../utils/async-handler";

export const studentLoginSyncRouter = Router();

studentLoginSyncRouter.post("/login", asyncHandler(async (req, res) => {
  if (req.auth?.activeRole !== ROLES.STUDENT || !req.auth.roles.includes(ROLES.STUDENT)) {
    return res.status(403).json({ message: "A validated Student login context is required" });
  }
  const studentId = req.body?.studentId;
  if (typeof studentId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(studentId)) {
    return res.status(400).json({ message: "A valid Student identity ID is required" });
  }
  await StudentMasterProfile.update({
    student_id: studentId,
    first_login_at: fn("COALESCE", col("first_login_at"), fn("NOW")),
    last_login_at: fn("NOW"),
  }, { where: { keycloak_subject: req.auth.userId, portal_enabled: true } });
  return res.status(204).end();
}));
