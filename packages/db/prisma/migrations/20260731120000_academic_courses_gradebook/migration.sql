-- Course catalogue + gradebook tables.
--
-- BACKFILLED. These tables were applied to the live database on 2026-07-31 but
-- their migration folder was never committed, so `_prisma_migrations` recorded a
-- migration that did not exist on disk. That drift meant `prisma migrate dev`
-- could offer to RESET the database to reconcile history — against a datasource
-- that resolves to production — and any freshly provisioned environment silently
-- came up without these tables.
--
-- The SQL below was reconstructed from the live schema (columns, indexes,
-- constraints and FK actions read back from information_schema/pg_catalog), so
-- replaying it on an empty database reproduces what production actually has.
-- Already-applied databases skip it: Prisma matches migrations by folder name.
--
-- AcademicCourse and AcademicCourseProgramme hold the scraped Bocconi course
-- catalogue (~659 courses / ~3.4k programme links). ExamRecord is the student
-- gradebook, still unbuilt in the app — no code reads it yet.

CREATE TYPE "ExamStatus" AS ENUM ('PLANNED', 'PASSED', 'FAILED', 'REJECTED');

CREATE TABLE "AcademicCourse" (
  "id"          TEXT NOT NULL,
  "catalogueId" TEXT NOT NULL,
  "code"        TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "language"    TEXT,
  "sourceUrl"   TEXT NOT NULL,
  "retrievedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcademicCourse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcademicCourse_catalogueId_code_key"
  ON "AcademicCourse"("catalogueId", "code");
CREATE INDEX "AcademicCourse_catalogueId_idx" ON "AcademicCourse"("catalogueId");

ALTER TABLE "AcademicCourse"
  ADD CONSTRAINT "AcademicCourse_catalogueId_fkey"
  FOREIGN KEY ("catalogueId") REFERENCES "AcademicCatalogue"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- A course can belong to several programmes, with different credits each.
CREATE TABLE "AcademicCourseProgramme" (
  "id"          TEXT NOT NULL,
  "courseId"    TEXT NOT NULL,
  "programmeId" TEXT NOT NULL,
  "credits"     INTEGER NOT NULL,
  "semester"    TEXT,
  "courseType"  TEXT,
  CONSTRAINT "AcademicCourseProgramme_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcademicCourseProgramme_courseId_programmeId_key"
  ON "AcademicCourseProgramme"("courseId", "programmeId");
CREATE INDEX "AcademicCourseProgramme_programmeId_idx"
  ON "AcademicCourseProgramme"("programmeId");

ALTER TABLE "AcademicCourseProgramme"
  ADD CONSTRAINT "AcademicCourseProgramme_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "AcademicCourse"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AcademicCourseProgramme"
  ADD CONSTRAINT "AcademicCourseProgramme_programmeId_fkey"
  FOREIGN KEY ("programmeId") REFERENCES "AcademicProgramme"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- One row per exam a student plans, sits or passes.
CREATE TABLE "ExamRecord" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "courseId"    TEXT,
  "customTitle" TEXT,
  "credits"     INTEGER NOT NULL,
  "studyYear"   INTEGER NOT NULL,
  "semester"    TEXT,
  "status"      "ExamStatus" NOT NULL DEFAULT 'PLANNED',
  "grade"       INTEGER,
  "lode"        BOOLEAN NOT NULL DEFAULT false,
  "passFail"    BOOLEAN NOT NULL DEFAULT false,
  "examDate"    TIMESTAMP(3),
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExamRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExamRecord_userId_studyYear_idx" ON "ExamRecord"("userId", "studyYear");
CREATE INDEX "ExamRecord_courseId_idx" ON "ExamRecord"("courseId");

-- A student passes a given exam once. Two partial unique indexes rather than one
-- constraint, because an exam is identified EITHER by a catalogue course or by a
-- free-text title (for exams the catalogue doesn't carry).
CREATE UNIQUE INDEX "ExamRecord_passed_course_key"
  ON "ExamRecord"("userId", "courseId")
  WHERE status = 'PASSED' AND "courseId" IS NOT NULL;

CREATE UNIQUE INDEX "ExamRecord_passed_custom_key"
  ON "ExamRecord"("userId", lower(btrim("customTitle")))
  WHERE status = 'PASSED' AND "courseId" IS NULL;

ALTER TABLE "ExamRecord"
  ADD CONSTRAINT "ExamRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExamRecord"
  ADD CONSTRAINT "ExamRecord_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "AcademicCourse"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Every exam must be identifiable one way or the other.
ALTER TABLE "ExamRecord"
  ADD CONSTRAINT "ExamRecord_course_identified"
  CHECK (
    "courseId" IS NOT NULL
    OR ("customTitle" IS NOT NULL AND length(btrim("customTitle")) > 0)
  );

ALTER TABLE "ExamRecord"
  ADD CONSTRAINT "ExamRecord_credits_range"
  CHECK (credits > 0 AND credits <= 60);

ALTER TABLE "ExamRecord"
  ADD CONSTRAINT "ExamRecord_study_year_range"
  CHECK ("studyYear" >= 1 AND "studyYear" <= 6);

-- Italian marks are 18-30, with lode only on a 30. Refined in the next
-- migration to stay correct when the grade is NULL.
ALTER TABLE "ExamRecord"
  ADD CONSTRAINT "ExamRecord_grade_shape"
  CHECK (
    CASE
      WHEN status IN ('PASSED', 'REJECTED') AND NOT "passFail"
        THEN grade IS NOT NULL AND grade >= 18 AND grade <= 30
      ELSE grade IS NULL
    END
    AND (NOT lode OR (grade IS NOT NULL AND grade = 30))
  );
