// Deliberately a standalone module with NO imports: both `prisma/services/
// dev-bypass.ts` (a Next.js server action) and `prisma/seed.ts` (run under
// plain `tsx`, outside Next.js) import these identities, and the seed script
// must not pull in zod / `components/ui` transitively via a Next.js-only
// module. If you need to add an import here, move this file's contents into
// `prisma/seed/` and `prisma/services/dev-bypass.ts` separately instead.

export type BypassRole = 'admin' | 'applicant' | 'position-manager';

// Well-known emails/ids so the seed's upsert and a real bypass login always
// converge on the same three rows instead of racing to create duplicates.
export const BYPASS_USERS: Record<
  BypassRole,
  { email: string; neonAuthId: string; isAdmin: boolean }
> = {
  admin: {
    email: 'bypass-admin@example.com',
    neonAuthId: 'bypass-admin',
    isAdmin: true,
  },
  applicant: {
    email: 'bypass-applicant@example.com',
    neonAuthId: 'bypass-applicant',
    isAdmin: false,
  },
  'position-manager': {
    email: 'bypass-position-manager@example.com',
    neonAuthId: 'bypass-position-manager',
    isAdmin: false,
  },
};
