import { Router } from "express";
import { healthRouter } from "../modules/health/health.route";
import { authContext } from "../middlewares/auth-context.middleware";
import { ensureStudentIdentityForActiveRole } from "../middlewares/ensure-student-identity.middleware";
import { serviceAuth } from "../middlewares/service-auth.middleware";
import { picDomainRouter } from "../modules/pics/pic-domain.route";

export const routes = Router();
routes.use(healthRouter);
routes.use("/api/v1/internal-service/pics", serviceAuth, picDomainRouter);
routes.use("/api/v1/external", authContext, ensureStudentIdentityForActiveRole);
routes.get("/api/v1/external/me", (req, res) => res.json({ service: "student-api", auth: req.auth }));
