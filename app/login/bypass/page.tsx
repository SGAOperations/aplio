import { loginAsBypassUser } from '@/prisma/actions/dev-bypass';

import { Button } from '@/components/ui/button';

export default function BypassLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dev Login</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Select a role to log in as a bypass user.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <form action={loginAsBypassUser.bind(null, 'admin')}>
            <Button type="submit" className="w-full">
              Admin
            </Button>
          </form>
          <form action={loginAsBypassUser.bind(null, 'applicant')}>
            <Button type="submit" variant="outline" className="w-full">
              Applicant
            </Button>
          </form>
          <form action={loginAsBypassUser.bind(null, 'position-manager')}>
            <Button type="submit" variant="outline" className="w-full">
              Position Manager
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
