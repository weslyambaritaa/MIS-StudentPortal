import type { Role } from "./role";
export interface AuthContext { userId: string; email?: string; roles: Role[] | string[]; }
