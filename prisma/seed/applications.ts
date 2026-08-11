// Which positions each applicant applies to (by index into positionDefs / applicantDefs).
// Every application here is created with status 'applied' — see
// draftApplicationAssignments below for the draft-status regression fixture.
export const applicationAssignments = [
  { applicantIdx: 0, positionIndices: [0, 2, 6] }, // Alice: Engineering Senator, Director of Tech, Wellness (draft position)
  { applicantIdx: 1, positionIndices: [1, 4, 7] }, // Bob: Director of Finance, External Relations, Alumni Relations (deleted position)
  { applicantIdx: 2, positionIndices: [3, 5] }, // Carol: Science Senator, Student Advocate
  { applicantIdx: 3, positionIndices: [4, 5] }, // David: External Relations, Student Advocate
];

// Regression fixture for issue #348: a draft (unsubmitted) application against
// the soft-deleted position (index 7) — must stay hidden everywhere alongside
// Bob's submitted one above, per the plan's "hide entirely" rule.
export const draftApplicationAssignments = [
  { applicantIdx: 2, positionIdx: 7 }, // Carol: draft application on Alumni Relations (deleted position)
];
