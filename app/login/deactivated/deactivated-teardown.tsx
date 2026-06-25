'use client';

import { useEffect, useRef } from 'react';

import { clearBypassSession } from '@/prisma/actions/dev-bypass';

import { authClient } from '@/lib/auth/client';

interface DeactivatedTeardownProps {
  isBypass: boolean;
}

// Fires once on mount to clear the deactivated session so the auth loop is broken.
// Bypass: deletes the dev-bypass-user-id cookie via a server action.
// Real auth: signs the user out of Neon Auth on the client.
export function DeactivatedTeardown({ isBypass }: DeactivatedTeardownProps) {
  const isBypassRef = useRef(isBypass);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (isBypassRef.current) {
      clearBypassSession().catch(() => {
        // Swallow — cookie may already be cleared; page remains visible.
      });
    } else {
      authClient.signOut().catch(() => {
        // Swallow — session may already be gone; page remains visible.
      });
    }
  }, []);

  return null;
}
