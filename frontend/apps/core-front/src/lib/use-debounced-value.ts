import { useEffect, useState } from 'react';

/** 값이 `delayMs` 동안 그대로일 때만 따라온다 — 타이핑마다 서버를 부르지 않으려는 용도. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
