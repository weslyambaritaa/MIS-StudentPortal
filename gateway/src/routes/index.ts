import { Router } from "express";
import { healthRouter } from "./health.route";
export const routes = Router();
routes.use(healthRouter);
