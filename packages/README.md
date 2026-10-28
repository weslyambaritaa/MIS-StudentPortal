# Shared workspace packages

Shared packages contain code that can be consumed by more than one application. They must not contain production secrets or server-specific deployment values.

- `@mis/ui`: reusable React UI components and styling class names.
- `@mis/auth`: framework-independent active-role selection helpers. Each app supplies its own allowed roles, storage key, Keycloak client configuration, and provider behavior.
- `@mis/api-client`: generic authenticated browser requests. Each frontend supplies its public API base URL at runtime/build time.
- `@mis/shared-types`: shared TypeScript contracts and role definitions.
- `@mis/config`: API path boundaries used by the browser app and Gateway.
- `@mis/logger`: shared backend logging helpers.

The Student Portal and MIS Internal frontends are separate workspaces. Both consume the shared UI, auth helpers, API client, and shared types; app-specific role policy, Keycloak client ID, and provider behavior remain in each frontend. `@mis/ui` is based on the existing MIS component implementations, moved into the shared workspace so both frontends use the same source. `@mis/config` is consumed by MIS Internal and the Gateway. Package dependencies are built from the same repository revision and contain no production secrets.

Import UI components through their package subpaths (for example, `@mis/ui/button` or `@mis/ui/modal`) so an app only depends on the component it uses. The root `@mis/ui` export remains available for compatibility. Legacy component files under MIS Internal re-export only their matching subpath and are deprecated; new code should import from `@mis/ui/<component>` directly.
