// core-front 인증 — 구글 로그인(팝업) + 세션(localStorage + 쿠키).
// 세션키 prefix 는 앱별 상수(core=sc_) — BO(bo_)와 격리해 localhost 쿠키 domain 공유 오염 방지.
// (zapp back-office-google-login spec 의 세션키 격리 함정 이식)

import { API_BASE } from './http';

export const STORAGE_PREFIX = 'sc_';
export const PLATFORM = 'CORE';

export const ACCESS_COOKIE = `${STORAGE_PREFIX}access_token`;
export const REFRESH_COOKIE = `${STORAGE_PREFIX}refresh_token`;
const USER_KEY = `${STORAGE_PREFIX}user`;
const SUGGESTED_NICKNAME_KEY = `${STORAGE_PREFIX}suggested_nickname`;

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

export function isConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
}

// --- client session (localStorage) ---
export function getUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function setUser(user: SessionUser): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
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

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; errorCode: string; errorMessage: string };

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
    const data = await res.json().catch(() => ({}));
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
