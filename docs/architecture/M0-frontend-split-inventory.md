# M0 — Frontend split and deployment inventory

**Status:** Completed. Infrastructure details intentionally remain pending for a later milestone.  
**Scope:** Read-only review of the current frontend, role model, API routing, shared packages, and Compose deployment.

## Target agreed so far

- Two frontend applications: Student Portal and MIS Internal. The split is by portal boundary, not one frontend per role.
- Student API and Student database are intended for Server A.
- MIS Internal frontend/API/database, API Gateway, Keycloak, and Keycloak database are intended for Server B.
- Both frontends use the existing MIS Keycloak realm and send browser API requests through the Gateway on B.
- Keep one Git repository and npm workspaces. Build shared packages from the same repository revision on the server building each frontend.
- Build scripts are separate from Dokploy/Compose deployment. Database migrations are separate from frontend/backend build tasks.
- Student domain and private connectivity between A and B remain undecided.

## Current frontend routes

The repository currently has one Next.js workspace, `app/fe`, named `@mis/frontend`. It is a combined role-aware application, not two deployed frontends.

| Current route | Current purpose / access declared in frontend | Proposed portal assignment |
|---|---|---|
| `/` | Redirects to `/dashboard` | Present in both frontends; each redirects to its own portal dashboard |
| `/dashboard` | Shared dashboard route for all seven business roles | Student and PIC versions to Student Portal; Trainer and other roles to MIS Internal |
| `/no-access` | Shared post-login access page | Present in both frontends and may use shared auth UI |
| `/sales/accounts`, `/sales/industry`, `/sales/person-in-charge`, `/sales/quotation`, `/sales/request-form`, `/sales/registration-form` | Sales pages | MIS Internal |
| `/admin/access-logs`, `/admin/audit-trail`, `/admin/course-categories`, `/admin/courses`, `/admin/personal-account-links`, `/admin/request-forms`, `/admin/students`, `/admin/trainers`, `/admin/training-rooms`, `/admin/trainings` | Admin/QPD pages; access logs also has a separate Keycloak admin-role check | MIS Internal |

The navigation registry also declares Student features such as attendance, evaluation, course history, e-learning, remote lab, profile, tests, and learning path. They currently have no implemented routes. Trainer and PIC navigation entries are also mostly marked as coming soon. The only implemented shared page applicable to Student is the generic dashboard; there is no separate Student Portal UI workspace yet.

## Current role model

`packages/shared-types/src/role.ts` declares seven business roles:

- `EXTERNAL_ROLES`: Student, PIC, Trainer
- `INTERNAL_ROLES`: Sales, Admin, Finance, Management

The target portal boundary is now clarified: Student Portal serves Student and PIC; MIS Internal serves Trainer, Sales, Admin, Finance, and Management. The current backend/API boundary differs: `EXTERNAL_ROLES` still includes Trainer, while `INTERNAL_ROLES` does not. This is an existing authorization/routing classification and should not be changed automatically as part of the frontend split.

Frontend route authorization is driven by `app/fe/src/config/navigation.ts` and `app/fe/src/lib/routing/route-access.ts`. The API Gateway independently verifies token and role boundaries; frontend route guards are not the backend authorization boundary.

## Authentication and browser API calls

- One browser Keycloak client is currently configured by `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` (default `mis-student-portal-frontend`).
- `app/fe/src/providers/keycloak-provider.tsx` initializes Keycloak with login-required behavior, selects/records an active business role, and sends Student and Trainer login-sync requests.
- `app/fe/src/lib/api/client.ts` sends the bearer token and `X-Active-Role` to `NEXT_PUBLIC_API_BASE_URL`.
- The Gateway proxies Keycloak `/realms`, `/resources`, and `/admin` paths, and routes `/api/v1/external`, `/api/v1/internal`, and selected admin endpoints.
- Production Compose currently sets one `CORS_ORIGIN` from `APP_DOMAIN` and gives the single frontend one API URL, Keycloak URL, realm, and client ID. A second frontend origin and its Keycloak redirect URI will need explicit configuration.

## API responsibilities

| Service | Current routes/responsibility | Intended server |
|---|---|---|
| Student API | Health endpoint; `/api/v1/external/me` validates/ensures Student identity. Student DB also backs its audit outbox. | A |
| Internal API | Account, Industry, PIC, Quotation, Student management, Course Category, Room, Trainer, Course, Request/Registration Form, review, notification, audit, admin account/access-log routes. Service-only routes ingest audit events and Student login sync. | B |
| API Gateway | Token/role boundary checks, Keycloak proxy, external/internal/admin API proxying, rate limits, CORS, central error monitoring. | B |

Student API currently calls Internal API at `INTERNAL_API_URL` for service-to-service work. Gateway currently resolves Student API at `STUDENT_API_URL`. Those values use Compose service names today; they will need private network URLs or equivalent routing after deployment is split across hosts.

## Current shared workspaces

Root npm workspaces currently include:

- `app/fe` — combined frontend (`@mis/frontend`)
- `app/be/student-api` — Student API
- `app/be/internal-api` — Internal API
- `gateway` — API Gateway
- `packages/shared-types` — used by frontend, APIs, and Gateway
- `packages/logger` — used by APIs and Gateway
- `packages/config` — exists as a workspace; no imports from application source were found during this inventory

There is not yet a shared UI, auth, or browser API-client package. The inventory-level candidates are UI components, Keycloak initialization/auth helpers, browser API client, and shared types. During extraction, only modules actually imported by both portals should move to shared packages. Exact component-by-component extraction is implementation work for the package milestone, not an unresolved M0 boundary.

## Current Compose topology

Both `docker-compose.yml` and `docker-compose.dokploy.yml` currently define one combined stack containing Student DB, Internal DB, Keycloak DB, Keycloak, both migration jobs, Student API, Internal API, system monitor, Gateway, and one frontend service. Production Compose has named volumes for the three databases and no Gateway source bind mount. Docker DNS names such as `student-api`, `internal-api`, and database service names work within this single Compose network topology.

The target two-server layout therefore requires two Compose/Dokploy stacks. Compose bridge networks do not span hosts. The provider/VPN arrangement is unknown; until decided, cross-server URLs, firewall rules, and the required private API ports cannot be finalized. Database ports should remain private to their respective server.

## Deferred infrastructure decisions

1. **Student domain:** Not selected yet, as agreed.
2. **Private A–B connectivity:** Provider private networking or a VPN has not been selected yet, as agreed.

## M0 outcome

The current role-aware frontend, route inventory, auth/API path, shared workspace graph, and combined production Compose topology are documented. Target portal grouping is Student+PIC in Student Portal and Trainer+other internal roles in MIS Internal. The main architectural gap is identified: the current frontend and deployment are still single-app/single-stack, while the target requires two frontend workspaces and two server stacks.
