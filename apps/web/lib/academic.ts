// Academic selection catalogue + student profile. SERVER-ONLY.

import { prisma } from "@astra/db";
import type { AcademicProfileInput } from "@astra/shared";

export async function getActiveAcademicCatalogue() {
  return prisma.academicCatalogue.findFirst({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    include: {
      programmes: {
        where: { active: true },
        orderBy: { code: "asc" },
        include: {
          classGroups: { orderBy: { code: "asc" } },
          tracks: { where: { active: true }, orderBy: { name: "asc" } },
        },
      },
    },
  });
}

export async function getAcademicProfile(userId: string) {
  return prisma.studentAcademicProfile.findUnique({
    where: { userId },
    include: {
      programme: { include: { catalogue: true } },
      track: true,
      classGroup: true,
    },
  });
}

export function toAcademicProfile(
  row: NonNullable<Awaited<ReturnType<typeof getAcademicProfile>>>
) {
  return {
    programme: {
      id: row.programme.id,
      code: row.programme.code,
      name: row.programme.name,
      level: row.programme.level,
      durationYears: row.programme.durationYears,
      sourceUrl: row.programme.sourceUrl,
      legacy: row.programme.legacy,
    },
    catalogue: {
      id: row.programme.catalogue.id,
      academicYear: row.programme.catalogue.academicYear,
      version: row.programme.catalogue.version,
      sourceUrl: row.programme.catalogue.sourceUrl,
    },
    studyYear: row.studyYear,
    track: row.track
      ? { id: row.track.id, code: row.track.code, name: row.track.name, sourceUrl: row.track.sourceUrl }
      : null,
    classGroup: row.classGroup
      ? { id: row.classGroup.id, code: row.classGroup.code, sourceUrl: row.classGroup.sourceUrl }
      : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function saveAcademicProfile(userId: string, input: AcademicProfileInput) {
  const programme = await prisma.academicProgramme.findFirst({
    where: { id: input.programmeId, active: true, catalogue: { active: true } },
    include: { catalogue: true },
  });
  if (!programme) throw new AcademicSelectionError("Programme is not in the active catalogue.");
  if (input.studyYear > programme.durationYears) {
    throw new AcademicSelectionError(
      `Study year must be between 1 and ${programme.durationYears}.`
    );
  }

  // Both checks hang off the same programme, so there is no reason to pay for
  // two sequential round trips.
  const [track, classGroup] = await Promise.all([
    input.trackId
      ? prisma.academicTrack.findFirst({
          where: { id: input.trackId, programmeId: programme.id, active: true },
          select: { id: true },
        })
      : null,
    input.classGroupId
      ? prisma.academicClassGroup.findFirst({
          where: { id: input.classGroupId, programmeId: programme.id },
          select: { id: true },
        })
      : null,
  ]);
  if (input.trackId && !track) {
    throw new AcademicSelectionError("Track does not belong to programme.");
  }
  if (input.classGroupId && !classGroup) {
    throw new AcademicSelectionError("Class group does not belong to programme.");
  }

  const selection = {
    programmeId: programme.id,
    trackId: input.trackId ?? null,
    studyYear: input.studyYear,
    classGroupId: input.classGroupId ?? null,
  };

  // Same include as getAcademicProfile, so the write returns the row to render
  // and the caller skips a follow-up read.
  return prisma.studentAcademicProfile.upsert({
    where: { userId },
    update: selection,
    create: { userId, ...selection },
    include: {
      programme: { include: { catalogue: true } },
      track: true,
      classGroup: true,
    },
  });
}

export class AcademicSelectionError extends Error {}
