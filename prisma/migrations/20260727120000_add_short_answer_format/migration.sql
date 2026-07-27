-- CreateEnum
CREATE TYPE "ShortAnswerFormat" AS ENUM ('email', 'phone_number', 'url', 'zip_code');

-- AlterTable
ALTER TABLE "GlobalQuestion" ADD COLUMN "format" "ShortAnswerFormat";

-- AlterTable
ALTER TABLE "PositionQuestion" ADD COLUMN "format" "ShortAnswerFormat";
