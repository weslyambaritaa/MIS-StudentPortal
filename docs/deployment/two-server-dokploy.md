# Two-server production stacks in Dokploy

Use the Compose files at the repository root as two separate Dokploy Compose applications:

- Server A: `docker-compose.server-a.yml` - Student frontend, Student API, and Student PostgreSQL.
- Server B: `docker-compose.server-b.yml` - MIS frontend, Internal API, internal PostgreSQL, Gateway, Keycloak, Keycloak PostgreSQL, and the system monitor.

Configure the application domains in Dokploy to route to the exposed service ports:

- Server A: Student domain routes to `student-frontend:3000`.
- Server B: MIS domain routes to `frontend:3000`; API and Auth domains route to `api-gateway:4000`.

Both Dokploy hosts need the configured external Docker network (default name `dokploy-network`) for their public routes. Keep each Dokploy stack name stable so Compose keeps using its existing named database volumes when redeployed.

## Local two-stack verification

The root `.env` can provide local values for both Compose files. The existing local Compose application creates `mis-student-portal_edge-net`; set `DOKPLOY_NETWORK_NAME` to that network when running both stacks on the same Docker Desktop host. The local settings use HTTP and separate loopback ports so the regular development application can remain available.

Use stable Compose project names based on the services:

```powershell
docker compose -p student-portal -f docker-compose.server-a.yml config -q
docker compose -p mis-internal -f docker-compose.server-b.yml config -q
docker compose -p student-portal -f docker-compose.server-a.yml --profile migration run --build --rm migrate-student
docker compose -p mis-internal -f docker-compose.server-b.yml --profile migration run --build --rm migrate-internal
docker compose -p student-portal -f docker-compose.server-a.yml up -d --build
docker compose -p mis-internal -f docker-compose.server-b.yml up -d --build
```

The local frontend ports are `3101` (Student Portal) and `3100` (MIS). The local Gateway port is `4100`. The example local private API host ports are `4401` (Student API) and `4402` (Internal API). If the two Compose projects are ever renamed, Docker Compose will use new project-scoped database volumes, so keep these names stable while retaining local data.

## Private connection between A and B

The Student API on A and Internal API on B bind to their respective private host interface IPs. Set those IPs and the opposite server's private URL in the stack environment. Restrict inbound ports 4001 on A and 4002 on B at the provider firewall to the other server's private IP only. Do not publish either database port. The APIs still authenticate service requests with the shared secrets configured on both servers.

This repository does not assume a provider-specific private network. The example addresses in `.env.server-a.example` and `.env.server-b.example` are placeholders; replace them with the private addresses or VPN addresses assigned to A and B. Do not use public addresses for these service URLs.

## Environment

Use `.env.server-a.example` and `.env.server-b.example` as variable checklists. Enter real values in Dokploy's environment settings or in untracked environment files; never commit production secrets. The following must match across both stacks: `GATEWAY_SHARED_SECRET` and `SERVICE_SHARED_SECRET`.

The Student domain is still a deployment decision. Set the same final Student domain in A and B before building: A embeds it through its Keycloak redirect configuration; B uses it for CORS and the PIC activation redirect. Add the final domain to the Keycloak `student-portal-frontend` client's redirect URI and web-origin allowlist before public login testing.

## Separate migration step

Migrations are opt-in Compose services under the `migration` profile. They are not dependencies of the normal `up` services, so an ordinary Dokploy redeploy does not run a database migration automatically.

On A, after setting the real environment and backing up the database, run the one-off migration before deploying the new Student API:

```sh
docker compose --env-file .env.server-a -f docker-compose.server-a.yml --profile migration run --build --rm migrate-student
```

On B, use the separate internal database migration service:

```sh
docker compose --env-file .env.server-b -f docker-compose.server-b.yml --profile migration run --build --rm migrate-internal
```

Then deploy each normal stack from Dokploy without the `migration` profile. Database services use PostgreSQL images and named persistent volumes; Turborepo does not build or manage databases.

For a release, use the same Git commit on both Dokploy applications. Each stack builds from the repository checkout that Dokploy assigns to that deployment.
