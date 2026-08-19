-- Data-only: opensAt/closesAt already store instants, this only reinterprets
-- their stored UTC calendar date as America/New_York wall time.
UPDATE "Position"
SET "opensAt" = ((date_trunc('day', "opensAt") AT TIME ZONE 'America/New_York') AT TIME ZONE 'UTC')
WHERE "opensAt" IS NOT NULL;

UPDATE "Position"
SET "closesAt" = (((date_trunc('day', "closesAt") + interval '1 day' - interval '1 millisecond') AT TIME ZONE 'America/New_York') AT TIME ZONE 'UTC')
WHERE "closesAt" IS NOT NULL;
