// 스터디 목록 조회 — 키·fetcher·훅을 한곳에. 브라우저가 백엔드를 직접 부른다.
import type { Study } from '@studyclub/types';
import { useQuery } from '@tanstack/react-query';

import { fetchBrowserStudies, fetchBrowserStudy } from './browser-repository';
import { studyKeys } from './keys';
import type { StudySearch } from '@/features/studies/types';

/**
 * 목록. 공개 API 라 로그인 없이도 받는다.
 * GET /api/studies
 *
 * `initial` 은 서버가 기본 조건으로 이미 받아 둔 첫 화면이다 — 같은 조건이면 요청을 한 번 더 보내지
 * 않도록 `initialData` 로 심는다. 필터를 건드리면 키가 달라져 자연히 새로 받는다.
 */
export function useStudies(search: StudySearch, initial?: Study[]) {
  const isDefault = Object.values(search).every((v) => v === undefined);
  return useQuery({
    queryKey: studyKeys.list(search),
    queryFn: () => fetchBrowserStudies(search),
    initialData: isDefault ? initial : undefined,
    // 필터를 바꾸는 동안 이전 목록을 지우지 않는다 — 비었다 다시 차면 어디를 보고 있었는지 잃는다
    placeholderData: (previous) => previous,
  });
}

/** 상세. GET /api/studies/{studyId} */
/** initial = 서버에서 미리 받은 값 — 첫 HTML 에 본문이 실리게 한다(크롤러는 JS 를 거의 안 돌린다) */
export function useStudyDetail(studyId: number, initial?: Study | null) {
  return useQuery({
    queryKey: studyKeys.detail(studyId),
    ...(initial ? { initialData: initial } : {}),
    queryFn: () => fetchBrowserStudy(studyId),
    retry: false,
  });
}
