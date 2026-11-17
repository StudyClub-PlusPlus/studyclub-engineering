'use client';

import { useEffect, useState } from 'react';

/**
 * 스터디 목록으로 돌아가는 주소 — 걸어 둔 필터 · 페이지를 그대로.
 *
 * 브라우저 뒤로 가기는 주소에 조건이 남아 있어 그대로 돌아온다. 화면 안의 「← 스터디 관리」 링크는 그 주소를 모르므로,
 * 목록이 마지막 쿼리를 탭 저장소(sessionStorage)에 적어 두고 링크가 읽는다. 탭마다 따로라 다른 탭의 조건이 섞이지 않는다.
 */
const KEY = 'bo:studies-list-search';
const LIST = '/studies';

/** 목록이 지금 쿼리를 적는다 — `?status=OPEN&page=2` 또는 빈 문자열. */
export function rememberStudiesListSearch(search: string) {
  try {
    if (search) sessionStorage.setItem(KEY, search);
    else sessionStorage.removeItem(KEY);
  } catch {
    // 저장소를 못 쓰면 조건 없는 목록으로 돌아간다
  }
}

/** 지금 돌아갈 목록 주소. 이벤트 처리기에서 부른다(삭제 뒤 이동 등). */
export function studiesListHref(): string {
  try {
    const search = sessionStorage.getItem(KEY);
    return search && search.startsWith('?') ? `${LIST}${search}` : LIST;
  } catch {
    return LIST;
  }
}

/** 링크용 — 첫 렌더는 서버와 같게 `/studies`, 붙은 뒤 저장된 조건을 얹는다(하이드레이션 불일치 방지). */
export function useStudiesListHref(): string {
  const [href, setHref] = useState(LIST);
  useEffect(() => setHref(studiesListHref()), []);
  return href;
}
