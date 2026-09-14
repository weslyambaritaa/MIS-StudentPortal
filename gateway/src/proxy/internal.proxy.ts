import { createProxyMiddleware } from "http-proxy-middleware";
import { env } from "../config/env";

export const internalProxy = createProxyMiddleware({
  target: env.internalApiUrl,
  changeOrigin: true,
  xfwd: true,
  pathRewrite: (path) => `/api/v1/internal${path}`,
});
