import { redirect } from 'next/navigation';

import { getGlobalQuestions } from '@/prisma/data/global-questions';

import { getCurrentUser } from '@/lib/auth/server';

import { GlobalQuestionDialog } from '@/components/features/global-question-dialog';
import { GlobalQuestionsTable } from '@/components/features/global-questions-table';
import { Button } from '@/components/ui/button';

export default async function GlobalQuestionsPage() {
  const user = await getCurrentUser();
  if (!user.isAdmin) redirect('/');

  const questions = await getGlobalQuestions();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Global Questions
        </h1>
        <GlobalQuestionDialog
          trigger={<Button size="sm">New Question</Button>}
        />
      </div>

      <GlobalQuestionsTable questions={questions} />
    </div>
  );
}
