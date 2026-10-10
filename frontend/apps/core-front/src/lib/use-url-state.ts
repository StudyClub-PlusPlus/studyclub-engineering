'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/**
 * 목록 화면의 탭·필터·검색어·페이지를 **URL 쿼리**로 든다 — 새로고침·뒤로 가기에도 조건이 남는다.
 * 규약: docs/frontend-development-guide/api-integration.md 「필터·검색·페이지는 URL 에」.
 *
 * - `defaults` 와 같은 값은 URL 에서 뺀다 — 첫 화면 주소가 깨끗하고 같은 상태가 주소 둘로 갈리지 않는다
 * - `allowed` 에 없는 값은 기본값으로 되돌린다 — URL 은 누구나 고칠 수 있다
 * - `router.replace` 로 바꾼다 — 조건마다 기록이 쌓이면 뒤로 가기가 한 단계씩 되돌아간다
 *
 * `defaults`·`allowed` 는 모듈 상수로 넘긴다(렌더마다 새 객체면 `set` 이 매번 바뀐다).
 * 이 훅을 쓰는 컴포넌트는 정적 프리렌더되는 페이지라면 `<Suspense>` 안에 둔다(Next 요구사항).
 */
export function useUrlState<T extends Record<string, string>>(
  defaults: T,
  allowed: { [K in keyof T]?: readonly string[] } = {},
) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const state = { ...defaults };
  for (const key in defaults) {
    const raw = params.get(key);
    if (raw !== null && raw !== '' && (allowed[key]?.includes(raw) ?? true)) {
      state[key] = raw as T[typeof key];
    }
  }

  const set = useCallback(
    (patch: Partial<T>) => {
      const next = new URLSearchParams(params.toString());
      for (const key in patch) {
        const value = patch[key];
        if (value === undefined || value === '' || value === defaults[key]) next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, router, pathname, defaults],
  );

  return [state, set] as const;
}

/** `page` 쿼리 값 → 1 이상의 정수. 숫자가 아니면 1. */
export function pageOf(value: string): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}
