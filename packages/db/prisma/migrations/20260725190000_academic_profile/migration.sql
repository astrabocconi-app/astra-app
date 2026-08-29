-- Phase 3A: versioned academic selection catalogue + private student profile.

CREATE TABLE "AcademicCatalogue" (
  "id" TEXT NOT NULL,
  "academicYear" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcademicCatalogue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AcademicProgramme" (
  "id" TEXT NOT NULL,
  "catalogueId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "durationYears" INTEGER NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "AcademicProgramme_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AcademicClassGroup" (
  "id" TEXT NOT NULL,
  "programmeId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  CONSTRAINT "AcademicClassGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentAcademicProfile" (
  "userId" TEXT NOT NULL,
  "programmeId" TEXT NOT NULL,
  "studyYear" INTEGER NOT NULL,
  "classGroupId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentAcademicProfile_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "StudentAcademicProfile_studyYear_check" CHECK ("studyYear" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "AcademicCatalogue_version_key" ON "AcademicCatalogue"("version");
CREATE UNIQUE INDEX "AcademicProgramme_catalogueId_code_key" ON "AcademicProgramme"("catalogueId", "code");
CREATE INDEX "AcademicProgramme_catalogueId_active_idx" ON "AcademicProgramme"("catalogueId", "active");
CREATE UNIQUE INDEX "AcademicClassGroup_programmeId_code_key" ON "AcademicClassGroup"("programmeId", "code");
CREATE INDEX "AcademicClassGroup_programmeId_idx" ON "AcademicClassGroup"("programmeId");
CREATE INDEX "StudentAcademicProfile_programmeId_idx" ON "StudentAcademicProfile"("programmeId");
CREATE INDEX "StudentAcademicProfile_classGroupId_idx" ON "StudentAcademicProfile"("classGroupId");

ALTER TABLE "AcademicProgramme"
  ADD CONSTRAINT "AcademicProgramme_catalogueId_fkey"
  FOREIGN KEY ("catalogueId") REFERENCES "AcademicCatalogue"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AcademicClassGroup"
  ADD CONSTRAINT "AcademicClassGroup_programmeId_fkey"
  FOREIGN KEY ("programmeId") REFERENCES "AcademicProgramme"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentAcademicProfile"
  ADD CONSTRAINT "StudentAcademicProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentAcademicProfile"
  ADD CONSTRAINT "StudentAcademicProfile_programmeId_fkey"
  FOREIGN KEY ("programmeId") REFERENCES "AcademicProgramme"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StudentAcademicProfile"
  ADD CONSTRAINT "StudentAcademicProfile_classGroupId_fkey"
  FOREIGN KEY ("classGroupId") REFERENCES "AcademicClassGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Reviewed undergraduate selection metadata for AY 2026-27.
INSERT INTO "AcademicCatalogue" ("id", "academicYear", "version", "sourceUrl", "active")
VALUES (
  'bocconi-2026-27',
  '2026-2027',
  'bocconi-2026-27-v1',
  'https://www.unibocconi.it/en/programs',
  true
);

INSERT INTO "AcademicProgramme"
  ("id", "catalogueId", "code", "name", "level", "durationYears", "sourceUrl")
VALUES
  ('bocconi-2026-27-biem', 'bocconi-2026-27', 'BIEM', 'International Economics and Management', 'BACHELOR', 3, 'https://www.unibocconi.it/en/programs'),
  ('bocconi-2026-27-cleam', 'bocconi-2026-27', 'CLEAM', 'Economia e Management', 'BACHELOR', 3, 'https://www.unibocconi.it/en/programs'),
  ('bocconi-2026-27-bief', 'bocconi-2026-27', 'BIEF', 'International Economics and Finance', 'BACHELOR', 3, 'https://www.unibocconi.it/en/programs'),
  ('bocconi-2026-27-bess', 'bocconi-2026-27', 'BESS', 'Economic and Social Sciences', 'BACHELOR', 3, 'https://www.unibocconi.it/en/programs'),
  ('bocconi-2026-27-bemacs', 'bocconi-2026-27', 'BEMACS', 'Economics, Management and Computer Science', 'BACHELOR', 3, 'https://www.unibocconi.it/en/programs'),
  ('bocconi-2026-27-bai', 'bocconi-2026-27', 'BAI', 'Mathematical and Computing Sciences for Artificial Intelligence', 'BACHELOR', 3, 'https://www.unibocconi.it/en/programs'),
  ('bocconi-2026-27-big', 'bocconi-2026-27', 'BIG', 'International Politics and Government', 'BACHELOR', 3, 'https://www.unibocconi.it/en/programs'),
  ('bocconi-2026-27-wbb', 'bocconi-2026-27', 'WBB', 'World Bachelor in Business', 'BACHELOR', 4, 'https://www.unibocconi.it/en/programs'),
  ('bocconi-2026-27-bgl', 'bocconi-2026-27', 'BGL', 'Bachelor in Global Law', 'BACHELOR', 3, 'https://www.unibocconi.it/en/programs'),
  ('bocconi-2026-27-cleacc', 'bocconi-2026-27', 'CLEACC', 'Economia e Management per Arte, Cultura e Comunicazione', 'BACHELOR', 3, 'https://www.unibocconi.it/en/programs'),
  ('bocconi-2026-27-bemacc', 'bocconi-2026-27', 'BEMACC', 'Economics and Management for Arts, Culture and Communication', 'BACHELOR', 3, 'https://www.unibocconi.it/en/programs'),
  ('bocconi-2026-27-clmg', 'bocconi-2026-27', 'CLMG', 'Giurisprudenza', 'INTEGRATED_MASTER', 5, 'https://www.unibocconi.it/en/programs');

-- Class groups are taken from programme-specific blocks in the official
-- 2026-27 course profiles. BIEF and BIEM share a foundation but have distinct
-- first-year class ranges; CLEACC/BEMACC are the Italian/English deliveries.
INSERT INTO "AcademicClassGroup" ("id", "programmeId", "code", "sourceUrl")
VALUES
  ('bocconi-2026-27-cleam-1', 'bocconi-2026-27-cleam', '1', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-cleam-2', 'bocconi-2026-27-cleam', '2', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-cleam-3', 'bocconi-2026-27-cleam', '3', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-cleam-4', 'bocconi-2026-27-cleam', '4', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-cleam-5', 'bocconi-2026-27-cleam', '5', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-cleam-6', 'bocconi-2026-27-cleam', '6', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-cleacc-11', 'bocconi-2026-27-cleacc', '11', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-bemacc-12', 'bocconi-2026-27-bemacc', '12', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-bess-13', 'bocconi-2026-27-bess', '13', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-biem-14', 'bocconi-2026-27-biem', '14', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-biem-15', 'bocconi-2026-27-biem', '15', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-biem-16', 'bocconi-2026-27-biem', '16', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-biem-17', 'bocconi-2026-27-biem', '17', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-biem-18', 'bocconi-2026-27-biem', '18', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-biem-19', 'bocconi-2026-27-biem', '19', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-bemacs-25', 'bocconi-2026-27-bemacs', '25', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-bai-27', 'bocconi-2026-27-bai', '27', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-bgl-28', 'bocconi-2026-27-bgl', '28', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30631'),
  ('bocconi-2026-27-bief-40', 'bocconi-2026-27-bief', '40', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-bief-41', 'bocconi-2026-27-bief', '41', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-bief-42', 'bocconi-2026-27-bief', '42', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-bief-43', 'bocconi-2026-27-bief', '43', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-big-44', 'bocconi-2026-27-big', '44', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-big-45', 'bocconi-2026-27-big', '45', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30122'),
  ('bocconi-2026-27-wbb-24', 'bocconi-2026-27-wbb', '24', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30695'),
  ('bocconi-2026-27-wbb-26', 'bocconi-2026-27-wbb', '26', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=30695'),
  ('bocconi-2026-27-clmg-19', 'bocconi-2026-27-clmg', '19', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=50237'),
  ('bocconi-2026-27-clmg-20', 'bocconi-2026-27-clmg', '20', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=50237');
