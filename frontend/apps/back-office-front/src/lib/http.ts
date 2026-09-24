// 백엔드 API 를 브라우저에서 직접 부른다. 중계(BFF) 라우트를 두지 않는다.
//
// 인증은 **쿠키**로 간다 — 액세스 토큰은 httpOnly 라 JS 가 값을 읽어 Authorization 헤더를 만들 수
// 없다. 대신 `credentials: 'include'` 로 브라우저가 쿠키를 싣고, 백엔드(JwtAuthFilter)가 쿠키에서
// 토큰을 꺼낸다. 토큰을 localStorage 로 내리지 않는다 — XSS 한 번에 털린다.
//
// 그래서 두 가지가 전제다:
//   1) 백엔드 CORS 허용 오리진이 **좁게** 유지될 것 (`cors.allowed-origins`)
//   2) 배포 환경에서 쿠키가 API 도메인까지 닿을 것 (`AUTH_COOKIE_DOMAIN`, 로컬은 불필요)

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

/** 백엔드 오류 바디는 `{ errorCode, errorMessage }` 다. */
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
    credentials: 'include', // 쿠키 인증 — 빼면 전부 401 이다
    ...init,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, messageOf(body, res.status));
  return body as T;
}

/** 쿼리스트링 — 값이 없는 조건은 넣지 않는다(빈 문자열이 필터로 잡히면 결과가 달라진다). */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
