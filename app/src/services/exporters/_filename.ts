import { Assessment } from '@/types/assessment';

export function exportFileName(a: Assessment, ext: string): string {
  const ref = (a.overview.riskAssessmentRef || 'untitled').replace(/[^a-z0-9_-]+/gi, '_');
  const date = (a.overview.dateOfAssessment || new Date().toISOString().slice(0, 10)).replace(
    /-/g,
    '',
  );
  return `CAT-${ref}-${date}.${ext}`;
}
