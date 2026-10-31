import { useCallback, useState } from 'react';

const EMPTY: ReadonlyMap<number, string> = new Map();

/** 이메일처럼 페이지 state에만 보관하고, 목록 데이터가 갱신되면 다시 가린다. */
export function useRevealedDiscordHandles(listVersion: number) {
  const [state, setState] = useState({ version: listVersion, handles: EMPTY });

  if (state.version !== listVersion) {
    setState({ version: listVersion, handles: EMPTY });
  }

  const reveal = useCallback(
    (accountId: number, handle: string) => {
      setState((prev) => {
        // 이전 목록에서 시작한 요청이 늦게 끝나도 새 목록에 원본을 다시 펼치지 않는다.
        if (prev.version !== listVersion) return prev;
        return { ...prev, handles: new Map(prev.handles).set(accountId, handle) };
      });
    },
    [listVersion],
  );

  return { handles: state.handles, reveal };
}
