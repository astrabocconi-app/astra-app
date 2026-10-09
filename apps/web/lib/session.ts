// Resolve the authenticated actor from a request, for use in route handlers.
//
// SERVER-ONLY. The Actor (id + roles + areas) is what lib/authz.ts checks.

import { prisma } from "@astra/db";
import { auth } from "./auth";
import { type Actor, UnauthorizedError } from "./authz";
import { setRequestUser } from "./api";
import { backofficeSessionExpired } from "./session-policy";

export interface SessionUser {
  actor: Actor;
  user: {
    id: string;
    email: string;
    name: string | null;
    /** Better Auth's image field; we keep a DiceBear avatar seed there (see @astra/shared avatar). */
    image: string | null;
    roles: string[];
    /** Dashboard pages this account may open. Ignored for admins. */
    dashboardPages: string[];
    /** Set for backoffice staff accounts; null for students and the admin. */
    staffUsername: string | null;
  };
}

interface RawUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  roles?: string[] | null;
  dashboardPages?: string[] | null;
  staffUsername?: string | null;
  deletedAt?: Date | string | null;
}

/** Resolve the current user + actor, or null if not authenticated. */
export async function getSessionUser(
  reqHeaders: Headers
): Promise<SessionUser | null> {
  const found = await auth.api.getSession({ headers: reqHeaders });
  if (!found?.user) return null;

  // Better Auth already loaded the user row; the extra columns we need (roles,
  // dashboard pages, soft-delete flag) are declared as additionalFields, so no
  // second read is needed. Fall back to one only if they are somehow absent.
  let user = found.user as unknown as RawUser;
  if (!Array.isArray(user.roles)) {
    const row = await prisma.user.findUnique({
      where: { id: found.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        roles: true,
        dashboardPages: true,
        staffUsername: true,
        deletedAt: true,
      },
    });
    if (!row) return null;
    user = row;
  }
  if (user.deletedAt) return null;
  const roles = user.roles ?? [];

  if (backofficeSessionExpired(roles, found.session.createdAt)) {
    await prisma.session.deleteMany({ where: { id: found.session.id } });
    return null;
  }

  // Area scoping is only meaningful for area managers; everyone else skips the query.
  const areaIds = roles.includes("AREA_MANAGER")
    ? (await prisma.areaMembership.findMany({ where: { userId: user.id }, select: { areaId: true } })).map(
        (m) => m.areaId,
      )
    : [];

  setRequestUser(user.id);
  return {
    actor: { userId: user.id, roles, areaIds },
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null,
      roles,
      dashboardPages: user.dashboardPages ?? [],
      staffUsername: user.staffUsername ?? null,
    },
  };
}

/** Like getSessionUser but throws UnauthorizedError when not signed in. */
export async function requireSessionUser(reqHeaders: Headers): Promise<SessionUser> {
  const result = await getSessionUser(reqHeaders);
  if (!result) throw new UnauthorizedError();
  return result;
}
