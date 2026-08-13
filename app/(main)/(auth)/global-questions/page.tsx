import type { Metadata } from 'next';

import { getGlobalQuestions } from '@/prisma/data/global-questions';

import { requireAdminOr404 } from '@/lib/auth/guards';

import { GlobalQuestionDialog } from '@/components/features/global-question-dialog';
import { GlobalQuestionsTable } from '@/components/features/global-questions-table';
import { PageHeader } from '@/components/layouts/page-header';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Global Questions' };

export default async function GlobalQuestionsPage() {
  await requireAdminOr404();

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
