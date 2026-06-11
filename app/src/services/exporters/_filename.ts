import { Assessment } from '@/types/assessment';

export function exportFileName(a: Assessment, ext: string): string {
  const slug =
    (a.overview.activityOutline || 'untitled')
      .replace(/[^a-z0-9_-]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'untitled';
  const date = (a.overview.dateOfAssessment || new Date().toISOString().slice(0, 10)).replace(
    /-/g,
    '',
  );
  return `LabCAT-${slug}-${date}.${ext}`;
}
