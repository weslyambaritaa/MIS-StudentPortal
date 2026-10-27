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

        // Local uses an HTTP issuer, while Dokploy exposes Keycloak over HTTPS.
        // Forward the externally configured scheme/port instead of always
        // telling Keycloak that the public request used HTTP on port 4000.
        const publicIssuer = new URL(env.keycloakIssuer);
        const protocol = publicIssuer.protocol.slice(0, -1);
        proxyReq.setHeader("x-forwarded-proto", protocol);

        proxyReq.setHeader("x-forwarded-port", publicIssuer.port || (protocol === "https" ? "443" : "80"));
      },
    },
  };
}

export const realmProxy = createProxyMiddleware(baseOptions("/realms"));

export const resourcesProxy = createProxyMiddleware(baseOptions("/resources"));

export const adminProxy = createProxyMiddleware(baseOptions("/admin"));
