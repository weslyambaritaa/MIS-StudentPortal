import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";
import { apiErrorFormatter, createCentralAlertReporter, createHttp5xxMonitor, createLogger } from "@mis/logger";
import { API_BOUNDARIES, API_PREFIX } from "@mis/config";

import { corsMiddleware } from "./middlewares/cors.middleware";
import { requestId } from "./middlewares/request-id.middleware";
import { apiRateLimit } from "./middlewares/rate-limit.middleware";
import { authenticate } from "./middlewares/authenticate.middleware";
import { authenticateUserProvisioner } from "./middlewares/authenticate-user-provisioner.middleware";
import { authorizeBoundary } from "./middlewares/authorize-boundary.middleware";

import { EXTERNAL_ROLES, INTERNAL_ROLES } from "./auth/roles";
import { ROLES } from "@mis/shared-types";

import { realmProxy, resourcesProxy, adminProxy } from "./proxy/keycloak.proxy";

import { externalProxy } from "./proxy/external.proxy";
import { internalProxy, trainerPortalProxy } from "./proxy/internal.proxy";
import { accountAdminProxy, accessLogsAdminProxy } from "./proxy/admin.proxy";

import { routes } from "./routes";
import { env } from "./config/env";

import { notFound } from "./middlewares/not-found.middleware";
import { errorHandler } from "./middlewares/error-handler.middleware";

export const app = express();

/*
 * Logging / correlation.
 * Aman digunakan untuk seluruh request.
 */
app.use(requestId);
const logger = createLogger("api-gateway");
app.use(pinoHttp({
  logger,
  genReqId: (req, res) => { const id = req.headers["x-request-id"]?.toString() ?? randomUUID(); res.setHeader("x-request-id", id); return id; },
  redact: {
    paths: ["req.headers.authorization", "req.headers.x-gateway-secret", "req.headers.x-service-secret"],
    censor: "[REDACTED]",
  },
}));

/*
 * =====================================================
 * KEYCLOAK REVERSE PROXY
 * =====================================================
 *
 * Diletakkan sebelum Helmet, CORS business API,
 * body parser, authentication middleware, dll.
 *
 * Gateway hanya melakukan passthrough ke Keycloak.
 */

app.use("/realms", realmProxy);
app.use("/resources", resourcesProxy);
app.use("/admin", adminProxy);

/*
 * =====================================================
 * BUSINESS API MIDDLEWARE
 * =====================================================
 */

app.use(helmet());
app.use(corsMiddleware);
app.use(apiErrorFormatter);

/*
 * Health dan general Gateway routes.
 */
app.use(routes);

/*
 * =====================================================
 * BUSINESS API
 * =====================================================
 */

app.use(API_PREFIX, apiRateLimit);
app.use(createHttp5xxMonitor({ service: "api-gateway", logger, report: createCentralAlertReporter("api-gateway", env.internalApiUrl, env.gatewaySharedSecret) }));

// Separate administrative identity route; it intentionally does not select or union a business activeRole.
app.use(`${API_PREFIX}/admin/accounts`, authenticateUserProvisioner, accountAdminProxy);
app.use(`${API_PREFIX}/admin/access-logs`, authenticateUserProvisioner, accessLogsAdminProxy);

// Trainer profile data lives in the internal database, so route only this
// trainer-owned login sync to the internal API while retaining external-role authorization.
app.use(`${API_BOUNDARIES.EXTERNAL}/trainers`, authenticate, authorizeBoundary([ROLES.TRAINER]), trainerPortalProxy);

app.use(API_BOUNDARIES.EXTERNAL, authenticate, authorizeBoundary(EXTERNAL_ROLES), externalProxy);

app.use(API_BOUNDARIES.INTERNAL, authenticate, authorizeBoundary(INTERNAL_ROLES), internalProxy);

/*
 * =====================================================
 * FALLBACK
 * =====================================================
 */

app.use(notFound);
app.use(errorHandler);
