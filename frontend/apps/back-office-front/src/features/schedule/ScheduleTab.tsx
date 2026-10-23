'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@studyclub/ui';
import { CalendarPlus } from 'lucide-react';

import { GroupInfoCard } from './GroupInfoCard';
import { GroupTimeDialog } from './GroupTimeDialog';
import { groupTimeLabel, hasTime, type Person } from './meetings';
import { ScheduleTable } from './ScheduleTable';
import {
  addMeetings,
  deleteMeetings,
  getRules,
  listGroups,
  listMeetings,
  patchMeetings,
  saveGroupTime,
  saveRules,
  setKickoff,
} from './store';
import { useParticipants } from '@/features/participants/queries';
import type { ApiStudyDetail } from '@/features/studies/types';

/**
 * 일정 탭 — 반마다 회차를 만들고 고친다. 명세: playground `console/studies/[id]/spec.ts` 의 `SCHEDULE_SPEC`.
 *
 * 회차는 반(STUDY_GROUP)에 붙는다. 반을 골라 그 반의 회차를 본다 — 스터디 전체 회차를 한 표에 섞지 않는다.
 * 반은 신청자 탭에서 만들고, 그 반이 언제 모이는지(스터디 시간)는 여기서 정한다. 회차는 「회차 추가」로만 만든다.
 *
 * 추가 · 수정 · 삭제는 브라우저에만 남는다 — `store.ts` 참고.
 */
export function ScheduleTab({
  detail,
  onDirtyChange,
  guard,
}: {
  detail: ApiStudyDetail;
  onDirtyChange: (dirty: boolean) => void;
  /** 저장하지 않은 고침이 있으면 먼저 묻고, 나가기로 하면 `go` 를 부른다. */
  guard: (go: () => void) => void;
}) {
  const studyId = detail.id;
  /** 저장소가 localStorage 라 렌더 트리거가 없다 — 바꿀 때마다 올려 다시 읽는다. */
  const [rev, setRev] = useState(0);
  const refresh = () => setRev((n) => n + 1);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- rev 가 바뀌면 저장소를 다시 읽는다
  const groups = useMemo(() => listGroups(studyId), [studyId, rev]);
  const [groupId, setGroupId] = useState(() => groups[0]?.id ?? '');
  const group = groups.find((g) => g.id === groupId) ?? groups[0];
  // eslint-disable-next-line react-hooks/exhaustive-deps -- rev 가 바뀌면 저장소를 다시 읽는다
  const meetings = useMemo(() => (group ? listMeetings(studyId, group) : []), [studyId, group, rev]);
  const [timeOpen, setTimeOpen] = useState(false);

  const [tableDirty, setTableDirty] = useState(false);
  const [rulesDirty, setRulesDirty] = useState(false);
  useEffect(() => {
    onDirtyChange(tableDirty || rulesDirty);
  }, [tableDirty, rulesDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  // 발표자로 고를 수 있는 사람 — 참여 명단의 활동 중 · 휴식 중인 사람 (회차 스펙 participants 와 같은 범위).
  // TODO(api): 반 목록이 서버 반 ID 와 이어지면 그 반 사람만. 지금은 반이 「기본반」 하나라 모두 그 반이다. 네비게이터도 거기서 온다.
  const participants = useParticipants(studyId);
  const people = useMemo<Person[]>(() => {
    const active = (participants.data?.participants ?? []).filter(
      (p) => p.status === 'ACTIVE' || p.status === 'PAUSED',
    );
    const count = new Map<string, number>();
    for (const p of active) count.set(p.nickname, (count.get(p.nickname) ?? 0) + 1);
    // 이름이 겹치는 사람은 디스코드 닉네임을 붙여 가른다
    return active.map((p) => ({
      id: `p${p.participantId}`,
      name: (count.get(p.nickname) ?? 0) > 1 && p.discordNickname ? `${p.nickname} (${p.discordNickname})` : p.nickname,
    }));
  }, [participants.data]);

  const onTableDirty = useCallback((d: boolean) => setTableDirty(d), []);
  const onRulesDirty = useCallback((d: boolean) => setRulesDirty(d), []);

  if (!group) return null;

  return (
    <div>
      {groups.length > 1 && (
        <nav aria-label='반' className='mb-4 flex flex-wrap gap-1.5'>
          {groups.map((g) => (
            <button
              key={g.id}
              type='button'
              aria-pressed={g.id === group.id}
              onClick={() => g.id !== group.id && guard(() => setGroupId(g.id))}
              className={`rounded-pill border px-3 py-1.5 text-sm font-semibold transition-colors ${
                g.id === group.id
                  ? 'border-brand bg-brand text-white'
                  : 'border-border-strong bg-bg text-fg-secondary hover:bg-surface-2'
              }`}
            >
              {g.title}
            </button>
          ))}
        </nav>
      )}

      {!hasTime(group) && meetings.length === 0 ? (
        // 막 만든 반 — 언제 모일지 정해야 회차와 출석부가 생긴다
        <div className='card px-6 py-10 text-center'>
          <p className='text-sm font-semibold text-fg'>아직 이 반의 스터디 시간이 없습니다.</p>
          <p className='mt-1.5 text-sm text-fg-muted'>
            요일 · 시각을 정한 뒤 일정 표의 「회차 추가」로 회차를 만듭니다. 그 요일 · 시각이 매주 반복으로 채워집니다.
          </p>
          <Button size='sm' className='mt-4' leadingIcon={<CalendarPlus size={15} />} onClick={() => setTimeOpen(true)}>
            스터디 시간 정하기
          </Button>
        </div>
      ) : (
        // 반을 바꾸면 카드와 표를 함께 새로 연다 — 고치던 규칙·줄은 그 반의 것이다
        <div key={group.id}>
          <GroupInfoCard
            time={groupTimeLabel(group.time)}
            onEditTime={() => setTimeOpen(true)}
            navigator='미지정'
            discordHref={detail.discordChannelUrl ?? undefined}
            driveHref={detail.driveUrl ?? undefined}
            rules={getRules(studyId, group.id)}
            onSaveRules={(text) => {
              saveRules(studyId, group.id, text);
              refresh();
            }}
            onDirtyChange={onRulesDirty}
          />
          <ScheduleTable
            group={group}
            meetings={meetings}
            people={people}
            onDirtyChange={onTableDirty}
            onAdd={(input) => {
              addMeetings(studyId, group, input);
              refresh();
            }}
            onSetKickoff={(input) => {
              setKickoff(studyId, group, input);
              refresh();
            }}
            onSave={(patches) => {
              patchMeetings(studyId, group, patches);
              refresh();
            }}
            onDelete={(ids) => {
              deleteMeetings(studyId, group.id, ids);
              refresh();
            }}
          />
        </div>
      )}

      {timeOpen && (
        <GroupTimeDialog
          group={group}
          onClose={() => setTimeOpen(false)}
          onSave={(time) => {
            saveGroupTime(studyId, group.id, time);
            setTimeOpen(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
