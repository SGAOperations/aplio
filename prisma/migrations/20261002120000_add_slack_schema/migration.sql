-- CreateEnum
CREATE TYPE "SlackMessageKind" AS ENUM ('otp');

-- CreateEnum
CREATE TYPE "SlackDeliveryStatus" AS ENUM ('sent', 'failed');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "issuer" TEXT;

-- Backfill in Better Auth's own local-account issuer format so no row is left
-- without one before the column is made required.
UPDATE "Account" SET "issuer" = 'local:' || "providerId" WHERE "issuer" IS NULL;

ALTER TABLE "Account" ALTER COLUMN "issuer" SET NOT NULL;

-- CreateTable
CREATE TABLE "SlackConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slackUserId" TEXT NOT NULL,
    "slackTeamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlackConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlackDeliveryLog" (
    "id" TEXT NOT NULL,
    "slackUserId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "SlackMessageKind" NOT NULL,
    "status" "SlackDeliveryStatus" NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlackDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SlackConnectToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "slackUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlackConnectToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_issuer_accountId_key" ON "Account"("issuer", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "SlackConnection_userId_key" ON "SlackConnection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SlackConnection_slackUserId_key" ON "SlackConnection"("slackUserId");

-- CreateIndex
CREATE INDEX "SlackDeliveryLog_userId_createdAt_idx" ON "SlackDeliveryLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SlackDeliveryLog_status_idx" ON "SlackDeliveryLog"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SlackConnectToken_token_key" ON "SlackConnectToken"("token");

-- CreateIndex
CREATE INDEX "SlackConnectToken_slackUserId_idx" ON "SlackConnectToken"("slackUserId");

-- AddForeignKey
ALTER TABLE "SlackConnection" ADD CONSTRAINT "SlackConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlackDeliveryLog" ADD CONSTRAINT "SlackDeliveryLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
