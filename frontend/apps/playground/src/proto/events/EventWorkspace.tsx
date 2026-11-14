'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { createEventPreviewState } from '@studyclub/mock';
import type { EventPreviewState } from '@studyclub/types';

import { transition, type EventAction } from './model';

const STORAGE_KEY = 'studyclub-event-preview-v1';
type Workspace = {
  state: EventPreviewState | null;
  now: number;
  warning: string;
  dispatch: (action: EventAction) => string | null;
  reset: () => void;
};
const Context = createContext<Workspace | null>(null);

export function EventWorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<EventPreviewState | null>(null);
  const ref = useRef<EventPreviewState | null>(null);
  const [now, setNow] = useState(0);
  const [warning, setWarning] = useState('');
  const commit = useCallback((next: EventPreviewState) => {
    ref.current = next;
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setWarning('');
    } catch {
      setWarning('브라우저에 저장하지 못했습니다. 현재 화면에서만 변경사항이 유지됩니다.');
    }
  }, []);
  useEffect(() => {
    let next = createEventPreviewState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as EventPreviewState;
        if (
          saved.version === 1 &&
          Array.isArray(saved.events) &&
          saved.events.every((e) => Array.isArray(e.questions) && typeof e.startsAt === 'string') &&
          Array.isArray(saved.registrations) &&
          Array.isArray(saved.mails)
        )
          next = saved;
      }
    } catch {
      setWarning('저장된 예시를 불러오지 못해 기본 예시로 시작합니다.');
    }
    ref.current = next;
    setState(next);
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);
  const dispatch = useCallback(
    (action: EventAction) => {
      if (!ref.current) return '예시를 불러오는 중입니다.';
      try {
        commit(transition(ref.current, action));
        setNow(Date.now());
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : '처리하지 못했습니다. 다시 시도해 주세요.';
      }
    },
    [commit],
  );
  return (
    <Context.Provider value={{ state, now, warning, dispatch, reset: () => commit(createEventPreviewState()) }}>
      {children}
    </Context.Provider>
  );
}

export function useEventWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error('EventWorkspaceProvider가 필요합니다.');
  return value;
}
