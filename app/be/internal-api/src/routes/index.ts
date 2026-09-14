import { Router } from "express";
import { healthRouter } from "../modules/health/health.route";
import { authContext } from "../middlewares/auth-context.middleware";
export const routes = Router();
routes.use(healthRouter);
routes.use("/api/v1/internal", authContext);
routes.get("/api/v1/internal/me", (req, res) => res.json({ service: "internal-api", auth: req.auth }));
