// Working out who a push notification should reach. SERVER-ONLY.
//
// Split from lib/push.ts because the interesting part is the query, not the
// transport: a mistake here means hundreds of students get a notification meant
// for a handful, and unlike an email there is no unsend.

import { prisma, Prisma, type Role } from "@astra/db";
import { z } from "zod";

/**
 * Audience filters. Every field is optional and they AND together, so the empty
 * object means "everyone with a device" — which is the common case and is
 * therefore the thing the UI has to make hardest to do by accident.
 */
export const pushAudience = z.object({
  /** Restrict to these roles. Empty/absent = any role. */
  roles: z.array(z.enum(["STUDENT", "STAFF", "AREA_MANAGER", "ADMIN", "PARTNER_MANAGER"])).optional(),
  /** Programme codes, e.g. ["BIEM", "BESS"]. */
  programmeCodes: z.array(z.string().trim().min(1)).optional(),
  /** Study years, 1-5. */
  studyYears: z.array(z.number().int().min(1).max(5)).optional(),
  /** Only people who have set an academic profile at all. */
  hasAcademicProfile: z.boolean().optional(),
  /** Specific users, by id. When set, this alone decides the audience. */
  userIds: z.array(z.string()).optional(),
});
export type PushAudience = z.infer<typeof pushAudience>;

/**
 * Translate filters into a User `where`.
 *
 * Deleted accounts are always excluded: an anonymised user must never be
 * targeted, and their tokens are removed on deletion anyway.
 */
export function audienceWhere(a: PushAudience): Prisma.UserWhereInput {
  // An explicit list of people overrides everything else — if someone picked
  // three names, silently intersecting that with a year filter would send to
  // fewer people than the screen showed.
  if (a.userIds && a.userIds.length > 0) {
    return { id: { in: a.userIds }, deletedAt: null };
  }

  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (a.roles && a.roles.length > 0) where.roles = { hasSome: a.roles as Role[] };

  const profile: Prisma.StudentAcademicProfileWhereInput = {};
  if (a.programmeCodes && a.programmeCodes.length > 0) {
    profile.programme = { code: { in: a.programmeCodes } };
  }
  if (a.studyYears && a.studyYears.length > 0) profile.studyYear = { in: a.studyYears };

  const wantsProfile =
    a.hasAcademicProfile === true || Object.keys(profile).length > 0;
  if (wantsProfile) where.academicProfile = { is: profile };

  return where;
}

export interface AudiencePreview {
  /** People matching the filters, whether or not they have a device. */
  users: number;
  /** People who could actually be reached. */
  reachable: number;
  /** Devices that would receive it (a user may have more than one). */
  devices: number;
}

/**
 * How many people a send would reach, without sending anything.
 *
 * `reachable` is the number that matters and is deliberately shown next to
 * `users`: the gap between them is people who never enabled notifications, and
 * seeing "412 match, 118 reachable" is the difference between understanding the
 * result and being surprised by it.
 */
export async function previewAudience(a: PushAudience): Promise<AudiencePreview> {
  const where = audienceWhere(a);
  const [users, reachable, devices] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.count({ where: { ...where, pushTokens: { some: {} } } }),
    prisma.pushToken.count({ where: { user: where } }),
  ]);
  return { users, reachable, devices };
}

/** The Expo tokens a send would go to, de-duplicated. */
export async function audienceTokens(a: PushAudience): Promise<{ tokens: string[]; userCount: number }> {
  const rows = await prisma.pushToken.findMany({
    where: { user: audienceWhere(a) },
    select: { token: true, userId: true },
  });
  const tokens = [
    ...new Set(
      rows
        .map((r) => r.token)
        .filter((t) => t.startsWith("ExponentPushToken") || t.startsWith("ExpoPushToken")),
    ),
  ];
  return { tokens, userCount: new Set(rows.map((r) => r.userId)).size };
}

/** Programme codes that actually have someone attached, for the filter UI. */
export async function audienceOptions() {
  const rows = await prisma.studentAcademicProfile.findMany({
    where: { user: { deletedAt: null } },
    select: { studyYear: true, programme: { select: { code: true, name: true } } },
  });
  const programmes = new Map<string, { code: string; name: string; count: number }>();
  const years = new Map<number, number>();
  for (const r of rows) {
    const p = programmes.get(r.programme.code) ?? { ...r.programme, count: 0 };
    p.count += 1;
    programmes.set(r.programme.code, p);
    years.set(r.studyYear, (years.get(r.studyYear) ?? 0) + 1);
  }
  return {
    programmes: [...programmes.values()].sort((a, b) => a.code.localeCompare(b.code)),
    studyYears: [...years.entries()]
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year - b.year),
  };
}
