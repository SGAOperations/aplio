import type { ApplicationStatus } from '../client';
import { ORIENTATION_LEADER_TITLE } from './positions';
import type { ApplicantDef, ApplicationDef } from './types';
import { resumeUrl } from './users';

const FIRST_NAMES = [
  'Liam',
  'Emma',
  'Noah',
  'Olivia',
  'Ethan',
  'Ava',
  'Mason',
  'Sophia',
  'Lucas',
  'Isabella',
  'Jack',
  'Mia',
  'Aiden',
  'Zoe',
  'Caleb',
  'Nora',
] as const;

const LAST_NAMES = ['Turner', 'Bennett', 'Ramirez', 'Osei'] as const;

// Order defines each applicant's index range — kept in one place so
// statusForIndex and BULK_ORIENTATION_APPLICANT_COUNT can't drift apart.
const STATUS_COUNTS: readonly (readonly [ApplicationStatus, number])[] = [
  ['applied', 20],
  ['reached_out', 10],
  ['interview_scheduled', 8],
  ['reviewing', 8],
  ['rejected', 8],
  ['accepted', 4],
  ['withdrawn', 3],
  ['draft', 3],
];

export const BULK_ORIENTATION_APPLICANT_COUNT = STATUS_COUNTS.reduce(
  (sum, [, count]) => sum + count,
  0,
);

function statusForIndex(i: number): ApplicationStatus {
  let remaining = i;
  for (const [status, count] of STATUS_COUNTS) {
    if (remaining < count) return status;
    remaining -= count;
  }
  throw new Error(`Bulk applicant index out of range: ${i}`);
}

const YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'];
const MAJORS = [
  'Computer Science',
  'Biology',
  'Finance',
  'Political Science',
  'Psychology',
  'Mechanical Engineering',
  'English',
  'Economics',
];
const GPA_RANGES = ['Below 2.5', '2.5–3.0', '3.0–3.5', '3.5+'];
const INTERESTS = [
  'Academic Affairs',
  'Student Life',
  'Diversity & Inclusion',
  'Finance',
  'External Relations',
  'Technology',
];
const SESSIONS = ['June', 'July', 'August', 'January'];

// Minutes-ago cycle, index 7 ("never") is represented by an absent value.
const LAST_LOGIN_MINUTES_CYCLE = [30, 300, 2880, 7200, 30240, 60480, 172800];

function lastLoginMinutesAgoForIndex(i: number): number | undefined {
  const position = i % 8;
  return position === 7 ? undefined : LAST_LOGIN_MINUTES_CYCLE[position];
}

function emailForIndex(i: number): string {
  return `orientation-${String(i + 1).padStart(2, '0')}@example.com`;
}

export interface BulkOrientationSeed {
  applicantDefs: ApplicantDef[];
  profileAnswers: Record<string, Record<string, string[]>>;
  applicationDefs: ApplicationDef[];
}

/**
 * Pure and index-driven — identical output across calls, no `Math.random`,
 * no `Date.now`. 64 applicants past the 50-row pagination, covering every
 * `ApplicationStatus` in a realistic mix.
 */
export function generateBulkOrientationApplicants(): BulkOrientationSeed {
  const applicantDefs: ApplicantDef[] = [];
  const profileAnswers: Record<string, Record<string, string[]>> = {};
  const applicationDefs: ApplicationDef[] = [];

  for (let i = 0; i < BULK_ORIENTATION_APPLICANT_COUNT; i++) {
    const email = emailForIndex(i);
    const name = `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[Math.floor(i / FIRST_NAMES.length)]}`;
    const lastLoginMinutesAgo = lastLoginMinutesAgoForIndex(i);

    applicantDefs.push({
      email,
      name,
      ...(lastLoginMinutesAgo !== undefined ? { lastLoginMinutesAgo } : {}),
    });

    const answers: Record<string, string[]> = {
      'Full name': [name],
      'Year in school': [YEARS[i % YEARS.length]!],
      Major: [MAJORS[i % MAJORS.length]!],
      'GPA range': [GPA_RANGES[i % GPA_RANGES.length]!],
      'Why do you want to get involved in student government?': [
        'I want hands-on experience welcoming new students to campus.',
      ],
      'Relevant experience or leadership roles': [
        'Peer mentor for incoming first-years.',
      ],
      'Areas of interest': [INTERESTS[i % INTERESTS.length]!],
      "Anything else you'd like us to know?": [],
    };
    if (i % 3 === 0)
      answers.Resume = [
        resumeUrl(`orientation-${String(i + 1).padStart(2, '0')}`),
      ];
    profileAnswers[email] = answers;

    const status = statusForIndex(i);
    const isDraft = status === 'draft';
    const sessions =
      i % 3 === 0
        ? [SESSIONS[i % SESSIONS.length]!]
        : [
            SESSIONS[i % SESSIONS.length]!,
            SESSIONS[(i + 2) % SESSIONS.length]!,
          ];

    applicationDefs.push({
      applicantEmail: email,
      positionTitle: ORIENTATION_LEADER_TITLE,
      status,
      answers: isDraft ? 'partial' : 'full',
      ...(isDraft ? {} : { submittedInDays: 1 + ((i * 7) % 20) }),
      positionAnswerOverrides: {
        'Which sessions can you staff?': sessions,
        'Have you been an Orientation Leader before?': [
          i % 2 === 0 ? 'Yes' : 'No',
        ],
      },
    });
  }

  return { applicantDefs, profileAnswers, applicationDefs };
}
