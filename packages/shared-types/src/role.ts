export const ROLES = { STUDENT:"student", PIC:"pic", TRAINER:"trainer", SALES:"sales", ADMIN:"admin", SUPER_ADMIN:"super_admin", FINANCE:"finance", MANAGEMENT:"management" } as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];
