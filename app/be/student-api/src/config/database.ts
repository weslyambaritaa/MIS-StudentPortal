import { env } from "./env";
export const databaseConfig = {
  host: env.dbHost,
  port: env.dbPort,
  database: env.dbName,
  username: env.dbUser,
};
