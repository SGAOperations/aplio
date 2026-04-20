export const applicantDefs = [
  { email: 'alice@example.com', name: 'Alice Chen' },
  { email: 'bob@example.com', name: 'Bob Martinez' },
  { email: 'carol@example.com', name: 'Carol Johnson' },
  { email: 'david@example.com', name: 'David Kim' },
];

// Per-applicant profile answers keyed by question label, ordered to match applicantDefs
export const profileAnswers: Record<string, string[]>[] = [
  {
    'Full name': ['Alice Chen'],
    'Year in school': ['Junior'],
    Major: ['Computer Science'],
    'GPA range': ['3.5+'],
    'Why do you want to get involved in student government?': [
      'I want to improve campus tech resources and make university processes more accessible to students.',
    ],
    'Relevant experience or leadership roles': [
      'CS Club President for two years — led a team of 12 building an open-source campus tool.',
    ],
    'Areas of interest': ['Technology', 'Academic Affairs'],
    "Anything else you'd like us to know?": ['Fluent in Mandarin and Spanish.'],
  },
  {
    'Full name': ['Bob Martinez'],
    'Year in school': ['Senior'],
    Major: ['Finance'],
    'GPA range': ['3.0–3.5'],
    'Why do you want to get involved in student government?': [
      'I want to ensure student funds are allocated transparently and equitably.',
    ],
    'Relevant experience or leadership roles': [
      'Treasurer of the Business Society for two semesters, managing a $15,000 annual budget.',
    ],
    'Areas of interest': ['Finance', 'External Relations'],
    "Anything else you'd like us to know?": [],
  },
  {
    'Full name': ['Carol Johnson'],
    'Year in school': ['Sophomore'],
    Major: ['Biology'],
    'GPA range': ['3.5+'],
    'Why do you want to get involved in student government?': [
      'Science students are underrepresented in SGA and I want to change that.',
    ],
    'Relevant experience or leadership roles': [
      'Undergraduate research assistant in the Microbiology department for one year.',
    ],
    'Areas of interest': ['Academic Affairs', 'Diversity & Inclusion'],
    "Anything else you'd like us to know?": [
      'First-generation college student.',
    ],
  },
  {
    'Full name': ['David Kim'],
    'Year in school': ['Graduate'],
    Major: ['Public Policy'],
    'GPA range': ['3.5+'],
    'Why do you want to get involved in student government?': [
      'I am passionate about translating student grievances into real policy changes.',
    ],
    'Relevant experience or leadership roles': [
      'Graduate student representative on the Faculty Senate for one academic year.',
    ],
    'Areas of interest': [
      'Student Life',
      'Diversity & Inclusion',
      'External Relations',
    ],
    "Anything else you'd like us to know?": [
      'Available for extended office hours.',
    ],
  },
];
