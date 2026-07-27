-- AlterTable
ALTER TABLE "GlobalQuestion" ADD COLUMN     "allowOther" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PositionQuestion" ADD COLUMN     "allowOther" BOOLEAN NOT NULL DEFAULT false;
