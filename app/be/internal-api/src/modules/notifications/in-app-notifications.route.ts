import { QueryTypes } from "sequelize";
import { Router } from "express";
import { ACCESS_ACTIONS, ROLES } from "@mis/shared-types";
import { sequelize } from "../../database/sequelize";
import { authorizeActiveRole } from "../../middlewares/authorize.middleware";
import { authorizeCapability } from "../../middlewares/authorize-capability.middleware";
import { AppError } from "../../errors/app-error";
import { asyncHandler } from "../../utils/async-handler";

export const inAppNotificationsRouter = Router();
inAppNotificationsRouter.use(authorizeActiveRole(ROLES.ADMIN));

inAppNotificationsRouter.get("/", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const recipient = req.auth!.userId;
  const items = await sequelize.query<Record<string, unknown>>(
    "SELECT id,title,message,target_path,created_at,read_at FROM in_app_notification WHERE recipient_subject=:recipient ORDER BY created_at DESC LIMIT 30",
    { replacements: { recipient }, type: QueryTypes.SELECT },
  );
  const count = await sequelize.query<{ total: number | string }>(
    "SELECT COUNT(*) AS total FROM in_app_notification WHERE recipient_subject=:recipient AND read_at IS NULL",
    { replacements: { recipient }, type: QueryTypes.SELECT },
  );
  return res.json({ items, unreadCount: Number(count[0]?.total ?? 0) });
}));

inAppNotificationsRouter.patch("/:id/read", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const id = req.params.id;
  const rows = await sequelize.query<{ id: string }>(
    "UPDATE in_app_notification SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE id=:id AND recipient_subject=:recipient RETURNING id",
    { replacements: { id, recipient: req.auth!.userId }, type: QueryTypes.SELECT },
  );
  if (!rows.length) throw new AppError(404, "Notification not found");
  return res.json({ item: { id, read: true } });
}));
