import { useCallback, useState } from 'react';

const EMPTY: ReadonlyMap<number, string> = new Map();

/**
 * 「보기」로 받은 이메일 원본 보관소 — **페이지 컴포넌트 state 에만** 둔다(Map).
 * 쿼리 캐시·URL·localStorage 에 넣지 않는다.
 *
 * `listVersion` 은 목록을 받을 때마다 바뀌는 값(`dataUpdatedAt`)이다. 바뀌면 전부 비운다 —
 * 목록을 다시 받으면 다시 가려지고, 다시 보려면 다시 눌러야 한다(그때 감사 로그가 다시 남는다).
 */
export function useRevealedEmails(listVersion: number) {
  const [emails, setEmails] = useState(EMPTY);
  const [version, setVersion] = useState(listVersion);

  // 렌더 중에 맞춘다(React 권장 패턴) — effect 로 지우면 새 목록이 한 번 원본과 함께 그려진다
  if (version !== listVersion) {
    setVersion(listVersion);
    setEmails(EMPTY);
  }

  const reveal = useCallback((accountId: number, email: string) => {
    setEmails((prev) => new Map(prev).set(accountId, email));
  }, []);

  return { emails, reveal };
}
