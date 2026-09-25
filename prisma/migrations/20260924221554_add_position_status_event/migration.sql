-- CreateTable
CREATE TABLE "PositionStatusEvent" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "from" "PositionStatus" NOT NULL,
    "to" "PositionStatus" NOT NULL,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositionStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PositionStatusEvent_positionId_createdAt_idx" ON "PositionStatusEvent"("positionId", "createdAt");

-- CreateIndex
CREATE INDEX "PositionStatusEvent_to_createdAt_idx" ON "PositionStatusEvent"("to", "createdAt");

-- AddForeignKey
ALTER TABLE "PositionStatusEvent" ADD CONSTRAINT "PositionStatusEvent_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PositionStatusEvent" ADD CONSTRAINT "PositionStatusEvent_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
