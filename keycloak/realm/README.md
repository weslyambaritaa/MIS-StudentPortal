# Realm bootstrap

The starter imports `mis-student-portal.json` on the first Keycloak startup.

The bootstrap realm selects the `mis-student-portal` login theme and allows sign-in by email or username. If the realm already exists in Keycloak, update these settings under **Realm settings → Themes → Login theme** and **Login → Login with email**; startup realm import does not overwrite an existing realm.

## ST-01 login and password recovery

The login theme accepts either username or email. Password recovery uses a Keycloak provider that permits only the newest reset token and requires the authentication session from the browser that requested the email. The action token is single-use and expires after 900 seconds (15 minutes). Reused, superseded, expired, and cross-browser links show the themed English invalid-link page. The custom provider is packaged into the Keycloak image from `providers/st01`; rebuild Keycloak after changing it. SMTP settings must be configured on the `mis-student-portal` realm; `MAIL_*` environment variables alone do not configure Keycloak. Keep SMTP credentials only in the ignored local `keycloak/.env` (or a deployment secret manager), never in the realm JSON.

The custom `UPDATE_PASSWORD` page retains Keycloak's native `logout-sessions` form control and checks it by default. Keycloak's required-action handler invalidates the user's other sessions when the password update succeeds and that control is submitted.

For a local realm, run the helper after Keycloak is available to apply settings to an existing realm:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\keycloak\scripts\configure-st01.ps1 -Apply
```

The account is temporarily locked for 1 minute after 10 consecutive failed login attempts. A successful login resets the failure count. The realm uses English as its supported and default login language. The script reads local credentials without printing them and updates the existing realm through the Admin API. `mis-student-portal.json` carries non-secret bootstrap settings for a newly imported realm; applying runtime settings to an already-existing realm requires the helper.

The browser OIDC clients `mis-student-portal-frontend` and `student-portal-frontend` are public and use PKCE with S256. They share this realm and its users/roles, but each has its own redirect URI and web-origin allowlist. Neither may have a client secret because browser code cannot keep one confidential. After importing an existing realm, run the helper above with `-Apply` to create/configure both clients; realm import only applies on first creation. The helper currently adds localhost origins for local development. Add the Student Portal production redirect URI and origin after its domain is decided. Backend service clients remain confidential and their secrets stay in local environment files or a deployment secret manager.

## MIS account provisioning

The realm bootstrap defines `mis-user-provisioner` as an administrative realm role (not a business role) and `mis-account-provisioner` as a confidential service-account client. Neither role is an `activeRole`.

For an existing realm, startup import does not update it. In the Keycloak Admin Console, create/import these definitions if absent, assign `mis-user-provisioner` only to trusted MIS operators, and assign the service account for `mis-account-provisioner` the `realm-management.manage-users` and `realm-management.view-realm` roles for this realm only. `view-realm` is needed to read realm roles and their members (including the Trainer directory). Keep Full Scope Allowed disabled and explicitly include both roles in the client's role scope mappings; ensure the default `roles` client scope supplies the role claims. Do not grant `realm-admin` or master-realm administrator roles. Copy the current client secret to `KEYCLOAK_PROVISIONER_CLIENT_SECRET` in the local `app/be/internal-api/.env`; never put it in the frontend, Gateway, or a committed env file.

After updating this env file, run `docker compose up -d --no-deps --force-recreate internal-api` so Docker loads the new value. A plain container restart retains its old environment. After a realm reset, recheck the generated secret, service-account roles, and role scope mappings. A failed client-credentials request indicates an authentication problem; a successful token followed by HTTP 403 on role/user reads indicates missing permissions or role claims. Keycloak's [role resource implementation](https://github.com/keycloak/keycloak/blob/26.7.3/services/src/main/java/org/keycloak/services/resources/admin/RoleContainerResource.java) checks both role-view and user-query permissions when listing role members.

Accounts created through the MIS provisioning endpoint are tagged with the Keycloak user attribute `mis_account_source=AUTOMATIC`. Configure the User Profile in **Realm settings → User Profile → JSON Editor** from `user-profile/mis-student-portal.json`; this declares the allowed values and keeps the field admin-only. The file is kept outside `realm/` so Keycloak's realm importer does not treat it as a realm. When an operator creates an account directly in the Keycloak Admin Console, they select `MANUAL` for this attribute. The attribute is provenance metadata, not a role or authorization input. The account remains in Keycloak in both cases. Password assignment/reset is outside this provisioning endpoint and ST-04 scope.

The trusted MIS account endpoint is mounted at `/api/v1/admin/accounts` on the Gateway. `GET` supports `role` (one of the seven business roles), `status=all|enabled|disabled`, `page`, and `pageSize` (1–100); the response includes business roles, enabled status, and source (`UNKNOWN` when Keycloak has no recognized source value). `POST` creates a Keycloak user with the selected business role and source `AUTOMATIC`. Both methods require a valid access token containing `mis-user-provisioner`; this administrative role is separate from the business `activeRole`.

For accounts that already existed before source tracking was enabled, determine their source from reliable creation records before assigning a value. Do not bulk-label unknown historical accounts as manual or automatic by assumption.

## ST-08 access event collection

The realm bootstrap enables selected user authentication/password events and Keycloak admin events without storing full admin-event representations. Those representations are deliberately disabled to avoid copying sensitive request payloads into the audit pipeline. Admin events are required for role assignment and account enable/disable actions.

For an existing realm, startup import does not update event settings or add the audit client. In the Keycloak Admin Console:

1. Enable user events and save the event types listed in `mis-student-portal.json`; retain both user and admin events for at least 400 days so the Internal API can recover after a temporary collection outage.
2. Enable admin-event logging, keep **Include Representation** off, and ensure event reads are enabled.
3. Create/enable the confidential service-account client `mis-audit-reader` if it is not already present. Assign only `realm-management.view-events` to its service account (not `realm-admin` and not `manage-users`).
4. Generate/copy that client secret into `KEYCLOAK_AUDIT_CLIENT_SECRET` in `app/be/internal-api/.env`, set `KEYCLOAK_AUDIT_ENABLED=true`, and keep the secret out of Git.

The Internal API polls Keycloak's Admin REST user-event and admin-event endpoints with an overlap window and idempotency keys. It stores a redacted normalized event in `security_access_log`; raw user-event details and admin representations are not copied. Keycloak event storage is a temporary source buffer; the Internal SQL Server audit tables are the MIS audit source. Do not clear Keycloak events until collection is healthy and verified.
