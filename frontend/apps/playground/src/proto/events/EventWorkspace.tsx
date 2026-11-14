'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { getTimeZone } from '@core/lib/me';
import { createEventPreviewState, EVENT_NOTICE_TEMPLATE } from '@studyclub/mock';
import type { EventPreviewState } from '@studyclub/types';

import { populateEventExamples } from './examples';
import { mergeNotificationTemplates, transition, type EventAction } from './model';

const STORAGE_KEY = 'studyclub-event-preview-v1';
type Workspace = {
  state: EventPreviewState | null;
  now: number;
  warning: string;
  dispatch: (action: EventAction) => string | null;
  reset: () => void;
};
const Context = createContext<Workspace | null>(null);

export function EventWorkspaceProvider({ children, noticeBody }: { children: ReactNode; noticeBody: string }) {
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
    const defaults = createEventPreviewState(new Date(), noticeBody);
    let next = structuredClone(defaults);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as EventPreviewState;
        if (
          saved.version === 2 &&
          Array.isArray(saved.eventTemplates) &&
          Array.isArray(saved.events) &&
          saved.events.every((e) => Array.isArray(e.questions) && typeof e.startsAt === 'string') &&
          Array.isArray(saved.registrations) &&
          Array.isArray(saved.mails)
        )
          next = saved;
        else if (Array.isArray(saved.events) && Array.isArray(saved.registrations) && Array.isArray(saved.mails)) {
          // 이전 시안에서 만든 개별 행사는 보존하고 기본 예시만 실제 사례로 교체한다.
          const defaults = next.events;
          next.events = [
            ...saved.events.filter((item) => !defaults.some((sample) => sample.id === item.id)),
            ...defaults,
          ];
          const names: Record<string, string> = {
            'sample-1': '바이트나무',
            'sample-2': '오로라킴',
            'sample-3': '모카코더',
            'preview-self': '코딩구름',
          };
          next.registrations = saved.registrations.map((r) => ({ ...r, name: names[r.memberId] ?? r.name }));
          next.mails = saved.mails;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
      }
    } catch {
      setWarning('저장된 예시를 불러오지 못해 기본 예시로 시작합니다.');
    }
    const previous = JSON.stringify(next);
    next.notificationTemplates = mergeNotificationTemplates(
      next.notificationTemplates ?? [], defaults.notificationTemplates ?? [], next.deletedTemplateTriggers,
    );
    const compactHtml = (value: string) => value.replace(/>\s+</g, '><').trim();
    next.notificationTemplates = next.notificationTemplates.map((template) => {
      if (!template.trigger.startsWith('EVENT_REGISTRATION_')) return template;
      const sample = defaults.notificationTemplates?.find((item) => item.trigger === template.trigger);
      return sample &&
        (compactHtml(template.body) === compactHtml(sample.body) ||
          (template.subject === sample.subject && template.updatedAt === sample.updatedAt))
        ? { ...template, body: sample.body }
        : template;
    });
    next.events = next.events.map((event) => ({
      ...event,
      questions: event.questions.map((question) =>
        question.type === 'SELECT' ? { ...question, type: 'RADIO' as const } : question,
      ),
    }));
    // 이전에 저장된 기본 예시도 가명으로 바꾸되 편집한 행사 정보는 보존한다.
    const anonymize = (text: string) =>
      text
        .replaceAll('한기용 교수님', '코드별 연사님')
        .replaceAll(
          '실리콘밸리의 기업·창업 경험과 San Jose State University에서의 교육 경험을 바탕으로 이야기합니다.',
          '개발과 커리어에 관한 경험을 나누고 참가자들의 질문에 답합니다.',
        );
    const sampleEmails: Record<string, string> = {
      'crew1@example.test': 'byte.tree@mail.example.test',
      'crew2@example.test': 'aurora.kim@inbox.example.test',
      'crew3@example.test': 'mocha.dev@crew.example.test',
    };
    next.registrations = next.registrations.map((registration) =>
      ['sample-1', 'sample-2', 'sample-3'].includes(registration.memberId) && sampleEmails[registration.email]
        ? { ...registration, email: sampleEmails[registration.email]! }
        : registration,
    );
    const participationBlock = `<p style="margin:0 0 6px 0;font-size:14px;line-height:22px;font-weight:700;color:#282A43;">참여 안내</p>
                  <div style="padding:18px;background-color:#F5F7FF;border-radius:8px;">
                    <p style="margin:0;font-size:14px;line-height:22px;">일정: {{eventSchedule}}</p>
                    <p style="margin:6px 0 0 0;font-size:14px;line-height:22px;">{{participation}}</p>
                  </div>`;
    const noticeBeforeParticipationBlock = `<!-- 행사별 내용은 안내 메일 보내기에서 입력한다. HTML을 직접 작성하지 않는다. -->
                  <div style="margin:0 0 24px 0;font-size:16px;line-height:26px;color:#282A43;">{{notice}}</div>
                  ${participationBlock}`;
    const previousParticipationBlock = `<p style="margin:20px 0 6px 0;font-size:14px;line-height:22px;font-weight:700;color:#282A43;">참여 안내</p>
                  <div style="padding:18px;background-color:#F5F7FF;border-radius:8px;">
                    <p style="margin:0;font-size:14px;line-height:22px;">일정: {{eventSchedule}}</p>
                    <p style="margin:6px 0 0 0;font-size:14px;line-height:22px;">{{participation}}</p>
                  </div>
                  <!-- 행사별 내용은 안내 메일 보내기에서 입력한다. HTML을 직접 작성하지 않는다. -->
                  <div style="margin:24px 0 0 0;font-size:16px;line-height:26px;color:#282A43;">{{notice}}</div>`;
    const previousNoticeBody = noticeBody.replace(noticeBeforeParticipationBlock, previousParticipationBlock);
    const legacyParticipationBlock = [
      '<p style="margin:0;font-size:14px;line-height:22px;">일정: {{eventSchedule}}</p>',
      '<p style="margin:20px 0 6px 0;font-size:14px;line-height:22px;font-weight:700;color:#282A43;">참여 안내</p>',
      '<p style="margin:0;font-size:14px;line-height:22px;">{{participation}}</p>',
    ].join('\n                  ');
    const legacyNoticeBody = noticeBody.replace(participationBlock, legacyParticipationBlock);
    const defaultNoticeBodies = new Set([
      noticeBody,
      previousNoticeBody,
      '안녕하세요, {{nickname}}님.\n\n{{eventTitle}} 행사 안내드립니다.\n\n일정: {{eventSchedule}}\n참여 안내: {{participation}}\n\n{{notice}}\n\n감사합니다.\nStudyClub 드림',
      legacyNoticeBody,
      legacyNoticeBody.replace(
        legacyParticipationBlock,
        '<p style="margin:0 0 8px 0;font-size:14px;line-height:22px;">일정: {{eventSchedule}}<br>참여 안내<br>{{participation}}</p>',
      ),
      legacyNoticeBody.replace(
        legacyParticipationBlock,
        '<p style="margin:0 0 8px 0;font-size:14px;line-height:22px;">일정: {{eventSchedule}}<br>참여 안내: {{participation}}</p>',
      ),
    ]);
    // 이전 기본 양식만 최신 프레임으로 교체한다. 직접 수정한 템플릿은 유지한다.
    next.eventTemplates = next.eventTemplates.map((template) =>
      template.id === 3 && (template.body === EVENT_NOTICE_TEMPLATE.body || defaultNoticeBodies.has(template.body))
        ? { ...template, body: noticeBody }
        : template,
    );
    next.notificationTemplates = next.notificationTemplates?.map((template) =>
      template.id === 3 &&
      template.trigger === 'EVENT_ANNOUNCEMENT' &&
      (template.body === EVENT_NOTICE_TEMPLATE.body || defaultNoticeBodies.has(template.body))
        ? { ...template, body: noticeBody }
        : template,
    );
    next.events = next.events.map((event) =>
      event.id === 'preview-event-community'
        ? { ...event, summary: anonymize(event.summary), description: anonymize(event.description) }
        : event,
    );
    next = populateEventExamples(next, createEventPreviewState(new Date(), noticeBody), Date.now(), getTimeZone());
    if (JSON.stringify(next) !== previous) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        setWarning('브라우저에 저장하지 못했습니다. 현재 화면에서만 변경사항이 유지됩니다.');
      }
    }
    ref.current = next;
    setState(next);
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const saved = JSON.parse(event.newValue) as EventPreviewState;
        if (
          saved.version === 2 &&
          Array.isArray(saved.events) &&
          Array.isArray(saved.registrations) &&
          Array.isArray(saved.mails) &&
          Array.isArray(saved.eventTemplates)
        ) {
          ref.current = saved;
          setState(saved);
          setNow(Date.now());
        }
      } catch {
        /* 다른 탭에서 저장한 값이 잘못되면 현재 시안을 유지한다. */
      }
    };
    window.addEventListener('storage', sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', sync);
    };
  }, [noticeBody]);
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
    <Context.Provider
      value={{
        state,
        now,
        warning,
        dispatch,
        reset: () => {
          const defaults = createEventPreviewState(new Date(), noticeBody);
          commit(populateEventExamples(defaults, defaults, Date.now(), getTimeZone()));
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useEventWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error('EventWorkspaceProvider가 필요합니다.');
  return value;
}
