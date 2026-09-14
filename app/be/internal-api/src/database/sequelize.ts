import { Sequelize } from "sequelize";
import { env } from "../config/env";
export const sequelize = new Sequelize({
  dialect: "mssql", host: env.dbHost, port: env.dbPort, database: env.dbName, username: env.dbUser, password: env.dbPassword,
  dialectOptions: { options: { encrypt: env.dbEncrypt, trustServerCertificate: env.dbTrustServerCertificate } },
  logging: env.nodeEnv === "development" ? console.log : false,
});
