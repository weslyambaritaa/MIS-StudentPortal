import cors from "cors";
import { env } from "../config/env";

export const corsMiddleware = cors({
  origin: env.corsOrigins,
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Active-Role", "X-Request-Id"],
});
