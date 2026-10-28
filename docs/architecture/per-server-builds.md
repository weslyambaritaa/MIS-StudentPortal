# Build per server

The repository provides two build-only commands:

- `npm run build:student` builds `@mis/student-frontend` and `@mis/student-api`, plus their workspace dependencies.
- `npm run build:internal` builds `@mis/internal-frontend`, `@mis/internal-api`, and `@mis/gateway`, plus their workspace dependencies.

Both commands use Turborepo's `build` task and the dependency graph in `turbo.json`. They build from the checked-out source in the current repository; they do not deploy services or run database migrations.

For releases to separate servers, check out the same Git commit SHA on both servers before building. For example:

```sh
git checkout <release-commit-sha>
npm ci
npm run build:student
```

Run the same checkout and install steps on the other server, then run `npm run build:internal`. The deployment pipeline should pass one release SHA to both build jobs so the artifacts come from the same source revision.
