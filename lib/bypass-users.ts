// Import-free: the seed runs under plain tsx and must stay clear of Next.js.

export const BYPASS_ROLES = ['admin', 'applicant', 'position-manager'] as const;

export type BypassRole = (typeof BYPASS_ROLES)[number];

// Well-known emails, so the seed and a real bypass login converge on the same rows.
export const BYPASS_USERS: Record<
  BypassRole,
  { email: string; isAdmin: boolean; name: string }
> = {
  admin: {
    email: 'bypass-admin@example.com',
    isAdmin: true,
    name: 'Bypass Admin',
  },
  applicant: {
    email: 'bypass-applicant@example.com',
    isAdmin: false,
    name: 'Bypass Applicant',
  },
  'position-manager': {
    email: 'bypass-position-manager@example.com',
    isAdmin: false,
    name: 'Bypass Position Manager',
  },
};
