import { ACCOUNT_SOURCES, BUSINESS_ROLES, isAccountSource, isBusinessRole, type AccountSource, type BusinessRole } from "@mis/shared-types";
import { env } from "../../config/env";
import { AppError } from "../../errors/app-error";

export interface CreateKeycloakAccountInput {
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role: BusinessRole;
}

export interface KeycloakAccountResult {
  userId: string;
  username: string;
  email?: string;
  role: BusinessRole;
  enabled: true;
  source: typeof ACCOUNT_SOURCES.AUTOMATIC;
}

export interface ListKeycloakAccountsInput {
  role?: BusinessRole;
  status: "all" | "enabled" | "disabled";
  page: number;
  pageSize: number;
}

export interface ListedKeycloakAccount {
  userId: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  roles: BusinessRole[];
  source: AccountSource | "UNKNOWN";
}

export interface KeycloakDirectoryUser {
  userId: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
}

export interface ListedKeycloakAccountsPage {
  accounts: ListedKeycloakAccount[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

type KeycloakUser = {
  id?: unknown;
  username?: unknown;
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  enabled?: unknown;
  requiredActions?: unknown;
  emailVerified?: unknown;
  credentials?: unknown;
  attributes?: Record<string, unknown>;
};

export class KeycloakProvisioningError extends AppError {
  constructor(message: string, statusCode = 502) {
    super(statusCode, message);
    this.name = "KeycloakProvisioningError";
  }
}

type ProvisionerConfig = {
  baseUrl: string;
  realm: string;
  clientId: string;
  clientSecret?: string;
};

export class KeycloakAccountProvisioner {
  constructor(
    private readonly config: ProvisionerConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private get realmAdminBase() {
    return `${this.config.baseUrl.replace(/\/$/, "")}/admin/realms/${encodeURIComponent(this.config.realm)}`;
  }

  private async accessToken(): Promise<string> {
    if (!this.config.clientSecret) {
      throw new KeycloakProvisioningError("Keycloak account provisioning is not configured", 503);
    }
    const tokenUrl = `${this.config.baseUrl.replace(/\/$/, "")}/realms/${encodeURIComponent(this.config.realm)}/protocol/openid-connect/token`;
    const form = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });
    const response = await this.fetchImpl(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!response.ok) throw new KeycloakProvisioningError("Unable to authenticate with Keycloak Admin API");
    const payload = await response.json() as { access_token?: unknown };
    if (typeof payload.access_token !== "string" || payload.access_token.length === 0) {
      throw new KeycloakProvisioningError("Keycloak returned an invalid service token");
    }
    return payload.access_token;
  }

  private async getJson<T>(token: string, url: string, message: string): Promise<T> {
    const response = await this.fetchImpl(url, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) throw new KeycloakProvisioningError(message);
    return response.json() as Promise<T>;
  }

  private getAccountSource(user: KeycloakUser): AccountSource | "UNKNOWN" {
    const raw = user.attributes?.mis_account_source;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return isAccountSource(value) ? value : "UNKNOWN";
  }

  private toListedAccount(user: KeycloakUser, roles: BusinessRole[]): ListedKeycloakAccount {
    if (typeof user.id !== "string" || typeof user.username !== "string" || typeof user.enabled !== "boolean") {
      throw new KeycloakProvisioningError("Keycloak returned an incomplete user record");
    }
    return {
      userId: user.id,
      username: user.username,
      ...(typeof user.email === "string" ? { email: user.email } : {}),
      ...(typeof user.firstName === "string" ? { firstName: user.firstName } : {}),
      ...(typeof user.lastName === "string" ? { lastName: user.lastName } : {}),
      enabled: user.enabled,
      roles,
      source: this.getAccountSource(user),
    };
  }

  private async getRoleMembers(token: string, role: BusinessRole): Promise<KeycloakUser[]> {
    const members: KeycloakUser[] = [];
    const batchSize = 100;
    for (let first = 0; ; first += batchSize) {
      const url = `${this.realmAdminBase}/roles/${encodeURIComponent(role)}/users?first=${first}&max=${batchSize}&briefRepresentation=false`;
      const batch = await this.getJson<KeycloakUser[]>(token, url, "Unable to retrieve Keycloak role members");
      if (!Array.isArray(batch)) throw new KeycloakProvisioningError("Keycloak returned an invalid role member list");
      members.push(...batch);
      if (batch.length < batchSize) return members;
    }
  }

  /** Minimal identity directory for domain pickers; Keycloak remains the identity/role source. */
  async listRoleMembers(role: BusinessRole, includeDisabled = false): Promise<KeycloakDirectoryUser[]> {
    const token = await this.accessToken();
    return (await this.getRoleMembers(token, role))
      .filter((user): user is KeycloakUser & { id: string; username: string; enabled: boolean } =>
        typeof user.id === "string" && typeof user.username === "string" && typeof user.enabled === "boolean")
      .filter((user) => includeDisabled || user.enabled)
      .map((user) => ({
        userId: user.id,
        username: user.username,
        ...(typeof user.email === "string" ? { email: user.email } : {}),
        ...(typeof user.firstName === "string" ? { firstName: user.firstName } : {}),
        ...(typeof user.lastName === "string" ? { lastName: user.lastName } : {}),
        enabled: user.enabled,
      }));
  }

  async listAccounts(input: ListKeycloakAccountsInput): Promise<ListedKeycloakAccountsPage> {
    const token = await this.accessToken();
    const batchSize = 100;
    let users: KeycloakUser[];

    if (input.role) {
      users = await this.getRoleMembers(token, input.role);
      if (input.status !== "all") {
        const expectedEnabled = input.status === "enabled";
        users = users.filter((user) => user.enabled === expectedEnabled);
      }
    } else {
      const query = new URLSearchParams({ first: "0", max: String(batchSize), briefRepresentation: "false" });
      if (input.status !== "all") query.set("enabled", String(input.status === "enabled"));
      users = await this.getJson<KeycloakUser[]>(token, `${this.realmAdminBase}/users?${query}`, "Unable to retrieve Keycloak users");
      if (!Array.isArray(users)) throw new KeycloakProvisioningError("Keycloak returned an invalid user list");

      // The user endpoint is paginated; read subsequent pages so the response total is exact.
      for (let first = batchSize; ; first += batchSize) {
        const pageQuery = new URLSearchParams({ first: String(first), max: String(batchSize), briefRepresentation: "false" });
        if (input.status !== "all") pageQuery.set("enabled", String(input.status === "enabled"));
        const batch = await this.getJson<KeycloakUser[]>(token, `${this.realmAdminBase}/users?${pageQuery}`, "Unable to retrieve Keycloak users");
        if (!Array.isArray(batch)) throw new KeycloakProvisioningError("Keycloak returned an invalid user list");
        users.push(...batch);
        if (batch.length < batchSize) break;
      }
    }

    const normalized = users
      .filter((user) => typeof user.id === "string")
      .sort((left, right) => String(left.username ?? "").localeCompare(String(right.username ?? ""), undefined, { sensitivity: "base" }))
      .map((user) => this.toListedAccount(user, []));

    // Populate only the canonical MIS business roles. Keycloak infrastructure roles are never exposed as business roles.
    const selected = normalized.slice((input.page - 1) * input.pageSize, input.page * input.pageSize);
    const accounts = await Promise.all(selected.map(async (account) => {
      const mappings = await this.getJson<Array<{ name?: unknown }>>(
        token,
        `${this.realmAdminBase}/users/${encodeURIComponent(account.userId)}/role-mappings/realm/composite`,
        "Unable to retrieve Keycloak account roles",
      );
      if (!Array.isArray(mappings)) throw new KeycloakProvisioningError("Keycloak returned invalid account role mappings");
      const roles = BUSINESS_ROLES.filter((role) => mappings.some((mapping) => mapping?.name === role));
      return { ...account, roles };
    }));

    const total = normalized.length;
    return {
      accounts,
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.ceil(total / input.pageSize),
    };
  }

  async createAccount(input: CreateKeycloakAccountInput): Promise<KeycloakAccountResult> {
    if (!isBusinessRole(input.role)) throw new KeycloakProvisioningError("Unknown business role", 400);
    const token = await this.accessToken();
    const roleResponse = await this.fetchImpl(
      `${this.realmAdminBase}/roles/${encodeURIComponent(input.role)}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    if (!roleResponse.ok) throw new KeycloakProvisioningError("Unable to resolve the requested Keycloak role");
    const roleRepresentation = await roleResponse.json();

    const createResponse = await this.fetchImpl(`${this.realmAdminBase}/users`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        username: input.username,
        ...(input.email ? { email: input.email } : {}),
        ...(input.firstName ? { firstName: input.firstName } : {}),
        ...(input.lastName ? { lastName: input.lastName } : {}),
        enabled: true,
        attributes: { mis_account_source: [ACCOUNT_SOURCES.AUTOMATIC] },
      }),
    });
    if (createResponse.status === 409) throw new KeycloakProvisioningError("A Keycloak account with this username or email already exists", 409);
    if (createResponse.status !== 201) throw new KeycloakProvisioningError("Keycloak could not create the account");

    const location = createResponse.headers.get("location");
    const userId = location?.split("/").filter(Boolean).at(-1);
    if (!userId) throw new KeycloakProvisioningError("Keycloak created the account without returning its identity");

    try {
      const mappingResponse = await this.fetchImpl(
        `${this.realmAdminBase}/users/${encodeURIComponent(userId)}/role-mappings/realm`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify([roleRepresentation]),
        },
      );
      if (!mappingResponse.ok) throw new KeycloakProvisioningError("Keycloak could not assign the requested business role");
    } catch (error) {
      // Compensate so a failed role assignment does not leave a partially provisioned account.
      await this.fetchImpl(`${this.realmAdminBase}/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      }).catch(() => undefined);
      throw error;
    }

