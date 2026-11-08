import { AuthorizationError, type SessionUser, type UserRole } from "./guards";

/**
 * Granular administrative permissions across Mercato back-office operations.
 * Single source of truth for all role-based authorization checks.
 */
export const ADMIN_PERMISSIONS = [
  // Products & Catalog
  "products:view",
  "products:manage",

  // Inventory
  "inventory:view",
  "inventory:adjust",

  // Orders & Fulfillment
  "orders:view",
  "orders:fulfill",
  "orders:notes",
  "orders:cancel_unpaid",
  "orders:refund",
  "orders:export",

  // Customers
  "customers:view",
  "customers:manage",

  // Discounts
  "discounts:view",
  "discounts:manage",

  // Analytics & Reporting
  "analytics:view",

  // Store Settings
  "settings:view",
  "settings:manage",

  // Staff & Team Governance
  "staff:view",
  "staff:manage",
  "owner:transfer",

  // Audit Logs
  "audit_log:view",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

/**
 * Single source of truth permission matrix mapping roles to explicit permitted capabilities.
 *
 * Rules:
 * - owner: Full administrative authority over all domains, staff management, and ownership transfer.
 * - admin: Full operational authority across catalog, orders, refunds, discounts, analytics,
 *          settings, and non-owner staff management. Cannot alter or remove owners.
 * - staff: Day-to-day operations: products, inventory adjustments, orders (view, fulfill, internal notes,
 *          cancel unpaid), and customer profiles (read-only). Prohibited from financial refunds,
 *          discount creation, settings alteration, staff management, analytics, and audit logs.
 * - customer: Storefront shopper. Prohibited from all back-office administrative capabilities.
 */
export const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<AdminPermission>> = {
  owner: new Set<AdminPermission>([
    "products:view",
    "products:manage",
    "inventory:view",
    "inventory:adjust",
    "orders:view",
    "orders:fulfill",
    "orders:notes",
    "orders:cancel_unpaid",
    "orders:refund",
    "orders:export",
    "customers:view",
    "customers:manage",
    "discounts:view",
    "discounts:manage",
    "analytics:view",
    "settings:view",
    "settings:manage",
    "staff:view",
    "staff:manage",
    "owner:transfer",
    "audit_log:view",
  ]),

  admin: new Set<AdminPermission>([
    "products:view",
    "products:manage",
    "inventory:view",
    "inventory:adjust",
    "orders:view",
    "orders:fulfill",
    "orders:notes",
    "orders:cancel_unpaid",
    "orders:refund",
    "orders:export",
    "customers:view",
    "customers:manage",
    "discounts:view",
    "discounts:manage",
    "analytics:view",
    "settings:view",
    "settings:manage",
    "staff:view",
    "staff:manage",
    // Note: admin is strictly excluded from "owner:transfer"
    "audit_log:view",
  ]),

  staff: new Set<AdminPermission>([
    "products:view",
    "products:manage",
    "inventory:view",
    "inventory:adjust",
    "orders:view",
    "orders:fulfill",
    "orders:notes",
    "orders:cancel_unpaid",
    // Note: staff cannot issue refunds or exports
    "customers:view", // read-only customer viewing
    // Prohibited from: customers:manage, discounts, analytics, settings, staff, owner:transfer, audit_log:view
  ]),

  customer: new Set<AdminPermission>([]),
};

/**
 * Checks whether a role possesses a specific administrative permission.
 */
export function hasPermission(
  role: UserRole | string | null | undefined,
  permission: AdminPermission,
): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role as UserRole];
  if (!permissions) return false;
  return permissions.has(permission);
}

/**
 * Server-side assertion that throws AuthorizationError if the session user lacks the required permission.
 */
export function assertPermission(
  user: SessionUser | null | undefined,
  permission: AdminPermission,
): asserts user is SessionUser & { role: UserRole } {
  if (!user?.role) {
    throw new AuthorizationError("Authentication required: No active session found");
  }

  const role = user.role as UserRole;
  if (!hasPermission(role, permission)) {
    throw new AuthorizationError(
      `Permission denied: Role '${role}' lacks required permission '${permission}'`,
    );
  }
}

/**
 * Validates staff role modification rules:
 * 1. A user cannot alter their own role.
 * 2. Only an owner can assign or revoke the 'owner' role.
 * 3. Admins cannot modify or disable existing owner accounts.
 * 4. The last owner of a store cannot be demoted or disabled.
 */
export function assertStaffModificationAllowed(params: {
  currentUser: SessionUser;
  targetUserId: string;
  targetUserRole: UserRole;
  newRole?: UserRole;
  ownerCount: number;
}): void {
  const { currentUser, targetUserId, targetUserRole, newRole, ownerCount } = params;

  // Rule 1: A user cannot change their own role
  if (currentUser.id === targetUserId && newRole && newRole !== targetUserRole) {
    throw new AuthorizationError(
      "Security restriction: You cannot modify your own administrative role",
    );
  }

  // Rule 2 & 3: Admin restrictions regarding owners
  if (currentUser.role === "admin") {
    if (targetUserRole === "owner") {
      throw new AuthorizationError(
        "Permission denied: Admins cannot modify, demote, or disable store owners",
      );
    }
    if (newRole === "owner") {
      throw new AuthorizationError(
        "Permission denied: Only store owners can elevate accounts to the owner role",
      );
    }
  }

  // Rule 4: The last owner cannot be demoted or disabled
  if (targetUserRole === "owner" && newRole && newRole !== "owner" && ownerCount <= 1) {
    throw new AuthorizationError(
      "Security restriction: The last store owner cannot be demoted or removed",
    );
  }
}
