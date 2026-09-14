import "dotenv/config";
import { ensureDatabase } from "./database";

async function main() {
  await ensureDatabase({
    host: process.env.INTERNAL_DB_HOST!,
    port: Number(process.env.INTERNAL_DB_PORT_INTERNAL ?? 1433),
    password: process.env.INTERNAL_DB_SA_PASSWORD!,
    database: process.env.INTERNAL_DB_NAME!,
  });

  await ensureDatabase({
    host: process.env.KEYCLOAK_DB_HOST!,
    port: Number(process.env.KEYCLOAK_DB_PORT_INTERNAL ?? 1433),
    password: process.env.KEYCLOAK_DB_SA_PASSWORD!,
    database: process.env.KEYCLOAK_DB_NAME!,
    enableReadCommittedSnapshot: true,
  });
}

main().then(() => console.log("Database bootstrap completed.")).catch((error) => { console.error(error); process.exit(1); });
