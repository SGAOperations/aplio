import {
  cleanupFixtures,
  createTestApplication,
  createTestGlobalQuestion,
  createTestPosition,
  createTestPositionQuestion,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { actAs } from '@/tests/stubs/auth-server';
import { deletedUrls, onPut, resetBlobStub } from '@/tests/stubs/vercel-blob';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  removeQuestionFileAnswer,
  uploadQuestionFileAnswer,
} from '@/prisma/actions/question-files';
import type { $Enums, Position, User } from '@/prisma/client';

import {
  APPLICANT_EDITABLE_APPLICATION_STATUSES,
  APPLICATION_STATUS_VALUES,
} from '@/lib/constants';
import { prisma } from '@/lib/prisma';
import { isError } from '@/lib/utils';

// Local literal, not the lib/constants.ts export — asserting the exact sentence is the point.
const APPLICATION_NOT_EDITABLE_MESSAGE =
  'This application has already been submitted. Withdraw it to make changes.';

const ALL_STATUSES: $Enums.ApplicationStatus[] = [
  ...APPLICATION_STATUS_VALUES,
  'withdrawn',
];

const PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34,
]);

function buildFormData(target: {
  applicationId: string;
  questionId: string;
  isGlobal: boolean;
}): FormData {
  const formData = new FormData();
  formData.set('scope', 'application');
  formData.set('applicationId', target.applicationId);
  formData.set('questionId', target.questionId);
  formData.set('isGlobal', String(target.isGlobal));
  formData.set(
    'file',
    new File([PDF_BYTES], 'test.pdf', { type: 'application/pdf' }),
  );
  return formData;
}

let admin: User;
let position: Position;

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  position = await createTestPosition(admin);
});

afterEach(() => {
  resetBlobStub();
});

afterAll(async () => {
  await cleanupFixtures();
});

describe.each([
  { label: 'global', isGlobal: true },
  { label: 'position', isGlobal: false },
])('question-files ($label scope)', ({ isGlobal }) => {
  async function createQuestion(): Promise<string> {
    if (isGlobal) {
      const question = await createTestGlobalQuestion(admin, {
        type: 'file_upload',
        required: false,
      });
      return question.id;
    }
    const question = await createTestPositionQuestion(position, admin, {
      type: 'file_upload',
      required: false,
    });
    return question.id;
  }

  describe('uploadQuestionFileAnswer', () => {
    for (const status of ALL_STATUSES) {
      const isLegal = (
        APPLICANT_EDITABLE_APPLICATION_STATUSES as readonly string[]
      ).includes(status);

      it(`${isLegal ? 'allows' : 'blocks'} upload from ${status}`, async () => {
        const applicant = await createTestUser();
        const questionId = await createQuestion();
        const application = await createTestApplication(applicant, position, {
          status,
        });

        actAs(applicant);
        const result = await uploadQuestionFileAnswer(
          buildFormData({
            applicationId: application.id,
            questionId,
            isGlobal,
          }),
        );

        if (isLegal) expect(isError(result)).toBe(false);
        else
          expect(result).toEqual({ error: APPLICATION_NOT_EDITABLE_MESSAGE });
      });
    }
  });

  describe('removeQuestionFileAnswer', () => {
    for (const status of ALL_STATUSES) {
      const isLegal = (
        APPLICANT_EDITABLE_APPLICATION_STATUSES as readonly string[]
      ).includes(status);

      it(`${isLegal ? 'allows' : 'blocks'} remove from ${status}`, async () => {
        const applicant = await createTestUser();
        const questionId = await createQuestion();
        const application = await createTestApplication(applicant, position, {
          status,
        });

        actAs(applicant);
        const result = await removeQuestionFileAnswer({
          scope: 'application',
          applicationId: application.id,
          questionId,
          isGlobal,
        });

        if (isLegal) expect(result).toBeUndefined();
        else
          expect(result).toEqual({ error: APPLICATION_NOT_EDITABLE_MESSAGE });
      });
    }
  });
});

describe('uploadQuestionFileAnswer race', () => {
  it('refuses a status change between the pre-check and the write, and deletes the new blob', async () => {
    const applicant = await createTestUser();
    const question = await createTestGlobalQuestion(admin, {
      type: 'file_upload',
      required: false,
    });
    const application = await createTestApplication(applicant, position, {
      status: 'withdrawn',
    });

    onPut(async () => {
      await prisma.application.update({
        where: { id: application.id },
        data: { status: 'applied' },
      });
    });

    actAs(applicant);
    const result = await uploadQuestionFileAnswer(
      buildFormData({
        applicationId: application.id,
        questionId: question.id,
        isGlobal: true,
      }),
    );

    expect(result).toEqual({ error: APPLICATION_NOT_EDITABLE_MESSAGE });
    expect(deletedUrls).toHaveLength(1);

    const stored = await prisma.globalApplicationAnswer.findUnique({
      where: {
        applicationId_globalQuestionId: {
          applicationId: application.id,
          globalQuestionId: question.id,
        },
      },
    });
    expect(stored).toBeNull();
  });
});
