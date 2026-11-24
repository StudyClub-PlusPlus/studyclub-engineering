'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { ClubAttendanceBoard } from '@console/components/ClubAttendanceBoard';
import { ClubCarryOver } from '@console/components/ClubCarryOver';
import { ClubCohortPanel, type AutoDraft, type NextState } from '@console/components/ClubCohortPanel';
import {
  clubOf,
  CLUBS,
  cohortTitle,
  DEFAULT_DRAFT_DAY,
  DEMO_TODAY,
  monthOf,
  seedBook,
  seedMembers,
  type ClubBook,
  type ClubKey,
  type ClubMember,
  type DemoDay,
} from '@console/lib/clubs';
import { Button, Modal, Segmented, Tabs } from '@studyclub/ui';

import { useAnnotate } from '@/proto/annotate';

/**
 * 클럽 운영 — 매달 기수가 바뀌는 클럽(얼리버드 · WEEKLY X · Daily LeetCode)을 한 화면에서 굴린다.
 *
 * 탭은 둘이다 — **기수**(이번 기수 · 다음 기수 · 이어서 참여)와 **출석부**(이번 기수의 날짜별 출석).
 * 신청 폼 · 신청 결과 · 정보 수정은 기수 하나의 일이라 스터디 운영 화면(스터디 › 상세)이 맡는다.
 */

type TabKey = 'cohort' | 'book';
type Dirty = { carry: boolean; book: boolean };

type ClubState = {
  members: ClubMember[];
  book: ClubBook;
  excluded: string[];
  /** 캡틴이 직접 바꾼 다음 기수 상태. 없으면 자동 초안 규칙으로 정한다 */
  next?: NextState;
  auto: AutoDraft;
};

function seed(key: ClubKey, today: string): ClubState {
  const club = clubOf(key);
  const members = seedMembers(club);
  return {
    members,
    book: seedBook(club, members, today),
    excluded: key === 'earlybird' ? [`${key}-5`] : [],
    auto: { on: true, day: DEFAULT_DRAFT_DAY },
  };
}

