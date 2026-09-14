import sql from "mssql";

export interface DatabaseTarget {
  host: string;
  port: number;
  password: string;
  database: string;
  enableReadCommittedSnapshot?: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function assertSafeDbName(name: string) {
  if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error(`Unsafe database name: ${name}`);
}

export async function ensureDatabase(target: DatabaseTarget) {
  assertSafeDbName(target.database);
  let pool: sql.ConnectionPool | undefined;

  for (let attempt = 1; attempt <= 60; attempt++) {
    try {
      pool = await new sql.ConnectionPool({
        server: target.host,
        port: target.port,
        user: "sa",
        password: target.password,
        database: "master",
        options: { encrypt: false, trustServerCertificate: true },
      }).connect();
      break;
    } catch {
      console.log(`Waiting for SQL Server ${target.host} (${attempt}/60)`);
      await sleep(2000);
    }
  }

  if (!pool) throw new Error(`Unable to connect to ${target.host}`);

  await pool.request().query(`IF DB_ID(N'${target.database}') IS NULL CREATE DATABASE [${target.database}]`);

  if (target.enableReadCommittedSnapshot) {
    await pool.request().query(`
      IF (SELECT is_read_committed_snapshot_on FROM sys.databases WHERE name = '${target.database}') = 0
      ALTER DATABASE [${target.database}] SET READ_COMMITTED_SNAPSHOT ON
    `);
  }

  await pool.close();
  console.log(`${target.database} ready`);
}
