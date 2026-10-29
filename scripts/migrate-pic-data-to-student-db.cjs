#!/usr/bin/env node
const { Pool } = require("pg");
require("dotenv").config({ path: process.env.PIC_DATA_MIGRATION_ENV });

function connection(prefix) {
  const names = ["HOST", "PORT", "NAME", "USER", "PASSWORD"];
  const values = Object.fromEntries(names.map((key) => [key, process.env[`${prefix}_DB_${key}`]]));
  const missing = Object.entries(values).filter(([key, value]) => key !== "PORT" && !value).map(([key]) => `${prefix}_DB_${key}`);
  if (missing.length) throw new Error(`Missing database configuration: ${missing.join(", ")}`);
  return { host: values.HOST, port: Number(values.PORT || 5432), database: values.NAME, user: values.USER, password: values.PASSWORD, ssl: process.env[`${prefix}_DB_SSL`] === "true" ? { rejectUnauthorized: process.env[`${prefix}_DB_SSL_REJECT_UNAUTHORIZED`] !== "false" } : undefined };
}

async function main() {
  if (process.env.CONFIRM_PIC_DATA_COPY !== "YES") throw new Error("Set CONFIRM_PIC_DATA_COPY=YES after backing up both databases and applying the Student API migration.");
  const source = new Pool(connection("SOURCE"));
  const target = new Pool(connection("TARGET"));
  try {
    const [{ rows: profiles }, { rows: assignments }] = await Promise.all([
      source.query("SELECT id,keycloak_subject,name,email,status,activation_expires_at,position,created_at,updated_at FROM pic_profile ORDER BY id"),
      source.query("SELECT id,pic_profile_id,account_id,assigned_at,ended_at,assigned_by_subject,ended_by_subject,created_at,updated_at FROM pic_account_assignment ORDER BY id"),
    ]);
    const profileIds = new Set(profiles.map((row) => row.id));
    const orphaned = assignments.filter((row) => !profileIds.has(row.pic_profile_id));
    if (orphaned.length) throw new Error(`Found ${orphaned.length} PIC assignments without a profile; no data was copied.`);

    const client = await target.connect();
    try {
      await client.query("BEGIN");
      for (const row of profiles) {
        await client.query(
          `INSERT INTO pic_profile (id,keycloak_subject,name,email,status,activation_expires_at,position,created_at,updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (id) DO UPDATE SET keycloak_subject=EXCLUDED.keycloak_subject,name=EXCLUDED.name,email=EXCLUDED.email,status=EXCLUDED.status,activation_expires_at=EXCLUDED.activation_expires_at,position=EXCLUDED.position,updated_at=EXCLUDED.updated_at`,
          [row.id, row.keycloak_subject, row.name, row.email, row.status, row.activation_expires_at, row.position, row.created_at, row.updated_at],
        );
      }
      for (const row of assignments) {
        await client.query(
          `INSERT INTO pic_account_assignment (id,pic_profile_id,account_id,assigned_at,ended_at,assigned_by_subject,ended_by_subject,created_at,updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (id) DO UPDATE SET pic_profile_id=EXCLUDED.pic_profile_id,account_id=EXCLUDED.account_id,assigned_at=EXCLUDED.assigned_at,ended_at=EXCLUDED.ended_at,assigned_by_subject=EXCLUDED.assigned_by_subject,ended_by_subject=EXCLUDED.ended_by_subject,updated_at=EXCLUDED.updated_at`,
          [row.id, row.pic_profile_id, row.account_id, row.assigned_at, row.ended_at, row.assigned_by_subject, row.ended_by_subject, row.created_at, row.updated_at],
        );
      }
      const copiedProfiles = await client.query("SELECT count(*)::int AS count FROM pic_profile");
      const copiedAssignments = await client.query("SELECT count(*)::int AS count FROM pic_account_assignment");
      if (copiedProfiles.rows[0].count < profiles.length || copiedAssignments.rows[0].count < assignments.length) throw new Error("Student database counts are lower than the source counts.");
      await client.query("COMMIT");
      console.info(`PIC data copied. Source profiles: ${profiles.length}; source assignments: ${assignments.length}.`);
      console.info(`Student DB totals now: profiles ${copiedProfiles.rows[0].count}; assignments ${copiedAssignments.rows[0].count}.`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await Promise.all([source.end(), target.end()]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "PIC data copy failed");
  process.exitCode = 1;
});
