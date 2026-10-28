# PIC data ownership cutover

## Target ownership

- Student API and Student PostgreSQL own `pic_profile` and `pic_account_assignment`.
- Internal API and Internal PostgreSQL continue to own Accounts, Quotations, Request Forms, and Trainings. Their `pic_profile_id` columns are logical UUID references to Student API data; they are not cross-database foreign keys.
- Keycloak remains the identity provider. Internal API provisions PIC identities in Keycloak and asks Student API to store the PIC profile and Account assignment.
- Browser requests continue through Gateway. Internal API calls Student API directly using `STUDENT_API_URL` and `SERVICE_SHARED_SECRET`; the Student API endpoint is service-authenticated and is not an end-user route.

## Safe cutover steps

1. Back up both PostgreSQL databases.
2. Apply the Student API migration so the PIC tables exist in Student DB.
3. Run `scripts/migrate-pic-data-to-student-db.cjs` once with `SOURCE_DB_HOST`, `SOURCE_DB_PORT`, `SOURCE_DB_NAME`, `SOURCE_DB_USER`, `SOURCE_DB_PASSWORD` and matching `TARGET_DB_*` variables set. Set `CONFIRM_PIC_DATA_COPY=YES` only after verifying both database host/name values. The script copies UUIDs and timestamps, checks assignment/profile consistency, uses one target transaction, and can be rerun safely.
4. Point Internal API's `STUDENT_API_URL` at Student API on Server A's private network. Keep `SERVICE_SHARED_SECRET` identical on both APIs and do not expose the internal-service endpoint through a public browser route.
5. Apply the Internal API migration that removes only the old foreign keys tying Request Forms and Trainings to the legacy Internal PIC table. It also removes the legacy PIC assignment's Account foreign key so Account deletion remains possible. The legacy profile/assignment tables and their data remain as a rollback reference.
6. Verify PIC list/detail/create/edit/delete, Account PIC summaries, Quotation PIC selection/display, Request Form PIC selection/display, and Training detail/list displays.
7. Keep the old internal PIC tables and their profile-assignment history during the initial verification window. Remove them only in a later, explicitly scheduled cleanup migration after production data and all application paths have been verified.

## Current implementation status

Code ownership and service calls are moved to Student API. The one-time data copy and both migrations have been run against the local Docker databases only. Local verification confirmed matching PIC profile and assignment IDs in both databases, no orphan assignments in Student DB, and a successful service-authenticated PIC list request from Internal API to Student API. Existing Internal DB PIC tables are intentionally retained as a rollback reference during the verification window.

Local database backups made before the cutover are in `.tmp-pic-migration-backup/`. Production was not accessed or changed. Before a production cutover, configure `STUDENT_API_URL` to the Student API private address reachable from the B stack, synchronize the service secret, take production backups, and follow the same ordered migration and verification steps. Remove the legacy Internal DB PIC tables only in a later cleanup migration after production paths are confirmed.
