import { z } from 'zod';

import { sessionUserSchema } from './response-schema';
import { API_BASE } from '@/lib/http';

// core-front 인증 — 구글 로그인(팝업) + 세션(localStorage + 쿠키).
// 세션키 prefix 는 앱별 상수(core=sc_) — BO(bo_)와 격리해 localhost 쿠키 domain 공유 오염 방지.
// (zapp back-office-google-login spec 의 세션키 격리 함정 이식)


export const STORAGE_PREFIX = 'sc_';

export const PLATFORM = 'CORE';

export { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/cookie-names';
const USER_KEY = `${STORAGE_PREFIX}user`;
const SUGGESTED_NICKNAME_KEY = `${STORAGE_PREFIX}suggested_nickname`;
const LOGIN_METHOD_KEY = `${STORAGE_PREFIX}login_method`;

/** UI 세션용 회원 스냅샷. localStorage 키는 sc_user 로 유지한다. */
export type SessionUser = {
  id: number;
  email: string;
  nickname: string | null;
  picture: string | null;
  role: string;
  timeZone?: string | null;
  onboardingCompletedAt?: string | null;
};

/** 브라우저에서 구글 OAuth authorize URL (팝업으로 연다). */
export function buildGoogleAuthUrl(): string {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
  const redirectUri = process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI ?? '';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    access_type: 'online',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** 애플 Services ID — 공개 식별자. 돌아올 주소는 Apple Developer 에 등록된 것만 받는다(studyclub.life · stage). 로컬은 애플이 localhost 를 안 받아 쓸 수 없다 */
export const APPLE_WEB_CLIENT_ID = 'life.studyclub.web';

export function appleRedirectUri(): string {
  return `${window.location.origin}/api/auth/apple/callback`;
}

/** 브라우저에서 애플 authorize URL (팝업으로 연다). name·email 을 받으려면 form_post 여야 한다 */
export function buildAppleAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: APPLE_WEB_CLIENT_ID,
    redirect_uri: appleRedirectUri(),
    response_type: 'code',
    response_mode: 'form_post',
  });
  // scope 의 공백은 %20 이어야 한다 — URLSearchParams 가 만드는 '+' 를 애플은 공백으로 읽지 않아
  // 이름·이메일을 요청하지 않은 것으로 처리한다(선택 화면 없음, id_token 에 email 없음 → 가입 거절)
  return `https://appleid.apple.com/auth/authorize?${params.toString()}&scope=name%20email`;
}

export function isConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
}

// --- client session (localStorage) ---
export function getUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? sessionUserSchema.parse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** 세션 user 가 바뀌면 쏜다 — 헤더처럼 이미 떠 있는 화면이 다시 읽게 한다. */
export const USER_CHANGED_EVENT = 'sc:user-changed';

export function setUser(user: SessionUser): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(USER_CHANGED_EVENT));
}

/** 구글 name — 온보딩 닉네임 칸 초기값. DB 에 저장하지 않는다. */
export function getSuggestedNickname(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(SUGGESTED_NICKNAME_KEY);
  } catch {
    return null;
  }
}

export function setSuggestedNickname(value: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!value) window.sessionStorage.removeItem(SUGGESTED_NICKNAME_KEY);
    else window.sessionStorage.setItem(SUGGESTED_NICKNAME_KEY, value);
  } catch {
    // sessionStorage 비활성 환경에서는 닉네임 칸만 비운다.
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(USER_KEY);
  setSuggestedNickname(null);
  window.dispatchEvent(new Event(USER_CHANGED_EVENT));
}

/** 로그아웃 — localStorage 유저 제거 + 서버 라우트로 httpOnly 쿠키 제거. */
export async function logout(): Promise<void> {
  clearSession();
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // 네트워크 실패해도 클라이언트 세션은 이미 지움
  }
}

/** 탈퇴 사유 — 정해진 값 셋. 자유 입력은 없다 (specs/user-leave/spec.md). */
export type LeaveReason = 'NO_DESIRED_STUDY' | 'PARTICIPATION_BURDEN' | 'OTHER';

export type DeleteAccountResult = { ok: true } | { ok: false; errorCode: string; errorMessage: string };

/**
 * 회원 탈퇴 — DELETE /api/me. 백엔드를 직접 호출한다(`lib/http.ts` 와 같은 이유 — access 쿠키가
 * httpOnly 라도 `credentials: 'include'` 로 브라우저가 자동으로 싣고, API 가 쿠키에서 꺼내 쓴다.
 * 중계 라우트가 필요 없다). 성공하면 새 정리 로직을 만들지 않고 기존 {@link logout} 을 그대로
 * 호출한다(localStorage + httpOnly 쿠키 정리 재사용). 서버가 발급한 토큰 자체를 무효화하지는
 * 못한다(스펙의 "알려진 한계").
 */
export async function deleteAccount(reason: LeaveReason | null): Promise<DeleteAccountResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/me`, {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
  } catch {
    return { ok: false, errorCode: 'NETWORK_ERROR', errorMessage: '네트워크에 연결할 수 없습니다.' };
  }

  if (!res.ok) {
    const parsed = z.object({ errorCode: z.string().optional(), errorMessage: z.string().optional() }).safeParse(await res.json().catch(() => null));
    const data = parsed.success ? parsed.data : {};
    // 이미 탈퇴 처리된 계정(NOT_FOUND) — 서버는 끝났는데 응답만 못 받았거나 다른 탭에서 먼저 탈퇴한 경우다.
    // 오류로 막아 두면 토큰이 남은 사용자가 재시도해도 영원히 정리되지 않으므로 성공과 같이 세션을 정리한다.
    if (res.status !== 404 || data.errorCode !== 'NOT_FOUND') {
      return {
        ok: false,
        errorCode: data.errorCode ?? 'INTERNAL_ERROR',
        errorMessage: data.errorMessage ?? '탈퇴 처리 중 오류가 발생했습니다.',
      };
    }
  }

  await logout();
  return { ok: true };
}

export type LoginMethod = 'google' | 'apple';

/** 이번 로그인 수단 — 온보딩 완료 때 `User Signed Up` 의 method 로 쓴다. 없으면 google(애플 이전 가입은 전부 구글이다) */
export function getLoginMethod(): LoginMethod {
  if (typeof window === 'undefined') return 'google';
  try {
    return window.sessionStorage.getItem(LOGIN_METHOD_KEY) === 'apple' ? 'apple' : 'google';
  } catch {
    return 'google';
  }
}

export function setLoginMethod(value: LoginMethod): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(LOGIN_METHOD_KEY, value);
  } catch {
    // sessionStorage 를 못 쓰면 google 로 센다
  }
}
