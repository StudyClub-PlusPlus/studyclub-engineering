'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { ClubBookSection, pastMonthsOf, usePastBooks } from '@console/components/ClubBookSection';
import { ClubCarryOver } from '@console/components/ClubCarryOver';
import { ClubCohortPanel, type AutoDraft, type NextState } from '@console/components/ClubCohortPanel';
import { ClubPastCohorts } from '@console/components/ClubPastCohorts';
import { DEMO_TODAY, pastCohorts, seedMembers, type DemoDay } from '@console/lib/club-seed';
import {
  clubOf,
  clubStudyId,
  CLUBS,
  DEFAULT_DRAFT_DAY,
  DEFAULT_PUBLISH_DAY,
  isoDay,
  monthOf,
  type ClubKey,
  type ClubMember,
  type Month,
} from '@console/lib/clubs';
import { Button, Modal, Segmented, Tabs } from '@studyclub/ui';

import { useAnnotate } from '@/proto/annotate';
import { bookFromRoom, useClubRoom } from '@/proto/club/room';

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
  excluded: string[];
  /** 캡틴이 직접 바꾼 다음 기수 상태. 없으면 자동 초안 · 자동 공개 규칙으로 정한다 */
  next?: NextState;
  /** 캡틴이 「모집 시작」을 먼저 누른 날 */
  recruitFrom?: string;
  auto: AutoDraft;
};

function seed(key: ClubKey): ClubState {
  const club = clubOf(key);
  const members = seedMembers(club);
  return {
    members,
    excluded: key === 'earlybird' ? [`${key}-5`] : [],
    auto: { on: true, day: DEFAULT_DRAFT_DAY, publishDay: DEFAULT_PUBLISH_DAY },
  };
}

export function ClubConsole() {
  const [demo, setDemo] = useState<DemoDay>('after');
  const today = DEMO_TODAY[demo];
  const [clubKey, setClubKey] = useState<ClubKey>('earlybird');
  const [tab, setTab] = useState<TabKey>('cohort');
  const [state, setState] = useState<Record<ClubKey, ClubState>>(() => ({
    earlybird: seed('earlybird'),
    weeklyx: seed('weeklyx'),
    leetcode: seed('leetcode'),
  }));
  const [dirty, setDirty] = useState<Dirty>({ carry: false, book: false });
  const [leave, setLeave] = useState<(() => void) | null>(null);
  // 출석부에서 보고 있는 기수(월). 없으면 이번 기수
  const [bookMonth, setBookMonth] = useState<Month | undefined>();

  // 스토리 칩을 고르면 그 Story 의 요소가 보이는 탭으로 옮긴다
  const { spec, on } = useAnnotate();
  const wanted: TabKey | undefined =
    spec?.scope === 'clubbook' ? 'book' : spec?.scope === 'cohort' || spec?.scope === 'carry' ? 'cohort' : undefined;
  useEffect(() => {
    if (on && wanted) setTab(wanted);
  }, [on, wanted]);

  const club = clubOf(clubKey);
  const { loadPast, savePast } = usePastBooks(club);
  const cur = state[clubKey];
  // 기록은 사용자 사이트(크루의 오늘 · 출석 탭)와 같은 것을 본다
  const [room, setRoom] = useClubRoom(club, today);
  const current = monthOf(today);
  // 다음 기수 — 자동이 켜져 있으면 초안 날에 초안, 공개 날에 모집중. 캡틴이 먼저 만들거나 먼저 열 수 있다
  const dayNow = Number(today.slice(8, 10));
  const auto: NextState = !cur.auto.on
    ? 'none'
    : dayNow >= cur.auto.publishDay
      ? 'recruiting'
      : dayNow >= cur.auto.day
        ? 'draft'
        : 'none';
  const next: NextState = cur.next === 'recruiting' || auto === 'recruiting' ? 'recruiting' : (cur.next ?? auto);
  const recruitFrom = cur.recruitFrom ?? isoDay(current, cur.auto.publishDay);
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
          <span className='type-label-sm text-fg-muted'>검토용 · 오늘 날짜 바꿔 보기</span>
          <Segmented
            size='sm'
            value={demo}
            onChange={(v) =>
              guard(() => {
                // 날을 바꾸면 처음부터 다시 본다 — 그날까지의 출석 · 초안 상태로
                setDemo(v);
                setState({
                  earlybird: seed('earlybird'),
                  weeklyx: seed('weeklyx'),
                  leetcode: seed('leetcode'),
                });
              })
            }
            options={[
              { value: 'before', label: '12/10' },
              { value: 'after', label: '12/16' },
              { value: 'published', label: '12/21' },
            ]}
          />
        </div>
      </div>

      <div className='mt-5'>
        <Segmented
          value={clubKey}
          onChange={(v) =>
            guard(() => {
              setClubKey(v);
              setBookMonth(undefined);
            })
          }
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
              recruitFrom={recruitFrom}
              carryCount={carryCount}
              // 모집을 막 시작한 기수 — 프로토는 신청 3명이 들어온 것으로 본다
              applicants={next === 'recruiting' ? 3 : 0}
              auto={cur.auto}
              onAutoChange={(auto) => patch((s) => ({ ...s, auto }))}
              onCreate={() => patch((s) => ({ ...s, next: 'draft' }))}
              onStartRecruit={() => patch((s) => ({ ...s, next: 'recruiting', recruitFrom: today }))}
              studyId={clubStudyId(club)}
            />
            <ClubCarryOver
              club={club}
              current={current}
              members={cur.members}
              book={bookFromRoom(room)}
              excluded={cur.excluded}
              onDirtyChange={onCarryDirty}
              onSave={async (excluded) => {
                await new Promise((r) => setTimeout(r, 300));
                patch((s) => ({ ...s, excluded }));
              }}
            />
            <ClubPastCohorts
              club={club}
              cohorts={pastCohorts(club, current)}
              onOpenBook={(m) =>
                guard(() => {
                  setBookMonth(m);
                  setTab('book');
                })
              }
            />
          </>
        )}
        {tab === 'book' && (
          <ClubBookSection
            club={club}
            month={bookMonth}
            onMonth={(m) => guard(() => setBookMonth(m))}
            today={today}
            current={{ members: cur.members, room }}
            pastMonths={pastMonthsOf(club, today)}
            loadPast={loadPast}
            savePast={savePast}
            onDirtyChange={onBookDirty}
            onSave={async (next) => {
              // TODO(api): PUT /api/admin/clubs/{programId}/checkins — body: { month, updates[] (멤버 · 날짜 · 값) , weeks[] (멤버 · 주 · 목표) }
              await new Promise((r) => setTimeout(r, 400));
              setRoom(() => next);
            }}
            onWithdraw={(ids) =>
              // TODO(api): POST /api/admin/studies/{studyId}/attendances 의 withdrawals[] — STUDY_PARTICIPANT.STATUS = WITHDRAWN · LEFT_AT
              patch((s) => ({
                ...s,
                members: s.members.map((m) => (ids.includes(m.id) ? { ...m, leftOn: today } : m)),
                excluded: s.excluded.filter((id) => !ids.includes(id)),
              }))
            }
            onReinstate={(id) =>
              // TODO(api): POST /api/admin/studies/{studyId}/attendances 의 reinstatements[] — WITHDRAWN → ACTIVE · LEFT_AT 비움
              patch((s) => ({ ...s, members: s.members.map((m) => (m.id === id ? { ...m, leftOn: undefined } : m)) }))
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
