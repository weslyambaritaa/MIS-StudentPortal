import { Router } from "express";
import { isBusinessRole } from "@mis/shared-types";
import { asyncHandler } from "../../utils/async-handler";
import { KeycloakProvisioningError, keycloakAccountProvisioner } from "./keycloak-account-provisioner";

export const accountProvisioningRouter = Router();

function positiveInteger(value: unknown, fallback: number, maximum: number): number | null {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : null;
}

accountProvisioningRouter.get("/", asyncHandler(async (req, res) => {
  const roleValue = req.query.role;
  if (roleValue !== undefined && (typeof roleValue !== "string" || !isBusinessRole(roleValue))) {
    return res.status(400).json({ message: "Unknown business role filter" });
  }

  const statusValue = req.query.status ?? "all";
  if (typeof statusValue !== "string" || !["all", "enabled", "disabled"].includes(statusValue)) {
    return res.status(400).json({ message: "Status must be all, enabled, or disabled" });
  }

  const page = positiveInteger(req.query.page, 1, 1_000_000);
  const pageSize = positiveInteger(req.query.pageSize, 25, 100);
  if (page === null || pageSize === null) {
    return res.status(400).json({ message: "Invalid pagination; page must be positive and pageSize must be between 1 and 100" });
  }

  const result = await keycloakAccountProvisioner.listAccounts({
    ...(typeof roleValue === "string" ? { role: roleValue } : {}),
    status: statusValue as "all" | "enabled" | "disabled",
    page,
    pageSize,
  });
  return res.json(result);
}));

accountProvisioningRouter.post("/", asyncHandler(async (req, res) => {
  const body = req.body as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ message: "Invalid account payload" });
  }
  const { username, email, firstName, lastName, role } = body;
  if (typeof username !== "string" || !username.trim() || username.length > 150) {
    return res.status(400).json({ message: "A valid username is required" });
  }
  if (email !== undefined && (typeof email !== "string" || email.length > 150)) {
    return res.status(400).json({ message: "Invalid email" });
  }
  if (firstName !== undefined && (typeof firstName !== "string" || firstName.length > 150)) {
    return res.status(400).json({ message: "Invalid first name" });
  }
  if (lastName !== undefined && (typeof lastName !== "string" || lastName.length > 150)) {
    return res.status(400).json({ message: "Invalid last name" });
  }
  if (!isBusinessRole(role)) return res.status(400).json({ message: "A valid business role is required" });

  const result = await keycloakAccountProvisioner.createAccount({
    username: username.trim(),
    ...(typeof email === "string" ? { email: email.trim() } : {}),
    ...(typeof firstName === "string" ? { firstName: firstName.trim() } : {}),
    ...(typeof lastName === "string" ? { lastName: lastName.trim() } : {}),
    role,
  }).catch((error: unknown) => {
    if (error instanceof KeycloakProvisioningError) throw error;
    throw new KeycloakProvisioningError("Keycloak account provisioning failed");
  });

  return res.status(201).json({ account: result });
}));
