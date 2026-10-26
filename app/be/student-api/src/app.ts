import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import { apiErrorFormatter, createHttp5xxMonitor, createLogger } from "@mis/logger";
import { routes } from "./routes";
import { notFound } from "./middlewares/not-found.middleware";
import { errorHandler } from "./middlewares/error-handler.middleware";
import { internalApiError } from "./middlewares/internal-api-error.middleware";
import "./database/models";

export const app = express();
app.use(helmet());
app.use(cors());
const logger = createLogger("student-api");
app.use(pinoHttp({ logger, genReqId: (req, res) => { const id = req.headers["x-request-id"]?.toString() ?? randomUUID(); res.setHeader("x-request-id", id); return id; },
  redact: {
    paths: ["req.headers.authorization", "req.headers.x-gateway-secret", "req.headers.x-service-secret"],
    censor: "[REDACTED]",
  },
}));
app.use(createHttp5xxMonitor({ service: "student-api", logger }));
app.use(apiErrorFormatter);
app.use(express.json());
app.use(routes);
app.use(notFound);
app.use(internalApiError);
app.use(errorHandler);
