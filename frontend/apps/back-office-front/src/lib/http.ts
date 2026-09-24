// 같은 출처의 BFF(`/api/*`)를 부르는 얇은 래퍼.
//
// 백엔드를 직접 부르지 않는다 — 토큰이 httpOnly 쿠키라 브라우저 JS 가 Authorization 헤더를
// 붙일 수 없다. BFF 가 서버에서 쿠키를 읽어 Bearer 로 바꿔 준다.
// (docs/frontend-development-guide/api-integration.md)

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 백엔드 오류 바디는 `{ errorCode, errorMessage }`, BFF 자체 오류는 `{ message }` 다. */
function messageOf(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const b = body as { errorMessage?: string; message?: string };
    if (b.errorMessage) return b.errorMessage;
    if (b.message) return b.message;
  }
  return `요청에 실패했습니다 (${status})`;
}

export async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: 'no-store', ...init });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, messageOf(body, res.status));
  return body as T;
}

/** 쿼리스트링을 만든다 — 값이 없는 조건은 아예 넣지 않는다(빈 문자열이 필터로 잡히면 결과가 달라진다). */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