export function ClubConsole() {
  const [demo, setDemo] = useState<DemoDay>('after');
  const today = DEMO_TODAY[demo];
  const [clubKey, setClubKey] = useState<ClubKey>('earlybird');
  const [tab, setTab] = useState<TabKey>('cohort');
  const [state, setState] = useState<Record<ClubKey, ClubState>>(() => ({
    earlybird: seed('earlybird', DEMO_TODAY.after),
    weeklyx: seed('weeklyx', DEMO_TODAY.after),
    leetcode: seed('leetcode', DEMO_TODAY.after),
  }));
  const [dirty, setDirty] = useState<Dirty>({ carry: false, book: false });
  const [leave, setLeave] = useState<(() => void) | null>(null);

  // 스토리 칩을 고르면 그 Story 의 요소가 보이는 탭으로 옮긴다
  const { spec, on } = useAnnotate();
  const wanted: TabKey | undefined =
    spec?.scope === 'clubbook' ? 'book' : spec?.scope === 'cohort' || spec?.scope === 'carry' ? 'cohort' : undefined;
  useEffect(() => {
    if (on && wanted) setTab(wanted);
  }, [on, wanted]);

  const club = clubOf(clubKey);
  const cur = state[clubKey];
  const current = monthOf(today);
  // 다음 기수 — 캡틴이 바꾼 값이 먼저, 아니면 「자동 초안이 켜져 있고 그날이 지났는가」
  const next: NextState =
    cur.next ?? (cur.auto.on && Number(today.slice(8, 10)) >= cur.auto.day ? 'draft' : 'none');
  const activeCount = cur.members.filter((m) => !m.leftOn).length;
  const carryCount = cur.members.filter((m) => !m.leftOn && !cur.excluded.includes(m.id)).length;

  const patch = useCallback(
    (fn: (s: ClubState) => ClubState) => setState((prev) => ({ ...prev, [clubKey]: fn(prev[clubKey]) })),
    [clubKey],
  );

  const anyDirty = dirty.carry || dirty.book;
  const guard = (go: () => void) => (anyDirty ? setLeave(() => go) : go());
  const onCarryDirty = useCallback((d: boolean) => setDirty((x) => (x.carry === d ? x : { ...x, carry: d })), []);
  const onBookDirty = useCallback((d: boolean) => setDirty((x) => (x.book === d ? x : { ...x, book: d })), []);

  const clubOptions = useMemo(() => CLUBS.map((c) => ({ value: c.key, label: c.title })), []);

  return (
    <div>
      <div className='flex flex-wrap items-start justify-between gap-4'>
        <div>
          <h1 className='type-headline-md'>클럽 운영</h1>
          <p className='mt-1 type-body-sm text-fg-muted'>매달 1일에 시작해 말일에 끝나는 클럽 기수를 운영합니다.</p>
        </div>
        {/* 프로토 검토 도구 — 「오늘」을 바꿔 초안이 만들어지기 전과 뒤를 본다. 실제 화면에는 없다 */}
        <div className='flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2'>
          <span className='type-label-sm text-fg-muted'>프로토 · 오늘</span>
          <Segmented
            size='sm'
            value={demo}
            onChange={(v) =>
              guard(() => {
                // 날을 바꾸면 처음부터 다시 본다 — 그날까지의 출석 · 초안 상태로
                setDemo(v);
                setState({
                  earlybird: seed('earlybird', DEMO_TODAY[v]),
                  weeklyx: seed('weeklyx', DEMO_TODAY[v]),
                  leetcode: seed('leetcode', DEMO_TODAY[v]),
                });
              })
            }
            options={[
              { value: 'before', label: '12/10' },
              { value: 'after', label: '12/16' },
            ]}
          />
        </div>
      </div>

      <div className='mt-5'>
        <Segmented
          value={clubKey}
          onChange={(v) => guard(() => setClubKey(v))}
          options={clubOptions}
        />
      </div>

      <div className='mt-5'>
        <Tabs
          activeKey={tab}
          items={[
            { key: 'cohort', label: '기수' },
            { key: 'book', label: '출석부' },
          ]}
          onChange={(k) => guard(() => setTab(k as TabKey))}
        />
      </div>

      <div className='mt-5' key={`${clubKey}-${demo}`}>
        {tab === 'cohort' && (
          <>
            <ClubCohortPanel
              club={club}
              current={current}
              today={today}
              memberCount={activeCount}
              next={next}
              carryCount={carryCount}
              // 모집을 막 시작한 기수 — 프로토는 신청 3명이 들어온 것으로 본다
              applicants={next === 'recruiting' ? 3 : 0}
              auto={cur.auto}
              onAutoChange={(auto) => patch((s) => ({ ...s, auto }))}
              onCreate={() => patch((s) => ({ ...s, next: 'draft' }))}
              onStartRecruit={() => patch((s) => ({ ...s, next: 'recruiting' }))}
            />
            {next === 'none' ? (
              <div data-anno='carry:4' className='card mt-8 px-6 py-10 text-center'>
                <p className='type-label-lg text-fg'>아직 다음 기수가 없습니다.</p>
                <p className='mt-1.5 type-body-sm text-fg-muted'>
                  다음 기수 초안이 만들어지면 이어서 참여할 사람을 확인할 수 있습니다.
                </p>
              </div>
            ) : (
              <ClubCarryOver
                club={club}
                current={current}
                members={cur.members}
                book={cur.book}
                excluded={cur.excluded}
                onDirtyChange={onCarryDirty}
                onSave={async (excluded) => {
                  await new Promise((r) => setTimeout(r, 300));
                  patch((s) => ({ ...s, excluded }));
                }}
              />
            )}
          </>
        )}
        {tab === 'book' && (
          <ClubAttendanceBoard
            club={club}
            cohortTitle={cohortTitle(club, current)}
            today={today}
            members={cur.members}
            book={cur.book}
            onDirtyChange={onBookDirty}
            onSave={async (book) => {
              // TODO(api): POST /api/admin/studies/{studyId}/attendances — 클럽은 날마다 회차 하나. body: { studyGroupId, updates[] }
              await new Promise((r) => setTimeout(r, 400));
              patch((s) => ({ ...s, book }));
            }}
            onWithdraw={(ids) =>
              // TODO(api): POST /api/admin/studies/{studyId}/attendances 의 withdrawals[] — STUDY_PARTICIPANT.STATUS = WITHDRAWN · LEFT_AT
              patch((s) => ({
                ...s,
                members: s.members.map((m) => (ids.includes(m.id) ? { ...m, leftOn: today } : m)),
                excluded: s.excluded.filter((id) => !ids.includes(id)),
              }))
            }
          />
        )}
      </div>

      <Modal
        open={leave !== null}
        onClose={() => setLeave(null)}
        title='저장하지 않은 변경이 있습니다'
        footer={
          <>
            <Button
              variant='secondary'
              onClick={() => {
                const go = leave;
                setLeave(null);
                setDirty({ carry: false, book: false });
                go?.();
              }}
            >
              저장하지 않고 나가기
            </Button>
            <Button onClick={() => setLeave(null)}>이 화면에 머물기</Button>
          </>
        }
      >
        <p data-anno='clubbook:7' className='type-body-sm text-fg-secondary'>
          저장을 누르지 않으면 고친 내용이 사라집니다. 나가기 전에 저장해 주세요.
        </p>
      </Modal>
    </div>
  );
}
