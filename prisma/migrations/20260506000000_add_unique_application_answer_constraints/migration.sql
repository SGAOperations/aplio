-- AddUniqueConstraint
ALTER TABLE "GlobalApplicationAnswer" ADD CONSTRAINT "GlobalApplicationAnswer_applicationId_globalQuestionId_key" UNIQUE ("applicationId", "globalQuestionId");

-- AddUniqueConstraint
ALTER TABLE "PositionApplicationAnswer" ADD CONSTRAINT "PositionApplicationAnswer_applicationId_positionQuestionId_key" UNIQUE ("applicationId", "positionQuestionId");
