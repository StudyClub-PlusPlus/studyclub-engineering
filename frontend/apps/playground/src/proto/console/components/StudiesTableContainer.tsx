'use client';

import { useEffect, useState } from 'react';

import { StudiesTable } from '@console/components/StudiesTable';
import type { Study } from '@studyclub/types';

import { readReusedDrafts } from '../lib/reused-drafts';
import { useMswStudies } from '@/proto/lib/use-msw-studies';

/** TODO(api): GET /api/studies 또는 /api/admin/studies — 스터디 목록 연동 */
export function StudiesTableContainer() {
  const studies = useMswStudies();

  const [drafts, setDrafts] = useState<Study[]>([]);
  useEffect(() => {
    try {
      setDrafts(readReusedDrafts());
    } catch {
      setDrafts([]);
    }
  }, []);

  return <StudiesTable studies={[...drafts, ...studies]} />;
}
