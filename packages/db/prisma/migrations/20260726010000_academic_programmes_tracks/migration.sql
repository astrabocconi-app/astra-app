-- Add selectable MSc/legacy programmes and optional programme tracks.

ALTER TABLE "AcademicProgramme"
  ADD COLUMN "legacy" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "AcademicTrack" (
  "id" TEXT NOT NULL,
  "programmeId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "AcademicTrack_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StudentAcademicProfile"
  ADD COLUMN "trackId" TEXT;

CREATE UNIQUE INDEX "AcademicTrack_programmeId_code_key"
  ON "AcademicTrack"("programmeId", "code");
CREATE INDEX "AcademicTrack_programmeId_active_idx"
  ON "AcademicTrack"("programmeId", "active");
CREATE INDEX "StudentAcademicProfile_trackId_idx"
  ON "StudentAcademicProfile"("trackId");

ALTER TABLE "AcademicTrack"
  ADD CONSTRAINT "AcademicTrack_programmeId_fkey"
  FOREIGN KEY ("programmeId") REFERENCES "AcademicProgramme"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentAcademicProfile"
  ADD CONSTRAINT "StudentAcademicProfile_trackId_fkey"
  FOREIGN KEY ("trackId") REFERENCES "AcademicTrack"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- The live Bocconi course selector includes current MSc programmes and older
-- codes retained for students completing prior programme structures.
INSERT INTO "AcademicProgramme"
  ("id", "catalogueId", "code", "name", "level", "durationYears", "sourceUrl", "legacy")
VALUES
  ('bocconi-2026-27-msc-acme', 'bocconi-2026-27', 'ACME', 'Economics and Management in Arts, Culture, Media and Entertainment', 'MASTER_OF_SCIENCE', 2, 'https://www.unibocconi.it/en/programs/master-science-programs', false),
  ('bocconi-2026-27-msc-afc', 'bocconi-2026-27', 'AFC', 'Amministrazione, Finanza Aziendale e Controllo / Accounting, Financial Management and Control', 'MASTER_OF_SCIENCE', 2, 'https://didattica.unibocconi.eu/ts/index.php?anno=2020', true),
  ('bocconi-2026-27-msc-afm', 'bocconi-2026-27', 'AFM', 'Accounting and Financial Management', 'MASTER_OF_SCIENCE', 2, 'https://www.unibocconi.it/en/programs/master-science-programs', false),
  ('bocconi-2026-27-msc-ai', 'bocconi-2026-27', 'AI', 'Artificial Intelligence', 'MASTER_OF_SCIENCE', 2, 'https://www.unibocconi.it/en/programs/master-science-programs', false),
  ('bocconi-2026-27-msc-clapi', 'bocconi-2026-27', 'CLAPI', 'Economia e Management delle Amministrazioni Pubbliche e delle Istituzioni Internazionali', 'MASTER_OF_SCIENCE', 2, 'https://didattica.unibocconi.eu/ts/index.php?anno=2020', true),
  ('bocconi-2026-27-msc-clefin', 'bocconi-2026-27', 'CLEFIN-FINANCE', 'Finanza / Finance', 'MASTER_OF_SCIENCE', 2, 'https://didattica.unibocconi.eu/ts/index.php?anno=2020', true),
  ('bocconi-2026-27-msc-cleli', 'bocconi-2026-27', 'CLELI', 'Economia e Legislazione per l''Impresa', 'MASTER_OF_SCIENCE', 2, 'https://didattica.unibocconi.eu/ts/index.php?anno=2020', true),
  ('bocconi-2026-27-msc-cyber', 'bocconi-2026-27', 'CYBER', 'Cyber Risk Strategy and Governance', 'MASTER_OF_SCIENCE', 2, 'https://www.unibocconi.it/en/programs/master-science-programs', false),
  ('bocconi-2026-27-msc-daihs', 'bocconi-2026-27', 'DAIHS', 'Data Analytics and Artificial Intelligence in Health Sciences', 'MASTER_OF_SCIENCE', 2, 'https://www.unibocconi.it/en/programs/master-science-programs', false),
  ('bocconi-2026-27-msc-des-ess', 'bocconi-2026-27', 'DES-ESS', 'Discipline Economiche e Sociali / Economic and Social Sciences', 'MASTER_OF_SCIENCE', 2, 'https://didattica.unibocconi.eu/ts/index.php?anno=2020', true),
  ('bocconi-2026-27-msc-dsba', 'bocconi-2026-27', 'DSBA', 'Data Science and Business Analytics', 'MASTER_OF_SCIENCE', 2, 'https://www.unibocconi.it/en/programs/master-science-programs', false),
  ('bocconi-2026-27-msc-emit', 'bocconi-2026-27', 'EMIT', 'Economics and Management of Innovation and Technology', 'MASTER_OF_SCIENCE', 2, 'https://didattica.unibocconi.eu/ts/index.php?anno=2020', true),
  ('bocconi-2026-27-msc-ess', 'bocconi-2026-27', 'ESS', 'Economic and Social Sciences', 'MASTER_OF_SCIENCE', 2, 'https://www.unibocconi.it/en/programs/master-science-programs', false),
  ('bocconi-2026-27-msc-fin', 'bocconi-2026-27', 'FIN', 'Finance', 'MASTER_OF_SCIENCE', 2, 'https://www.unibocconi.it/en/programs/master-science-programs', false),
  ('bocconi-2026-27-msc-gio', 'bocconi-2026-27', 'GIO', 'Economics and Management of Government and International Organizations', 'MASTER_OF_SCIENCE', 2, 'https://www.unibocconi.it/en/programs/master-science-programs', false),
  ('bocconi-2026-27-msc-im', 'bocconi-2026-27', 'IM', 'International Management', 'MASTER_OF_SCIENCE', 2, 'https://www.unibocconi.it/en/programs/master-science-programs', false),
  ('bocconi-2026-27-msc-intent', 'bocconi-2026-27', 'INTENT', 'Innovation, Technology and Entrepreneurship', 'MASTER_OF_SCIENCE', 2, 'https://www.unibocconi.it/en/programs/master-science-programs', false),
  ('bocconi-2026-27-msc-m', 'bocconi-2026-27', 'M', 'Management', 'MASTER_OF_SCIENCE', 2, 'https://didattica.unibocconi.eu/ts/index.php?anno=2020', true),
  ('bocconi-2026-27-msc-mm', 'bocconi-2026-27', 'MM', 'Marketing Management', 'MASTER_OF_SCIENCE', 2, 'https://www.unibocconi.it/en/programs/master-science-programs', false),
  ('bocconi-2026-27-msc-ppa', 'bocconi-2026-27', 'PPA', 'Politics and Policy Analysis', 'MASTER_OF_SCIENCE', 2, 'https://www.unibocconi.it/en/programs/master-science-programs', false),
  ('bocconi-2026-27-msc-ts', 'bocconi-2026-27', 'TS', 'Transformative Sustainability', 'MASTER_OF_SCIENCE', 2, 'https://www.unibocconi.it/en/programs/master-science-programs', false),
  ('bocconi-2026-27-bess-cles', 'bocconi-2026-27', 'BESS-CLES', 'Economic and Social Sciences / Economia e Scienze Sociali', 'BACHELOR', 3, 'https://didattica.unibocconi.eu/ts/index.php?anno=2020', true),
  ('bocconi-2026-27-biemf', 'bocconi-2026-27', 'BIEMF', 'International Economics, Management and Finance', 'BACHELOR', 3, 'https://didattica.unibocconi.eu/ts/index.php?anno=2020', true),
  ('bocconi-2026-27-clef', 'bocconi-2026-27', 'CLEF', 'Economia e Finanza', 'BACHELOR', 3, 'https://didattica.unibocconi.eu/ts/index.php?anno=2020', true);

INSERT INTO "AcademicClassGroup" ("id", "programmeId", "code", "sourceUrl")
VALUES
  ('bocconi-2026-27-msc-acme-19', 'bocconi-2026-27-msc-acme', '19', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20813'),
  ('bocconi-2026-27-msc-afc-11', 'bocconi-2026-27-msc-afc', '11', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2020&cod_ins=20179'),
  ('bocconi-2026-27-msc-afc-12', 'bocconi-2026-27-msc-afc', '12', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2020&cod_ins=20179'),
  ('bocconi-2026-27-msc-afm-40', 'bocconi-2026-27-msc-afm', '40', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20941'),
  ('bocconi-2026-27-msc-afm-41', 'bocconi-2026-27-msc-afm', '41', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20941'),
  ('bocconi-2026-27-msc-afm-42', 'bocconi-2026-27-msc-afm', '42', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20941'),
  ('bocconi-2026-27-msc-afm-43', 'bocconi-2026-27-msc-afm', '43', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20941'),
  ('bocconi-2026-27-msc-ai-29', 'bocconi-2026-27-msc-ai', '29', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20871'),
  ('bocconi-2026-27-msc-cyber-25', 'bocconi-2026-27-msc-cyber', '25', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20941'),
  ('bocconi-2026-27-msc-daihs-48', 'bocconi-2026-27-msc-daihs', '48', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=21011'),
  ('bocconi-2026-27-msc-des-ess-20', 'bocconi-2026-27-msc-des-ess', '20', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2020&cod_ins=20136'),
  ('bocconi-2026-27-msc-des-ess-21', 'bocconi-2026-27-msc-des-ess', '21', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2020&cod_ins=20136'),
  ('bocconi-2026-27-msc-dsba-23', 'bocconi-2026-27-msc-dsba', '23', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20941'),
  ('bocconi-2026-27-msc-emit-22', 'bocconi-2026-27-msc-emit', '22', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2020&cod_ins=20570'),
  ('bocconi-2026-27-msc-ess-20', 'bocconi-2026-27-msc-ess', '20', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20136'),
  ('bocconi-2026-27-msc-ess-21', 'bocconi-2026-27-msc-ess', '21', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20136'),
  ('bocconi-2026-27-msc-fin-44', 'bocconi-2026-27-msc-fin', '44', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=21004'),
  ('bocconi-2026-27-msc-fin-45', 'bocconi-2026-27-msc-fin', '45', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=21004'),
  ('bocconi-2026-27-msc-fin-46', 'bocconi-2026-27-msc-fin', '46', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=21004'),
  ('bocconi-2026-27-msc-fin-47', 'bocconi-2026-27-msc-fin', '47', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=21004'),
  ('bocconi-2026-27-msc-gio-14', 'bocconi-2026-27-msc-gio', '14', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20512'),
  ('bocconi-2026-27-msc-im-1', 'bocconi-2026-27-msc-im', '1', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20897'),
  ('bocconi-2026-27-msc-im-2', 'bocconi-2026-27-msc-im', '2', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20897'),
  ('bocconi-2026-27-msc-im-3', 'bocconi-2026-27-msc-im', '3', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20897'),
  ('bocconi-2026-27-msc-im-4', 'bocconi-2026-27-msc-im', '4', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20897'),
  ('bocconi-2026-27-msc-im-5', 'bocconi-2026-27-msc-im', '5', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20897'),
  ('bocconi-2026-27-msc-im-6', 'bocconi-2026-27-msc-im', '6', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20950'),
  ('bocconi-2026-27-msc-intent-27', 'bocconi-2026-27-msc-intent', '27', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20941'),
  ('bocconi-2026-27-msc-intent-28', 'bocconi-2026-27-msc-intent', '28', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20941'),
  ('bocconi-2026-27-msc-m-1', 'bocconi-2026-27-msc-m', '1', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2020&cod_ins=20486'),
  ('bocconi-2026-27-msc-m-2', 'bocconi-2026-27-msc-m', '2', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2020&cod_ins=20486'),
  ('bocconi-2026-27-msc-m-3', 'bocconi-2026-27-msc-m', '3', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2020&cod_ins=20486'),
  ('bocconi-2026-27-msc-mm-8', 'bocconi-2026-27-msc-mm', '8', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20941'),
  ('bocconi-2026-27-msc-mm-9', 'bocconi-2026-27-msc-mm', '9', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20941'),
  ('bocconi-2026-27-msc-mm-10', 'bocconi-2026-27-msc-mm', '10', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20941'),
  ('bocconi-2026-27-msc-ppa-24', 'bocconi-2026-27-msc-ppa', '24', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=20941'),
  ('bocconi-2026-27-msc-ts-26', 'bocconi-2026-27-msc-ts', '26', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2027&cod_ins=21108'),
  ('bocconi-2026-27-bess-cles-13', 'bocconi-2026-27-bess-cles', '13', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2020&cod_ins=30424'),
  ('bocconi-2026-27-clef-9', 'bocconi-2026-27-clef', '9', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2020&cod_ins=30024'),
  ('bocconi-2026-27-clef-10', 'bocconi-2026-27-clef', '10', 'https://didattica.unibocconi.eu/ts/tsn_anteprima.php?anno=2020&cod_ins=30024');

-- Tracks explicitly listed by Bocconi on the current MSc programme overview.
INSERT INTO "AcademicTrack" ("id", "programmeId", "code", "name", "sourceUrl")
VALUES
  ('bocconi-2026-27-msc-fin-finance', 'bocconi-2026-27-msc-fin', 'FINANCE', 'Finance Track', 'https://www.unibocconi.it/en/programs/master-science-programs'),
  ('bocconi-2026-27-msc-fin-global', 'bocconi-2026-27-msc-fin', 'GLOBAL', 'Finance Global Experience Track', 'https://www.unibocconi.it/en/programs/master-science-programs'),
  ('bocconi-2026-27-msc-im-global', 'bocconi-2026-27-msc-im', 'GLOBAL', 'IM Global Experience', 'https://www.unibocconi.it/en/programs/master-science-programs'),
  ('bocconi-2026-27-msc-im-concentrations', 'bocconi-2026-27-msc-im', 'CONCENTRATIONS', 'IM Concentrations', 'https://www.unibocconi.it/en/programs/master-science-programs'),
  ('bocconi-2026-27-msc-im-asia-essec', 'bocconi-2026-27-msc-im', 'ASIA-ESSEC', 'IM Asia – Double Degree ESSEC', 'https://www.unibocconi.it/en/programs/master-science-programs'),
  ('bocconi-2026-27-msc-im-cems', 'bocconi-2026-27-msc-im', 'CEMS', 'IM CEMS MIM', 'https://www.unibocconi.it/en/programs/master-science-programs'),
  ('bocconi-2026-27-msc-im-china', 'bocconi-2026-27-msc-im', 'CHINA-MIM', 'IM Asia – China MIM', 'https://www.unibocconi.it/en/programs/master-science-programs'),
  ('bocconi-2026-27-msc-im-luxury', 'bocconi-2026-27-msc-im', 'LUXURY-ESSEC', 'Double Degree ESSEC Luxury Management', 'https://www.unibocconi.it/en/programs/master-science-programs'),
  ('bocconi-2026-27-msc-ppa-standard', 'bocconi-2026-27-msc-ppa', 'PPA', 'Politics and Policy Analysis Track', 'https://www.unibocconi.it/en/programs/master-science-programs'),
  ('bocconi-2026-27-msc-ppa-lse', 'bocconi-2026-27-msc-ppa', 'LSE', 'LSE–Bocconi Double Degree', 'https://www.unibocconi.it/en/programs/master-science-programs'),
  ('bocconi-2026-27-msc-ppa-sciences-po', 'bocconi-2026-27-msc-ppa', 'SCIENCES-PO', 'Sciences Po–Bocconi Double Degree', 'https://www.unibocconi.it/en/programs/master-science-programs');
