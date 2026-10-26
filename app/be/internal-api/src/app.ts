import { randomUUID } from "node:crypto";
import express from "express"; import cors from "cors"; import helmet from "helmet"; import pinoHttp from "pino-http";
import { apiErrorFormatter, createHttp5xxMonitor } from "@mis/logger";
import { routes } from "./routes"; import { notFound } from "./middlewares/not-found.middleware"; import { errorHandler } from "./middlewares/error-handler.middleware";
import "./database/models";
import { logger } from "./modules/monitoring/logger";
export const app = express(); app.use(helmet()); app.use(cors()); app.use(pinoHttp({ logger, genReqId: (req, res) => { const id = req.headers["x-request-id"]?.toString() ?? randomUUID(); res.setHeader("x-request-id", id); return id; },
  redact: {
    paths: ["req.headers.authorization", "req.headers.x-gateway-secret", "req.headers.x-service-secret"],
    censor: "REDACTED",
  },
})); app.use(createHttp5xxMonitor({ service: "internal-api", logger })); app.use(apiErrorFormatter); app.use(express.json({ limit: "15mb" })); app.use(routes); app.use(notFound); app.use(errorHandler);
