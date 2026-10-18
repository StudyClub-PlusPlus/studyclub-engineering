/**
 * 옛 도메인(studyclub-plusplus.com) → studyclub.life — 2026-10-18 리브랜딩.
 * nginx 인그레스의 permanent-redirect 는 경로 변수($request_uri)를 거부하고 snippet 도 막혀 있어 앱에서 넘긴다.
 * 같은 서브도메인·경로·쿼리를 유지한 채 301. 옛 도메인이 아니면 null.
 */
const LEGACY = 'studyclub-plusplus.com';
const CURRENT = 'studyclub.life';

export function legacyRedirectUrl(host: string | null, pathAndQuery: string): string | null {
  const h = (host ?? '').split(':')[0]!.toLowerCase();
  if (h !== LEGACY && !h.endsWith(`.${LEGACY}`)) return null;
  return `https://${h.slice(0, h.length - LEGACY.length)}${CURRENT}${pathAndQuery}`;
}
