# Keycloak

`realm/` contains local realm bootstrap configuration. `themes/` contains the custom login theme skeleton.

For local Compose startup, copy `.env.example` to `.env` and set the bootstrap administrator and database password values. The database password must match the local Keycloak SQL Server password configured for Compose. Keep `.env` out of Git; only the example is committed.
