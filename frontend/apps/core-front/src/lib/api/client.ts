// 브라우저 → Next BFF(`/api/...`) → 백엔드. httpOnly 쿠키의 access token 을 BFF 가
// Authorization 헤더로 넘긴다. 컴포넌트에서 백엔드를 직접 호출하지 않는다.
// docs/frontend-development-guide/api-integration.md

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errorCode?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ErrorBody = {
  errorCode?: string;
  errorMessage?: string;
  message?: string;
};

async function parseError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as ErrorBody | null;
  return new ApiError(
    res.status,
    body?.errorMessage ?? body?.message ?? `Request failed (${res.status})`,
    body?.errorCode,
  );
}

/** 동일 오리진 BFF 호출. 401 이면 refresh 1회 후 재시도. */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const init: RequestInit = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  };

  const res = await fetch(path, init);
  if (res.status !== 401) return res;

  const refreshed = await fetch('/api/auth/refresh', { method: 'POST' });
  if (!refreshed.ok) return res;
  return fetch(path, init);
}

export async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch(path, options);
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
