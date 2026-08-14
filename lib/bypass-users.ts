// Import-free: the seed runs under plain tsx and must stay clear of Next.js.

export type BypassRole = 'admin' | 'applicant' | 'position-manager';

// Well-known ids, so the seed and a real bypass login converge on the same rows.
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
