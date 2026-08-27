-- Data-only: Better Auth's email-otp signup can write name = '' instead of
-- NULL. Normalizes both tables so blank name is treated as absent.
UPDATE "User"
SET "name" = NULL
WHERE "name" IS NOT NULL AND btrim("name") = '';

UPDATE "Application"
SET "applicantName" = NULL
WHERE "applicantName" IS NOT NULL AND btrim("applicantName") = '';
