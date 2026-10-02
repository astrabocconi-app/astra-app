-- Some programmes split into tracks only after a common start: BIEF students
-- pick Economics or Finance from the second year. `fromYear` is the first
-- study year a track can be chosen; existing tracks are open from year 1.

ALTER TABLE "AcademicTrack" ADD COLUMN "fromYear" INTEGER NOT NULL DEFAULT 1;

INSERT INTO "AcademicTrack" ("id", "programmeId", "code", "name", "sourceUrl", "fromYear")
VALUES
  ('bocconi-2026-27-bief-econ', 'bocconi-2026-27-bief', 'BIEF-ECON', 'Economics', 'https://www.unibocconi.it/en/programs', 2),
  ('bocconi-2026-27-bief-fin', 'bocconi-2026-27-bief', 'BIEF-FIN', 'Finance', 'https://www.unibocconi.it/en/programs', 2)
ON CONFLICT ("programmeId", "code") DO NOTHING;
