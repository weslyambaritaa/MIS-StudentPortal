import { createProxyMiddleware } from "http-proxy-middleware";
import { env } from "../config/env";

function baseOptions(prefix: string) {
  return {
    target: env.keycloakInternalUrl,

    changeOrigin: false,
    xfwd: true,

    pathRewrite: (path: string) => `${prefix}${path}`,

    on: {
      proxyReq: (proxyReq: any) => {
        proxyReq.setHeader("host", env.keycloakPublicHost);

        proxyReq.setHeader("x-forwarded-host", env.keycloakPublicHost);

        proxyReq.setHeader("x-forwarded-proto", "http");

        proxyReq.setHeader("x-forwarded-port", "4000");
      },
    },
  };
}

export const realmProxy = createProxyMiddleware(baseOptions("/realms"));

export const resourcesProxy = createProxyMiddleware(baseOptions("/resources"));

export const adminProxy = createProxyMiddleware(baseOptions("/admin"));
