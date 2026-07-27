import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getGlobalQuestions } from '@/prisma/data/global-questions';

import { getCurrentUser } from '@/lib/auth/server';

import { GlobalQuestionDialog } from '@/components/features/global-question-dialog';
import { GlobalQuestionsTable } from '@/components/features/global-questions-table';
import { PageHeader } from '@/components/layouts/page-header';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Global Questions' };

export default async function GlobalQuestionsPage() {
  const user = await getCurrentUser();
  if (!user.isAdmin) redirect('/');

  const questions = await getGlobalQuestions();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Global Questions"
        description="Questions every applicant answers once; shared across all applications."
        actions={
          <GlobalQuestionDialog
            trigger={<Button size="sm">New Question</Button>}
          />
        }
      />

      <GlobalQuestionsTable questions={questions} />
    </div>
  );
}
