import { Router } from "express";
import { ACCESS_ACTIONS, ROLES } from "@mis/shared-types";
import { InAppNotification } from "../../database/models";
import { authorizeActiveRole } from "../../middlewares/authorize.middleware";
import { authorizeCapability } from "../../middlewares/authorize-capability.middleware";
import { AppError } from "../../errors/app-error";
import { asyncHandler } from "../../utils/async-handler";

export const inAppNotificationsRouter = Router();
inAppNotificationsRouter.use(authorizeActiveRole(ROLES.ADMIN));

inAppNotificationsRouter.get("/", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const recipient = req.auth!.userId;
  const [items, unreadCount] = await Promise.all([
    InAppNotification.findAll({
      attributes: ["id", "title", "message", "target_path", "created_at", "read_at"],
      where: { recipient_subject: recipient },
      order: [["created_at", "DESC"]],
      limit: 30,
      raw: true,
    }),
    InAppNotification.count({ where: { recipient_subject: recipient, read_at: null } }),
  ]);
  return res.json({ items, unreadCount });
}));

inAppNotificationsRouter.patch("/:id/read", authorizeCapability("REQUEST_FORM", ACCESS_ACTIONS.VIEW), asyncHandler(async (req, res) => {
  const id = req.params.id;
  const notification = await InAppNotification.findOne({ where: { id, recipient_subject: req.auth!.userId }, attributes: ["id", "read_at"] });
  if (!notification) throw new AppError(404, "Notification not found");
  if (!notification.read_at) await notification.update({ read_at: new Date() });
  return res.json({ item: { id, read: true } });
}));
