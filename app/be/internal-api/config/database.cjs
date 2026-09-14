module.exports = {
  development: {
    dialect: "mssql",
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    dialectOptions: { options: { encrypt: process.env.DB_ENCRYPT === "true", trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true" } }
  }
};
