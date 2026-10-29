export type UserRole = "customer" | "staff" | "admin" | "owner";

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  storeId?: string;
}

export class AuthorizationError extends Error {
  constructor(message = "Unauthorized access") {
    super(message);
    this.name = "AuthorizationError";
  }
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  customer: 10,
  staff: 20,
  admin: 30,
  owner: 40,
};

export function assertRole(
  user: SessionUser | null | undefined,
  minimumRole: UserRole,
): asserts user is SessionUser {
  if (!user) {
    throw new AuthorizationError("Authentication required");
  }

  const userRank = ROLE_HIERARCHY[user.role] ?? 0;
  const requiredRank = ROLE_HIERARCHY[minimumRole] ?? 0;

  if (userRank < requiredRank) {
    throw new AuthorizationError(`Insufficient permissions: requires ${minimumRole} role`);
  }
}

export function assertStoreAccess(user: SessionUser, targetStoreId: string): void {
  if (user.role === "owner") {
    return;
  }
  if (user.storeId !== targetStoreId) {
    throw new AuthorizationError("Access denied for specified store context");
  }
}
