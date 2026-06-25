import Link from 'next/link';

import { getIsBypass } from '@/lib/auth/server';

import { Button } from '@/components/ui/button';

import { DeactivatedTeardown } from './deactivated-teardown';

export default async function DeactivatedPage() {
  const isBypass = await getIsBypass();

  return (
    <>
      <DeactivatedTeardown isBypass={isBypass} />
      <div className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Account deactivated
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Your account has been deactivated. Contact an administrator.
          </p>
        </div>
        <Button variant="outline" className="w-full" asChild>
          <Link href={isBypass ? '/login/bypass' : '/login'}>
            {isBypass ? 'Back to dev login' : 'Back to sign in'}
          </Link>
        </Button>
      </div>
    </>
  );
}
