-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "applicantName" TEXT;

-- Backfill already-submitted applications from the current profile name —
-- the best available approximation, since no earlier snapshot exists. Drafts
-- stay null; submitApplication captures the real snapshot going forward.
UPDATE "Application" a
SET "applicantName" = u."name"
FROM "User" u
WHERE u."id" = a."userId"
  AND a."status" != 'draft';
