// back-office 인증 — 구글 로그인(팝업) + allowlist. 세션키 prefix=bo_ (core=sc_ 와 격리).
// 콜백 URI 는 core-front(4700) 것을 재사용 — GCP 에 redirect 하나만 등록, postMessage("*")
// 로 BO opener 에 code 전달 (zapp back-office-google-login 결정 이식). BO 는 core-front 가
// 떠 있어야 로그인 가능(compose 로컬·스테이지 항상 함께).

export const STORAGE_PREFIX = "bo_";
export const PLATFORM = "BACK_OFFICE";

export const ACCESS_COOKIE = `${STORAGE_PREFIX}access_token`;
const USER_KEY = `${STORAGE_PREFIX}user`;

export type SessionUser = {
  id: number;
  email: string;
  name: string | null;
  picture: string | null;
  role: string;
};

export function buildGoogleAuthUrl(): string {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
  const redirectUri = process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI ?? "";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    access_type: "online",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function isConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
}

export function getUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function setUser(user: SessionUser): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(USER_KEY);
  document.cookie = `${ACCESS_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
