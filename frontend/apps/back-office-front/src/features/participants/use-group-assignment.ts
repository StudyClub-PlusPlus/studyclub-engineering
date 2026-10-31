import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useIsMutating } from '@tanstack/react-query';

import { participantKeys, useSaveGroupAssignments } from './queries';
import type { Participant } from './types';
import { blockHistoryNavigation } from '@/lib/history-guard';

type Draft = Partial<Pick<Participant, 'groupId' | 'participantRole'>>;

const fieldCount = (drafts: Record<number, Draft>) =>
  Object.values(drafts).reduce((count, draft) => count + Object.keys(draft).length, 0);

export function useGroupAssignment(
  studyId: number,
  participants: Participant[],
  onDirtyChange?: (dirty: boolean) => void,
) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [pendingHistory, setPendingHistory] = useState<(() => void) | null>(null);
  const [pendingChanges, setDrafts] = useState<Record<number, Draft>>({});
  const drafts: Record<number, Draft> = Object.fromEntries(
    Object.entries(pendingChanges).flatMap(([id, draft]) => {
      const participant = participants.find((p) => p.participantId === Number(id));
      if (!participant || (participant.status !== 'ACTIVE' && participant.status !== 'PAUSED')) return [];
      const changed = Object.fromEntries(
        Object.entries(draft).filter(([key, value]) => participant[key as keyof Draft] !== value),
      );
      return Object.keys(changed).length > 0 ? [[id, changed]] : [];
    }),
  );
  // 재조회로 무의미해진 변경은 state 에서도 지운다. 남겨 두면 서버 반·역할이 다시 바뀔 때 되살아난다.
  // 렌더 중 갱신은 React 의 「props 에 맞춰 state 조정」 패턴이고, 칸 수가 같아지면 멈춘다.
  if (fieldCount(drafts) !== fieldCount(pendingChanges)) setDrafts(drafts);
  const [notice, setNotice] = useState('');
  const mutation = useSaveGroupAssignments(studyId);
  const saving = useIsMutating({ mutationKey: participantKeys.assignments(studyId) }) > 0;
  const dirty = Object.keys(drafts).length > 0;
  useEffect(() => {
    if (!dirty && !saving) return;
    // 저장 중에도 이동을 기록해 두고 창을 띄운다. 「변경 취소 후 이동」은 저장이 끝나야 눌린다.
    return blockHistoryNavigation((resume) => setPendingHistory(() => resume));
  }, [dirty, saving]);
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty && !saving) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const followLink = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        anchor.download ||
        (anchor.target && anchor.target !== '_self')
      )
        return;
      const destination = new URL(anchor.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(destination.pathname + destination.search + destination.hash);
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', followLink, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', followLink, true);
    };
  }, [dirty, saving]);
  // 원래 값으로 되돌린 칸은 위 drafts 계산이 빼 준다.
  function change(ids: number[], patch: Draft) {
    if (saving) return;
    setNotice('');
    mutation.reset();
    setDrafts((current) => {
      const next = { ...current };
      for (const id of ids) next[id] = { ...next[id], ...patch };
      return next;
    });
  }
  function discard() {
    if (saving) return;
    setDrafts({});
    setNotice('');
    mutation.reset();
  }
  function save() {
    if (!dirty || saving) return;
    mutation.mutate(
      Object.entries(drafts).map(([id, draft]) => ({ participantId: Number(id), ...draft })),
      {
        onSuccess: () => {
          setDrafts({});
          setNotice('저장했습니다.');
        },
      },
    );
  }
  function confirmNavigation() {
    if (saving) return;
    if (pendingHistory) {
      discard();
      setPendingHistory(null);
      pendingHistory();
      return;
    }
    if (!pendingHref) return;
    const href = pendingHref;
    discard();
    setPendingHref(null);
    router.push(href);
  }
  return {
    drafts,
    dirty,
    saving,
    notice,
    mutation,
    change,
    discard,
    save,
    navigationPending: pendingHref !== null || pendingHistory !== null,
    cancelNavigation: () => {
      setPendingHref(null);
      setPendingHistory(null);
    },
    confirmNavigation,
  };
}
