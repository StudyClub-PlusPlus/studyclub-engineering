'use client';

import { StudiesTable } from '@console/components/StudiesTable';

import { useMswStudies } from '@/proto/lib/use-msw-studies';

/** TODO(api): GET /api/studies 또는 /api/admin/studies — 스터디 목록 연동 */
export function StudiesTableContainer() {
  const studies = useMswStudies();

  return <StudiesTable studies={studies} />;
}
