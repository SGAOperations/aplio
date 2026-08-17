import { toNextJsHandler } from 'better-auth/next-js';

import { auth } from '@/lib/auth/config';

// Permitted API-route exception; Better Auth needs a reachable HTTP endpoint.
export const { GET, POST } = toNextJsHandler(auth);
