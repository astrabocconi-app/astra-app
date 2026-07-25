// Centralized authorization — THE security layer.
//
// We have no Postgres RLS, so every DB access must pass through an explicit
// check defined HERE. No route handler may query the DB for a protected
// resource without calling into this module. Deny-by-default.
//
// SERVER-ONLY. See docs/ARCHITECTURE.md §"Authorization".

export interface Actor {
  userId: string;
  roles: string[];
  areaIds: string[];
}

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function hasRole(actor: Actor, role: string): boolean {
  return actor.roles.includes(role);
}

export function isAdmin(actor: Actor): boolean {
  return hasRole(actor, "ADMIN");
}

/** Can the actor manage content in this area? */
export function canManageArea(actor: Actor, areaId?: string): boolean {
  if (isAdmin(actor)) return true;
  if (!areaId) return false;
  return hasRole(actor, "AREA_MANAGER") && actor.areaIds.includes(areaId);
}

/**
 * Throws ForbiddenError if `actor` may not perform `action` on `resource`.
 * Deny-by-default: unknown actions are denied. Feature phases extend the
 * `switch` with their concrete rules; every rule lives here, never in routes.
 */
export function assertCan(
  actor: Actor,
  action: string,
  resource?: { areaId?: string; ownerId?: string }
): void {
  // Admins bypass all checks.
  if (isAdmin(actor)) return;

  switch (action) {
    // A user may always read/act on their own resource.
    case "self:read":
    case "self:write":
      if (resource?.ownerId && resource.ownerId === actor.userId) return;
      break;

    // Area managers can manage content scoped to areas they belong to.
    case "content:create":
    case "content:update":
    case "content:delete":
      if (canManageArea(actor, resource?.areaId)) return;
      break;

    // Staff can operate scanners (event check-in, partner card scan).
    case "scan:operate":
      if (hasRole(actor, "STAFF") || hasRole(actor, "AREA_MANAGER")) return;
      break;

    default:
      break;
  }

  throw new ForbiddenError(`Not allowed: ${action}`);
}
