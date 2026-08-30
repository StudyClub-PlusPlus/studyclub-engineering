'use client';

import { getUser, setUser, type SessionUser } from '@core/lib/auth';
import { seedDemoData } from '@core/lib/me';

/**
 * 프로토타입 미리보기 세션 — **로컬 개발 서버에서만** 쓰인다.
 *
 * 구글 OAuth 키가 로컬에 없어 실제 로그인을 할 수 없는데, 마이페이지는 로그인해야 보이는
 * 화면이라 기획·디자인 검토를 할 방법이 없다. 개발팀이 만든 로그인 게이트는 손대지 않는다.
 */
/**
 * 프로토에서는 항상 켠다.
 *
 * 원본은 로컬 개발 서버(NODE_ENV=development)에서만 미리보기를 열어 준다. playground 는
 * 빌드해서 배포하므로 그 조건이면 production 이라 로그인 게이트에 막히고, 정작 보여 주려던
 * 마이페이지·내 스터디를 아무도 못 본다. 여기는 mock 전용 표면이라 게이트가 지킬 것이 없다.
 */
export const IS_DEV = true;

/** 미리보기 세션 식별자. 실제 회원은 서버가 발급한 양수 id 를 갖는다. */
const PREVIEW_ID = 0;

export const PREVIEW_USER: SessionUser = {
  id: PREVIEW_ID,
  email: 'jiwon@example.com',
  name: '지원',
  picture: null,
  role: 'MEMBER',
};

export function isPreview(user: SessionUser | null): boolean {
  return user?.id === PREVIEW_ID;
}

/**
 * 저장된 미리보기 세션을 현재 정의로 맞춘다.
 * 예전에 열어본 브라우저에는 옛 이름이 남아 있어, 더미를 바꿔도 화면이 그대로다.
 */
export function syncPreview(): SessionUser | null {
  const u = getUser();
  if (!isPreview(u)) return u;
  if (u!.name !== PREVIEW_USER.name || u!.email !== PREVIEW_USER.email) {
    setUser(PREVIEW_USER);
    return PREVIEW_USER;
  }
  return u;
}

/** 미리보기로 들어간다 — 세션을 넣고 더미를 채운다. */
export function enterPreview() {
  setUser(PREVIEW_USER);
  // 미들웨어가 존재 여부만 보는 게이트 쿠키. 서버가 발급하는 진짜 토큰이 아니다.
  document.cookie = 'sc_access_token=dev-preview; path=/';
  seedDemoData();
}
