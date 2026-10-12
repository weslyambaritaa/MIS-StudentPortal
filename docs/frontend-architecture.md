# Frontend Architecture Baseline (EN-05)

## Project structure

- `app/fe/src/app`: Next.js App Router pages; keep route files thin and compose feature UI from them.
- `app/fe/src/ui/<role>/<feature>`: role/feature-specific page UI and dialogs.
- `app/fe/src/components/ui`: reusable design-system primitives shared by features.
- `app/fe/src/components/layout`: application shell, navbar, and sidebar.
- `app/fe/src/config/navigation.ts`: centralized active-role navigation and allowed-route registry.
- `app/fe/src/lib`: framework-independent auth, routing, and API helpers.
- `app/fe/src/providers`: application-wide React Context providers.

## Routing by active role

Next.js App Router owns URL resolution. The centralized navigation registry lists routes allowed for each business `activeRole`; `ActiveRoleRouteGuard` uses it for frontend UX protection and redirects an unauthorized registered route to the active role's dashboard. The backend remains the security authority.

Only routes backed by real pages should be added to the registry. At this foundation stage, Dashboard and the component showcase are shared by the business roles. Role-specific business routes are added when their feature pages exist. The route-access helper has automated tests for allowed, denied, nested, and unknown routes.

## State management

- React Context (`KeycloakAuthProvider`) owns cross-application authentication state: available business roles and active role.
- Component `useState` (or `useReducer` for a complex local flow) owns transient UI state such as open dialogs, field values, and collapsible navigation.
- Put shareable navigation state such as search, filters, and pagination in URL search parameters when appropriate.
- Do not add a global client store until a real cross-feature client-state need appears.
- The existing API hook/client sends requests but does not implement server-data cache or synchronization. Revisit a server-state library such as TanStack Query when feature APIs need caching, invalidation, retries, or coordinated refetching.

## Design system

Reusable design primitives are implemented under `src/components/ui` and demonstrated in `/components-preview`. Color and typography references are in `docs/design-system.md`; Figma token values absent from the export remain subject to design confirmation.
