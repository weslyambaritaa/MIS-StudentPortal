import { createProxyMiddleware } from "http-proxy-middleware";
import { env } from "../config/env";

export const accountAdminProxy = createProxyMiddleware({
  target: env.internalApiUrl,
  changeOrigin: true,
  xfwd: true,
  pathRewrite: (path) => `/api/v1/admin/accounts${path}`,
});

export const accessLogsAdminProxy = createProxyMiddleware({
  target: env.internalApiUrl,
  changeOrigin: true,
  xfwd: true,
  pathRewrite: (path) => `/api/v1/admin/access-logs${path}`,
});
