'use client';

import { useEffect, useState } from 'react';

/**
 * 스터디 목록으로 돌아가는 주소 — 걸어 둔 필터 · 정렬 · 페이지를 그대로 (back-office-front `features/studies/list-return.ts` 와 같다).
 * 목록이 마지막 쿼리를 탭 저장소(sessionStorage)에 적고, 상세의 「← 스터디 관리」가 읽는다.
 */
const KEY = 'proto:studies-list-search';
const LIST = '/proto/console/studies';

export function rememberStudiesListSearch(search: string) {
  try {
    if (search) sessionStorage.setItem(KEY, search);
    else sessionStorage.removeItem(KEY);
  } catch {
    // 저장소를 못 쓰면 조건 없는 목록으로 돌아간다
  }
}

export function studiesListHref(): string {
  try {
    const search = sessionStorage.getItem(KEY);
    return search && search.startsWith('?') ? `${LIST}${search}` : LIST;
  } catch {
    return LIST;
  }
}

/** 링크용 — 첫 렌더는 `/proto/console/studies`, 붙은 뒤 저장된 조건을 얹는다(하이드레이션 불일치 방지). */
export function useStudiesListHref(): string {
  const [href, setHref] = useState(LIST);
  useEffect(() => setHref(studiesListHref()), []);
  return href;
}
