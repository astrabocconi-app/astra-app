// Append-only audit log. SERVER-ONLY.
//
// Every mutating admin action MUST call writeAudit so there is a tamper-evident
// record of who changed what. Never updated or deleted after the fact.
//
// Two rules keep the log useful and safe to keep forever:
//   - it records what CHANGED (a field diff), not "someone saved this", so
//     "who moved the start time / changed the discount" has an answer;
//   - it never stores a student's email in the clear. The log is append-only
//     and outlives the account, so an address written here could not be erased.

import { prisma, type Prisma } from "@astra/db";
import { emailHash } from "./email-hash";
import { scrubWith, changedFields, auditVerb, type AuditAction } from "./audit-diff";

export { changedFields, auditVerb, type AuditAction };

/** Anything with an `auditLog` delegate: the client, or a transaction. */
type AuditDb = { auditLog: Pick<Prisma.TransactionClient["auditLog"], "create"> };

/** Deep copy of audit metadata with every email address replaced by a short hash. */
export function scrubMetadata<T>(value: T): T {
  return scrubWith(value, emailHash);
}

export async function writeAudit(
  params: {
    actorId: string;
    action: AuditAction | string;
    targetType: string; // e.g. "NewsPost", "Event", "Reward"
    targetId: string;
    areaId?: string | null;
    metadata?: Record<string, unknown>;
  },
  /** Pass the transaction the change was made in, so the change and its record commit together. */
  db: AuditDb = prisma,
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      areaId: params.areaId ?? null,
      metadata: scrubMetadata(params.metadata ?? {}) as object,
    },
  });
}
