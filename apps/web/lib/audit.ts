// Append-only audit log. SERVER-ONLY.
//
// Every mutating admin action MUST call writeAudit so there is a tamper-evident
// record of who changed what. Never updated or deleted after the fact.

import { prisma } from "@astra/db";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "publish"
  | "unpublish";

export async function writeAudit(params: {
  actorId: string;
  action: AuditAction | string;
  targetType: string; // e.g. "NewsPost", "Event", "Reward"
  targetId: string;
  areaId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      areaId: params.areaId ?? null,
      metadata: (params.metadata ?? {}) as object,
    },
  });
}
