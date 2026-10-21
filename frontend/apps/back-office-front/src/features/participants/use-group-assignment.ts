import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useIsMutating } from '@tanstack/react-query';

import { participantKeys, useSaveGroupAssignments } from './queries';
import type { Participant } from './types';

export function useGroupAssignment(
  studyId: number,
  participants: Participant[],
  onDirtyChange?: (dirty: boolean) => void,
) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, number>>({});
  const [notice, setNotice] = useState('');
  const mutation = useSaveGroupAssignments(studyId);
  const saving = useIsMutating({ mutationKey: participantKeys.list(studyId) }) > 0;
  const dirty = Object.keys(drafts).length > 0;
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
      if (saving) return;
      setPendingHref(destination.pathname + destination.search + destination.hash);
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', followLink, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', followLink, true);
    };
  }, [dirty, saving]);
  function change(ids: number[], groupId: number) {
    if (saving) return;
    setNotice('');
    mutation.reset();
    setDrafts((current) => {
      const next = { ...current };
      for (const id of ids) {
        if (participants.find((p) => p.participantId === id)?.groupId === groupId) delete next[id];
        else next[id] = groupId;
      }
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
      Object.entries(drafts).map(([id, groupId]) => ({ participantId: Number(id), groupId })),
      {
        onSuccess: () => {
          setDrafts({});
          setNotice('저장했습니다.');
        },
      },
    );
  }
  function confirmNavigation() {
    if (!pendingHref || saving) return;
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
    pendingHref,
    cancelNavigation: () => setPendingHref(null),
    confirmNavigation,
  };
}
