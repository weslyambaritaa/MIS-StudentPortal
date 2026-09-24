# Realm bootstrap

The starter imports `mis-student-portal.json` on the first Keycloak startup.

The bootstrap realm selects the `mis-student-portal` login theme and allows sign-in by email or username. If the realm already exists in Keycloak, update these settings under **Realm settings → Themes → Login theme** and **Login → Login with email**; startup realm import does not overwrite an existing realm.

For local development, the OIDC client secret in the realm JSON intentionally matches the default `KEYCLOAK_CLIENT_SECRET` in the root `.env`. If you change that local secret before the first import, change it in both places. For shared/staging/production environments, manage the client secret through the environment/secret manager and rotate it after provisioning.
