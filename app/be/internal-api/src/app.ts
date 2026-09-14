import express from "express"; import cors from "cors"; import helmet from "helmet"; import pinoHttp from "pino-http";
import { routes } from "./routes"; import { notFound } from "./middlewares/not-found.middleware"; import { errorHandler } from "./middlewares/error-handler.middleware";
export const app = express(); app.use(helmet()); app.use(cors()); app.use(pinoHttp()); app.use(express.json()); app.use(routes); app.use(notFound); app.use(errorHandler);
