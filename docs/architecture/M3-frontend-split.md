# M3 — Frontend split

## Workspaces

- `app/student-fe` (`@mis/student-frontend`) is the Student Portal. It accepts only the Student and PIC realm roles and currently contains the dashboard/login shell. Student and PIC feature entries remain disabled as “Coming soon.”
- `app/fe` (`@mis/internal-frontend`) is MIS Internal. It accepts Trainer, Sales, Admin, Finance, and Management. Existing MIS pages, including the Admin access-log route, stay in this application.
- The shared role definitions and backend/API authorization boundaries are unchanged. The Gateway remains the final API authorization boundary.

## Keycloak

Both frontends use the `mis-student-portal` realm and its shared accounts and realm roles. MIS Internal keeps `mis-student-portal-frontend`; Student Portal uses the public client `student-portal-frontend` with PKCE S256. Both client IDs are allowed by Gateway JWT audience validation through `KEYCLOAK_AUDIENCES`.

The realm bootstrap defines both browser clients. For an existing local realm, run `keycloak/scripts/configure-st01.ps1` with `-Apply` to create/configure the Student client and add localhost redirects for both apps. This script operates on the local Keycloak configured by the root `.env`.

## Local development

- MIS Internal: `npm run dev:internal` (port 3000)
- Student Portal: `npm run dev:student` (port 3001)
- Both via Compose: `docker compose up --build`

Both apps call the Gateway at `http://api.localhost:4000`. Local Gateway CORS allows both frontend origins.

## Deferred production settings

The Student production domain is still undecided. Before production login is enabled for Student Portal, add that domain to the Student Keycloak client's redirect URIs and web origins, and add it to `CORS_ORIGINS` for the Gateway. Production deployment remains part of the later server/Compose milestone; this M3 split does not move services between Server A and B.
