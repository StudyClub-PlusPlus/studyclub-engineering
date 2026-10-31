import { z } from 'zod';

export const emptyResponseSchema = z.null();
const nicknameSnapshotSchema = z.object({
  nickname: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
});

// 백엔드 API 를 브라우저에서 직접 부른다. 중계(BFF) 라우트를 두지 않는다.
//
// 인증이 필요한 요청은 **쿠키**로 간다 — 액세스 토큰이 httpOnly 라 JS 가 값을 읽어 헤더를 만들 수
// 없지만, 브라우저는 쿠키를 자동으로 실어 보낼 수 있다. 백엔드가 그 쿠키에서 토큰을 꺼낸다.
// 공개 API(스터디 목록 등)는 쿠키가 없어도 그대로 응답한다.
//
// 전제: 백엔드 CORS 허용 오리진이 좁게 유지될 것 · 배포에서 쿠키가 API 도메인까지 닿을 것
// (`AUTH_COOKIE_DOMAIN`, 로컬은 host 가 같아 불필요).

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function messageOf(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const parsed = z.object({ errorMessage: z.string().optional(), message: z.string().optional() }).safeParse(body);
    if (parsed.success) return parsed.data.errorMessage || parsed.data.message || `요청에 실패했습니다 (${status})`;
  }
  return `요청에 실패했습니다 (${status})`;
}

function currentClientNickname(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('sc_user') ?? window.localStorage.getItem('user');
    if (!raw) return null;
    const user = nicknameSnapshotSchema.parse(JSON.parse(raw));
    return user?.nickname || user?.name || null;
  } catch {
    return null;
  }
}

export async function http<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
  options?: { refreshOnUnauthorized?: boolean },
): Promise<T> {
  const headers = new Headers(init?.headers);
  const nickname = currentClientNickname();
  if (nickname) {
    headers.set('x-user-nickname', encodeURIComponent(nickname));
  }
  const request: RequestInit = {
    cache: 'no-store',
    credentials: 'include',
    ...init,
    headers,
  };
  let res = await fetch(`${API_BASE}${path}`, request);
  // 가입·닉네임 확인에서 사용하던 갱신 정책. 다른 요청은 명시적으로 선택할 때만 적용한다.
  if (res.status === 401 && options?.refreshOnUnauthorized) {
    const refreshed = await fetch('/api/auth/refresh', { method: 'POST', signal: init?.signal });
    if (refreshed.ok) res = await fetch(`${API_BASE}${path}`, request);
  }
  const raw = await res.text();
  let body: unknown = null;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch (error) {
    if (res.ok) throw error;
  }
  if (!res.ok) throw new ApiError(res.status, messageOf(body, res.status), body);
  return schema.parse(body);
}
