/**
 * 화면 콘텐츠 폭 규약 — docs/frontend-development-guide/layout.md 가 정본. 새 페이지는 여기서 고른다.
 *
 * - PAGE: 모든 페이지의 바깥 틀. 헤더·푸터와 같은 선(max-w-6xl)에 맞춘다
 * - READ: 긴 글을 읽는 단(공지·약관 본문, 소개 문단). 한 줄이 너무 길면 읽기 어렵다
 * - FORM: 입력·설정 단(마이페이지 폼, 온보딩)
 * - DETAIL: 상세(스터디·행사·공지) 2단 — 왼쪽 본문, 오른쪽 340px 정보·행동 카드(넓은 화면에서 따라온다)
 */
export const PAGE = 'mx-auto w-full max-w-6xl px-6';
export const READ = 'max-w-3xl';
export const FORM = 'max-w-2xl';
export const DETAIL_GRID = 'grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]';
export const DETAIL_ASIDE = 'lg:sticky lg:top-24';
