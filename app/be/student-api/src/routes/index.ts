import { Router } from "express";
import { healthRouter } from "../modules/health/health.route";
import { authContext } from "../middlewares/auth-context.middleware";

export const routes = Router();
routes.use(healthRouter);
routes.use("/api/v1/external", authContext);
routes.get("/api/v1/external/me", (req, res) => res.json({ service: "student-api", auth: req.auth }));
