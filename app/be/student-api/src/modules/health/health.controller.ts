import type { Request, Response } from "express";
import { sequelize } from "../../database/sequelize";
export async function healthCheck(_req: Request, res: Response) {
  try {
    await sequelize.authenticate();
    return res.json({ status: "ok", service: "student-api", database: "connected" });
  } catch {
    return res.status(503).json({ status: "error", service: "student-api", database: "disconnected" });
  }
}
