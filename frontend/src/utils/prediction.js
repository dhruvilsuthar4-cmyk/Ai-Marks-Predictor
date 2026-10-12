const WEIGHTS = Object.freeze({
  study_hours: 0.2,
  attendance: 0.25,
  previous_marks: 0.3,
  assignment_marks: 0.25
});

export function predictMarks({ study_hours, attendance, previous_marks, assignment_marks }) {
  const studyScore = Math.min(Number(study_hours) / 8, 1) * 100;
  const weightedScore =
    studyScore * WEIGHTS.study_hours +
    Number(attendance) * WEIGHTS.attendance +
    Number(previous_marks) * WEIGHTS.previous_marks +
    Number(assignment_marks) * WEIGHTS.assignment_marks;
  const clampedScore = Math.min(100, Math.max(0, weightedScore));
  return Math.round((clampedScore + Number.EPSILON) * 100) / 100;
}

export function getPerformanceCategory(score) {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Average';
  return 'Needs Improvement';
}
