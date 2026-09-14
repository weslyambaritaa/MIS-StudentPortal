import { Sequelize } from "sequelize";
import { env } from "../config/env";
export const sequelize = new Sequelize({
  dialect: "postgres",
  host: env.dbHost,
  port: env.dbPort,
  database: env.dbName,
  username: env.dbUser,
  password: env.dbPassword,
  logging: env.nodeEnv === "development" ? console.log : false,
});