    return {
      userId,
      username: input.username,
      ...(input.email ? { email: input.email } : {}),
      role: input.role,
      enabled: true,
      source: ACCOUNT_SOURCES.AUTOMATIC,
    };
  }

  private async getUserRepresentation(userId: string, token?: string): Promise<KeycloakUser> {
    const accessToken = token ?? await this.accessToken();
    return this.getJson<KeycloakUser>(accessToken, `${this.realmAdminBase}/users/${encodeURIComponent(userId)}`, "Unable to retrieve Keycloak user");
  }

  async findUsersByEmail(email: string): Promise<KeycloakDirectoryUser[]> {
    const token = await this.accessToken();
    const query = new URLSearchParams({ email, exact: "true", max: "100" });
    const users = await this.getJson<KeycloakUser[]>(token, `${this.realmAdminBase}/users?${query}`, "Unable to search Keycloak users by email");
    if (!Array.isArray(users)) throw new KeycloakProvisioningError("Keycloak returned an invalid user search result");
    return users.filter((user): user is KeycloakUser & { id: string; username: string; enabled: boolean } =>
      typeof user.id === "string" && typeof user.username === "string" && typeof user.enabled === "boolean")
      .map((user) => ({ userId: user.id, username: user.username, ...(typeof user.email === "string" ? { email: user.email } : {}), ...(typeof user.firstName === "string" ? { firstName: user.firstName } : {}), ...(typeof user.lastName === "string" ? { lastName: user.lastName } : {}), enabled: user.enabled }));
  }

  async findUsersByEmails(emails: string[]): Promise<Set<string>> {
    const token = await this.accessToken();
    const existing = new Set<string>();
    const uniqueEmails = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
    for (let index = 0; index < uniqueEmails.length; index += 20) {
      const batch = uniqueEmails.slice(index, index + 20);
      const results = await Promise.all(batch.map(async (email) => {
        const query = new URLSearchParams({ email, exact: "true", max: "100" });
        const users = await this.getJson<KeycloakUser[]>(token, `${this.realmAdminBase}/users?${query}`, "Unable to search Keycloak users by email");
        if (!Array.isArray(users)) throw new KeycloakProvisioningError("Keycloak returned an invalid user search result");
        return users.some((user) => typeof user.email === "string" && user.email.trim().toLowerCase() === email) ? email : null;
      }));
      results.forEach((email) => { if (email) existing.add(email); });
    }
    return existing;
  }

  async getIdentity(userId: string): Promise<KeycloakDirectoryUser & { requiredActions: string[] }> {
    const user = await this.getUserRepresentation(userId);
    if (typeof user.id !== "string" || typeof user.username !== "string" || typeof user.enabled !== "boolean") {
      throw new KeycloakProvisioningError("Keycloak returned an incomplete user record");
    }
    const actions = Array.isArray(user.requiredActions) ? user.requiredActions.filter((action): action is string => typeof action === "string") : [];
    return { userId: user.id, username: user.username, ...(typeof user.email === "string" ? { email: user.email } : {}), ...(typeof user.firstName === "string" ? { firstName: user.firstName } : {}), ...(typeof user.lastName === "string" ? { lastName: user.lastName } : {}), enabled: user.enabled, requiredActions: actions };
  }

  async getBusinessRoles(userId: string): Promise<BusinessRole[]> {
    const token = await this.accessToken();
    const mappings = await this.getJson<Array<{ name?: unknown }>>(
      token,
      `${this.realmAdminBase}/users/${encodeURIComponent(userId)}/role-mappings/realm/composite`,
      "Unable to retrieve Keycloak account roles",
    );
    if (!Array.isArray(mappings)) throw new KeycloakProvisioningError("Keycloak returned invalid account role mappings");
    return BUSINESS_ROLES.filter((role) => mappings.some((mapping) => mapping?.name === role));
  }

  async updateIdentity(userId: string, input: { username: string; email: string; firstName: string; lastName: string }): Promise<void> {
    const token = await this.accessToken();
    const existing = await this.getUserRepresentation(userId, token);
    const response = await this.fetchImpl(`${this.realmAdminBase}/users/${encodeURIComponent(userId)}`, {
      method: "PUT", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ ...existing, ...input }),
    });
    if (response.status === 409) throw new KeycloakProvisioningError("A Keycloak account with this username or email already exists", 409);
    if (!response.ok) throw new KeycloakProvisioningError("Unable to update the Keycloak PIC identity");
  }

  async setRequiredActions(userId: string, requiredActions: string[]): Promise<void> {
    const token = await this.accessToken();
    const user = await this.getUserRepresentation(userId, token);
    const response = await this.fetchImpl(`${this.realmAdminBase}/users/${encodeURIComponent(userId)}`, {
      method: "PUT", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ ...user, requiredActions }),
    });
    if (!response.ok) throw new KeycloakProvisioningError("Unable to update Keycloak required actions");
  }

  async sendRequiredActionsEmail(userId: string, actions: string[], lifespanSeconds: number, clientId?: string, redirectUri?: string): Promise<void> {
    const token = await this.accessToken();
    const query = new URLSearchParams({ lifespan: String(lifespanSeconds) });
    if (clientId) query.set("client_id", clientId);
    if (redirectUri) query.set("redirect_uri", redirectUri);
    const url = `${this.realmAdminBase}/users/${encodeURIComponent(userId)}/execute-actions-email?${query}`;
    const response = await this.fetchImpl(url, {
      method: "PUT", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(actions),
    });
    if (!response.ok) throw new KeycloakProvisioningError("Unable to send the Keycloak PIC activation email");
  }

  async setBusinessRole(userId: string, role: BusinessRole, enabled: boolean): Promise<void> {
    const token = await this.accessToken();
    const roleResponse = await this.fetchImpl(`${this.realmAdminBase}/roles/${encodeURIComponent(role)}`, { headers: { authorization: `Bearer ${token}` } });
    if (!roleResponse.ok) throw new KeycloakProvisioningError("Unable to resolve the requested Keycloak role");
    const roleRepresentation = await roleResponse.json();
    const response = await this.fetchImpl(`${this.realmAdminBase}/users/${encodeURIComponent(userId)}/role-mappings/realm`, {
      method: enabled ? "POST" : "DELETE", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify([roleRepresentation]),
    });
    if (!response.ok) throw new KeycloakProvisioningError(`Unable to ${enabled ? "assign" : "remove"} the Keycloak ${role} role`);
  }

  async deleteAccount(userId: string): Promise<void> {
    const token = await this.accessToken();
    const response = await this.fetchImpl(`${this.realmAdminBase}/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok && response.status !== 404) {
      throw new KeycloakProvisioningError("Unable to delete the Keycloak account");
    }
  }
}

export const keycloakAccountProvisioner = new KeycloakAccountProvisioner({
  baseUrl: env.keycloakUrl,
  realm: env.keycloakRealm,
  clientId: env.keycloakProvisionerClientId,
  clientSecret: env.keycloakProvisionerClientSecret,
});
