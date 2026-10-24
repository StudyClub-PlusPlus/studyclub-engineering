import { http, qs } from '@/lib/http';

/**
 * 기능별 repository(`features/*\/repository.ts`)가 쓰는 클라이언트. 메서드 · 쿼리스트링 · JSON 본문만 맞추고,
 * 쿠키 인증 · 오류 변환(`ApiError` — 서버 `errorMessage`)은 `http` 그대로다.
 *
 * - 성공 응답에는 래퍼가 없다 — 본문이 곧 결과다. 204 는 `null` 이 돌아온다.
 * - 인증 헤더를 붙이지 않는다 — 액세스 토큰은 httpOnly 쿠키라 JS 가 읽지 못한다 (`lib/http.ts`).
 */
const httpClient = (() => {
  type Params = Record<string, string | number | boolean | undefined | null>;

  function withQuery(url: string, params?: Params): string {
    if (!params) return url;
    return `${url}${qs(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, typeof v === 'boolean' ? String(v) : v])))}`;
  }

  function send<T>(method: string, url: string, data?: unknown): Promise<T> {
    return http<T>(url, {
      method,
      ...(data !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
    });
  }

  return {
    get<T>(url: string, config?: { params?: Params; signal?: AbortSignal }): Promise<T> {
      return http<T>(withQuery(url, config?.params), { signal: config?.signal });
    },

    post<T>(url: string, data?: unknown): Promise<T> {
      return send<T>('POST', url, data);
    },

    put<T>(url: string, data?: unknown): Promise<T> {
      return send<T>('PUT', url, data);
    },

    patch<T>(url: string, data?: unknown): Promise<T> {
      return send<T>('PATCH', url, data);
    },

    /** 일괄 삭제처럼 본문이 있는 DELETE 는 `config.data` 로 싣는다 (axios 와 같은 모양). */
    delete<T>(url: string, config?: { data?: unknown }): Promise<T> {
      return send<T>('DELETE', url, config?.data);
    },
  };
})();

export default httpClient;
