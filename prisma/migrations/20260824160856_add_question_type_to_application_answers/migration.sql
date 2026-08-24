-- AlterTable
ALTER TABLE "GlobalApplicationAnswer" ADD COLUMN     "questionType" "QuestionType";

-- AlterTable
ALTER TABLE "PositionApplicationAnswer" ADD COLUMN     "questionType" "QuestionType";

-- Backfill from each answer's live question — the best available approximation,
-- since no earlier snapshot exists.
UPDATE "GlobalApplicationAnswer" a
SET "questionType" = q."type"
FROM "GlobalQuestion" q
WHERE q."id" = a."globalQuestionId";

UPDATE "PositionApplicationAnswer" a
SET "questionType" = q."type"
FROM "PositionQuestion" q
WHERE q."id" = a."positionQuestionId";

ALTER TABLE "GlobalApplicationAnswer" ALTER COLUMN "questionType" SET NOT NULL;

ALTER TABLE "PositionApplicationAnswer" ALTER COLUMN "questionType" SET NOT NULL;
