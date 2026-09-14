# Realm bootstrap

The starter imports `mis-student-portal.json` on the first Keycloak startup.

For local development, the OIDC client secret in the realm JSON intentionally matches the default `KEYCLOAK_CLIENT_SECRET` in the root `.env`. If you change that local secret before the first import, change it in both places. For shared/staging/production environments, manage the client secret through the environment/secret manager and rotate it after provisioning.
