import { createProxyMiddleware } from "http-proxy-middleware";
import { env } from "../config/env";

export const internalProxy = createProxyMiddleware({
  target: env.internalApiUrl,
  changeOrigin: true,
  xfwd: true,
  pathRewrite: (path) => `/api/v1/internal${path}`,
});

// This proxy is mounted at /api/v1/external/trainers, so Express strips that
// mount prefix before http-proxy-middleware receives the URL. Restore the
// internal router's /trainers prefix explicitly (e.g. /portal-login).
export const trainerPortalProxy = createProxyMiddleware({
  target: env.internalApiUrl,
  changeOrigin: true,
  xfwd: true,
  pathRewrite: (path) => `/api/v1/internal/trainers${path}`,
});
