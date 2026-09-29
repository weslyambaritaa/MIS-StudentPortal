import type { Role } from "./role";

export interface AuthContext {
  userId: string;
  email?: string;
  roles: Role[];
  /** Absent until an active role has been selected and validated. */
  activeRole?: Role;
}

/** Context after the active role has been selected and validated. */
export type ActiveRoleAuthContext = AuthContext & { activeRole: Role };
