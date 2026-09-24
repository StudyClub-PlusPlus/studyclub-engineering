// 백엔드 API 를 브라우저에서 직접 부른다. 중계(BFF) 라우트를 두지 않는다.
//
// 인증이 필요한 요청은 **쿠키**로 간다 — 액세스 토큰이 httpOnly 라 JS 가 값을 읽어 헤더를 만들 수
// 없지만, 브라우저는 쿠키를 자동으로 실어 보낼 수 있다. 백엔드가 그 쿠키에서 토큰을 꺼낸다.
// 공개 API(스터디 목록 등)는 쿠키가 없어도 그대로 응답한다.
//
// 전제: 백엔드 CORS 허용 오리진이 좁게 유지될 것 · 배포에서 쿠키가 API 도메인까지 닿을 것
// (`AUTH_COOKIE_DOMAIN`, 로컬은 host 가 같아 불필요).

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function messageOf(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const b = body as { errorMessage?: string; message?: string };
    if (b.errorMessage) return b.errorMessage;
    if (b.message) return b.message;
  }
  return `요청에 실패했습니다 (${status})`;
}

export async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    credentials: 'include',
    ...init,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, messageOf(body, res.status));
  return body as T;
}
