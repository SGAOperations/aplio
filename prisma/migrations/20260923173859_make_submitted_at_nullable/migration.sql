-- AlterTable
ALTER TABLE "Application" ALTER COLUMN "submittedAt" DROP NOT NULL,
ALTER COLUMN "submittedAt" DROP DEFAULT;

-- Drafts never had a real submittedAt; the column held their createdAt.
-- Includes soft-deleted drafts — a revived draft is still a draft.
UPDATE "Application" SET "submittedAt" = NULL WHERE "status" = 'draft';
