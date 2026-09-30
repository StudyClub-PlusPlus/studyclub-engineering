// core-front 인증 — 구글 로그인(팝업) + 세션(localStorage + 쿠키).
// 세션키 prefix 는 앱별 상수(core=sc_) — BO(bo_)와 격리해 localhost 쿠키 domain 공유 오염 방지.
// (zapp back-office-google-login spec 의 세션키 격리 함정 이식)

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
