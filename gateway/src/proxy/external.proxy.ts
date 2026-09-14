import { createProxyMiddleware } from "http-proxy-middleware";
import { env } from "../config/env";

export const externalProxy = createProxyMiddleware({
  target: env.studentApiUrl,
  changeOrigin: true,
  xfwd: true,
  pathRewrite: (path) => `/api/v1/external${path}`,
});
