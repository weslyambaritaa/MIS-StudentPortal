import { createRemoteJWKSet } from "jose";
import { env } from "../config/env";

export const keycloakJwks = createRemoteJWKSet(new URL(env.keycloakJwksInternalUrl));
