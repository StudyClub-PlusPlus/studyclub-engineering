'use client';

import { useEffect, useState } from 'react';

import { studies as defaultStudies, type Study } from '@studyclub/mock';

/**
 * Playground 내에서 MSW /api/studies 응답을 실시간으로 반영하는 Hook.
 * MSW Devtool에서 프리셋(정상, 빈 목록 등)을 변경할 때 msw:config-change 이벤트를 감지하여 자동 동기화한다.
 * TODO(api): 백엔드 API 연동 시 실 /api/studies fetch 로 대체.
 */
export function useMswStudies(initialStudies: Study[] = defaultStudies) {
  const [studies, setStudies] = useState<Study[]>(initialStudies);

  useEffect(() => {
    let isCancelled = false;

    const syncFromMsw = () => {
      fetch('/api/studies?limit=100')
        .then((res) => {
          if (!res.ok) {
            if (!isCancelled) setStudies([]);
            return;
          }
          return res.json();
        })
        .then((page) => {
          if (isCancelled || !page) return;
          if (Array.isArray(page.items)) {
            if (page.items.length === 0) {
              setStudies([]);
            } else {
              const ids = new Set(page.items.map((item: { studyId: number }) => item.studyId));
              setStudies(defaultStudies.filter((s) => ids.has(s.study_id)));
            }
          }
        })
        .catch(() => {
          if (!isCancelled) setStudies([]);
        });
    };

    syncFromMsw();
    window.addEventListener('msw:config-change', syncFromMsw);
    return () => {
      isCancelled = true;
      window.removeEventListener('msw:config-change', syncFromMsw);
    };
  }, []);

  return studies;
}
