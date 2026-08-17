'use client';

import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

// No baseURL: same-origin requests to /api/auth resolve against the current host.
export const authClient = createAuthClient({ plugins: [emailOTPClient()] });
