-- Make the gradebook's grade check null-safe.
--
-- BACKFILLED alongside 20260731120000_academic_courses_gradebook — see that
-- file for why these two were missing from the repo. This restates the final
-- constraint exactly as it exists in the live database, so replaying the
-- migration history on a fresh database lands on the same definition.
--
-- `lode` is a BOOLEAN NOT NULL, but the grade it qualifies can be NULL (a
-- planned exam has no mark yet). Written naively, `NOT lode OR grade = 30`
-- evaluates to NULL rather than TRUE for an unset grade, and a CHECK that
-- evaluates to NULL passes — so the guard quietly did nothing in exactly the
-- rows it was meant to cover. The explicit `grade IS NOT NULL` makes it
-- three-valued-logic safe.

ALTER TABLE "ExamRecord" DROP CONSTRAINT IF EXISTS "ExamRecord_grade_shape";

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
