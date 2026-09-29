import { Router } from "express";

import { serviceAuth } from "../middlewares/service-auth.middleware";

/** Reserved service-only namespace. Business handlers are added in their domain checkpoints. */
export const internalServiceRoutes = Router();
internalServiceRoutes.use(serviceAuth);
