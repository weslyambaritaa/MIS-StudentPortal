import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";

import { corsMiddleware } from "./middlewares/cors.middleware";
import { requestId } from "./middlewares/request-id.middleware";
import { apiRateLimit } from "./middlewares/rate-limit.middleware";
import { authenticate } from "./middlewares/authenticate.middleware";
import { authorizeBoundary } from "./middlewares/authorize-boundary.middleware";

import { EXTERNAL_ROLES, INTERNAL_ROLES } from "./auth/roles";

import { realmProxy, resourcesProxy, adminProxy } from "./proxy/keycloak.proxy";

import { externalProxy } from "./proxy/external.proxy";
import { internalProxy } from "./proxy/internal.proxy";

import { routes } from "./routes";

import { notFound } from "./middlewares/not-found.middleware";
import { errorHandler } from "./middlewares/error-handler.middleware";

export const app = express();

/*
 * Logging / correlation.
 * Aman digunakan untuk seluruh request.
 */
app.use(requestId);
app.use(pinoHttp());

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

/*
 * Health dan general Gateway routes.
 */
app.use(routes);

/*
 * =====================================================
 * BUSINESS API
 * =====================================================
 */

app.use("/api/v1", apiRateLimit);

app.use("/api/v1/external", authenticate, authorizeBoundary(EXTERNAL_ROLES), externalProxy);

app.use("/api/v1/internal", authenticate, authorizeBoundary(INTERNAL_ROLES), internalProxy);

/*
 * =====================================================
 * FALLBACK
 * =====================================================
 */

app.use(notFound);
app.use(errorHandler);
