import type { QuestionDef } from './types';

export const globalQuestionDefs: QuestionDef[] = [
  { order: 1, label: 'Full name', type: 'short_answer' },
  {
    order: 2,
    label: 'Year in school',
    type: 'single_choice',
    options: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'],
  },
  { order: 3, label: 'Major', type: 'short_answer' },
  {
    order: 4,
    label: 'GPA range',
    type: 'single_choice',
    options: ['Below 2.5', '2.5–3.0', '3.0–3.5', '3.5+'],
  },
  {
    order: 5,
    label: 'Why do you want to get involved in student government?',
    type: 'long_answer',
  },
  {
    order: 6,
    label: 'Relevant experience or leadership roles',
    type: 'long_answer',
  },
  {
    order: 7,
    label: 'Areas of interest',
    type: 'multiple_choice',
    options: [
      'Academic Affairs',
      'Student Life',
      'Diversity & Inclusion',
      'Finance',
      'External Relations',
      'Technology',
    ],
  },
  {
    order: 8,
    label: "Anything else you'd like us to know?",
    type: 'long_answer',
    required: false,
  },
];
