// Centralized authorization — THE security layer.
//
// We have no Postgres RLS, so every DB access must pass through an explicit
// check defined HERE. Authorization rules must not be scattered across route
// handlers. No route handler may query the DB without calling into this module.
//
// SERVER-ONLY. See docs/ARCHITECTURE.md §"Authorization".
//
// TODO(scaffold): implement real checks once auth + schema land. The shapes
// below define the intended contract.

export interface Actor {
  userId: string;
  roles: string[];
  areaIds: string[];
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Throws ForbiddenError if `actor` may not perform `action` on `resource`. */
export function assertCan(
  _actor: Actor,
  _action: string,
  _resource?: { areaId?: string; ownerId?: string }
): void {
  // TODO(scaffold): replace with the real policy. Deny-by-default once wired.
  throw new ForbiddenError("Authorization not implemented (scaffold)");
}
