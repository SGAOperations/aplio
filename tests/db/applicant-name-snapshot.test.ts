import {
  cleanupFixtures,
  createTestApplication,
  createTestPosition,
  createTestUser,
} from '@/tests/helpers/fixtures';
import { actAs } from '@/tests/stubs/auth-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { submitApplication } from '@/prisma/actions/applications';
import { setUserName } from '@/prisma/actions/profile';
import type { Position, User } from '@/prisma/client';
import {
  getApplicationForReview,
  getApplications,
} from '@/prisma/data/applications';

import { prisma } from '@/lib/prisma';

let admin: User;
let openPosition: Position;

beforeAll(async () => {
  admin = await createTestUser({ isAdmin: true });
  openPosition = await createTestPosition(admin);
});

afterAll(async () => {
  await cleanupFixtures();
});

describe('Application.applicantName snapshot', () => {
  it('is null on a draft and captured at submit time', async () => {
    const applicant = await createTestUser({ name: 'Ada Lovelace' });
    const draft = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });
    expect(draft.applicantName).toBeNull();

    actAs(applicant);
    const result = await submitApplication(draft.id);
    expect(result).toBeUndefined();

    const submitted = await prisma.application.findUniqueOrThrow({
      where: { id: draft.id },
      select: { applicantName: true },
    });
    expect(submitted.applicantName).toBe('Ada Lovelace');
  });

  it('keeps the submitted snapshot after the applicant renames their profile', async () => {
    const applicant = await createTestUser({ name: 'Grace Hopper' });
    const draft = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });

    actAs(applicant);
    await submitApplication(draft.id);

    const result = await setUserName({ name: 'Grace M. Hopper' });
    expect(result).toBeUndefined();

    const renamedUser = await prisma.user.findUniqueOrThrow({
      where: { id: applicant.id },
      select: { name: true },
    });
    expect(renamedUser.name).toBe('Grace M. Hopper');

    const application = await prisma.application.findUniqueOrThrow({
      where: { id: draft.id },
      select: { applicantName: true },
    });
    expect(application.applicantName).toBe('Grace Hopper');
  });

  it('surfaces the frozen name (not the live profile name) on the reviewer detail read path', async () => {
    const applicant = await createTestUser({ name: 'Katherine Johnson' });
    const draft = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });

    actAs(applicant);
    await submitApplication(draft.id);
    await setUserName({ name: 'K. Johnson' });

    const forReview = await getApplicationForReview(draft.id, admin);
    expect(forReview?.applicantName).toBe('Katherine Johnson');
    expect(forReview?.user.name).toBe('K. Johnson');
  });

  it('surfaces the frozen name on the reviewer list read path', async () => {
    const applicant = await createTestUser({ name: 'Margaret Hamilton' });
    const draft = await createTestApplication(applicant, openPosition, {
      status: 'draft',
    });

    actAs(applicant);
    await submitApplication(draft.id);
    await setUserName({ name: 'Peggy Hamilton' });

    const list = await getApplications(admin, {});
    const row = list.find((a) => a.id === draft.id);
    expect(row?.applicantName).toBe('Margaret Hamilton');
    expect(row?.user.name).toBe('Peggy Hamilton');
  });
});
