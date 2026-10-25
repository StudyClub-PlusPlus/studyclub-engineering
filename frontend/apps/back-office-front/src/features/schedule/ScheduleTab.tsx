'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button, toast } from '@studyclub/ui';
import { CalendarPlus } from 'lucide-react';

import {
  MeetingSaveError,
  toMeetings,
  toPeople,
  useAddMeetings,
  useDeleteMeetings,
  useGroupMeetings,
  useSaveRules,
  useSetKickoff,
  useUpdateMeetings,
} from './api';
import { distinctNames, useCrew } from './crew';
import { GroupInfoCard } from './GroupInfoCard';
import { GroupPicker } from './GroupPicker';
import { useScheduleGroups, withServerTz } from './groups';
import { GroupTimeDialog } from './GroupTimeDialog';
import { groupTimeLabel, hasTime } from './meetings';
import { ScheduleTable } from './ScheduleTable';
import { saveGroupTime } from './store';
import { zonedInstant } from './time';
import type { ApiStudyDetail } from '@/features/studies/types';

/**
 * 일정 탭 — 반마다 회차를 만들고 고친다. 명세: playground `console/studies/[id]/spec.ts` 의 `SCHEDULE_SPEC`.
 *
 * 회차는 반(STUDY_GROUP)에 붙는다. 반을 골라 그 반의 회차를 본다 — 스터디 전체 회차를 한 표에 섞지 않는다.
 * 반은 신청자 탭에서 만들고, 그 반이 언제 모이는지(스터디 시간)는 여기서 정한다. 회차는 「회차 추가」로만 만든다.
 * 고른 반은 출석 탭과 같이 쓴다 — 그래서 `groupId` 는 부르는 쪽이 든다.
 *
 * 회차 · 킥오프 · 규칙은 서버가 정본이다 — `api.ts` · `repository.ts` (백오피스 API, 캡틴이면 어느 반이든).
 * 스터디 시간(요일 · 시각)만 브라우저에 남는다 — `store.ts`.
 */
export function ScheduleTab({
  detail,
  groupId,
  onGroup,
  onDirtyChange,
  guard,
  startAdding = false,
  onStartedAdding,
}: {
  detail: ApiStudyDetail;
  /** 고른 반. 비었거나 없는 반이면 첫 반. */
  groupId: string;
  onGroup: (id: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  /** 저장하지 않은 고침이 있으면 먼저 묻고, 나가기로 하면 `go` 를 부른다. */
  guard: (go: () => void) => void;
  /** 출석 탭의 「회차 추가하러 가기」로 왔다 — 회차 추가 창(스터디 시간이 없으면 스터디 시간 창)을 바로 연다. */
  startAdding?: boolean;
  onStartedAdding?: () => void;
}) {
  const studyId = detail.id;
  /** 스터디 시간은 localStorage 라 렌더 트리거가 없다 — 바꿀 때마다 올려 다시 읽는다. */
  const [rev, setRev] = useState(0);

  // 신청자 탭에서 만든 서버 반 — 둘 이상이면 반 칩이 선다
  const { groups, error: groupsError } = useScheduleGroups(studyId, rev);
  const picked = groups.find((g) => g.id === groupId) ?? groups[0];
  const serverGroupId = picked ? Number(picked.id) : undefined;
  const query = useGroupMeetings(studyId, serverGroupId);
  const group = picked && withServerTz(picked, query.data);
  const meetings = useMemo(() => (query.data ? toMeetings(query.data) : []), [query.data]);
  const [timeOpen, setTimeOpen] = useState(false);
  const noTime = group && query.data ? !hasTime(group) && meetings.length === 0 : false;

  // 스터디 시간이 없는 반은 회차 추가 창 대신 스터디 시간 창을 연다 — 시간을 정해야 회차 추가 기본값이 채워진다
  useEffect(() => {
    if (!startAdding || !noTime) return;
    setTimeOpen(true);
    onStartedAdding?.();
  }, [startAdding, noTime, onStartedAdding]);

  const [tableDirty, setTableDirty] = useState(false);
  const [rulesDirty, setRulesDirty] = useState(false);
  useEffect(() => {
    onDirtyChange(tableDirty || rulesDirty);
  }, [tableDirty, rulesDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  // 발표자 칸에 이름을 적는 사람은 모두(중단한 사람 포함), 새로 고를 수 있는 사람은 서버의 발표자 후보(활성 참여자)만.
  // 발표자 드롭다운은 이름만 보인다 — 닉네임이 겹치면 디스코드 닉네임을 붙인다
  const crew = useCrew(studyId, picked?.id);
  const people = useMemo(() => {
    if (!query.data) return [];
    const named = new Map(distinctNames(crew).map((c) => [c.id, c.name]));
    return toPeople(query.data).map((p) => ({ ...p, name: named.get(p.id) ?? p.name }));
  }, [query.data, crew]);
  const pickable = useMemo(() => {
    const active = new Set(query.data?.participants.map((p) => String(p.participantId)));
    return people.filter((p) => active.has(p.id));
  }, [people, query.data]);

  const onTableDirty = useCallback((d: boolean) => setTableDirty(d), []);
  const onRulesDirty = useCallback((d: boolean) => setRulesDirty(d), []);

  const tz = group?.time.tz ?? 'Asia/Seoul';
  const writeGroupId = serverGroupId ?? 0;
  const addMeetings = useAddMeetings(studyId, writeGroupId, tz);
  const updateMeetings = useUpdateMeetings(studyId, writeGroupId, tz);
  const deleteMeetings = useDeleteMeetings(studyId, writeGroupId);
  const saveRules = useSaveRules(studyId, writeGroupId);
  const setKickoff = useSetKickoff(studyId, writeGroupId);
  /** 서버가 막으면(403 · 409 · 400) 그 문구를 그대로 띄운다 — 표는 다시 읽어 서버 값으로 돌아간다. */
  const onError = (fallback: string) => (err: Error) => toast.error(err.message || fallback);

  // 반 목록(참여 명단)을 못 읽으면 빈 화면이 아니라 그 사실을 말한다
  if (!group) {
    return groupsError ? (
      <p role='alert' className='card px-6 py-10 text-center text-sm text-fg-muted'>
        {groupsError.message || '반 목록을 불러오지 못했습니다.'}
      </p>
    ) : null;
  }
  if (!query.data) {
    return (
      <div>
        <GroupPicker groups={groups} groupId={group.id} onPick={(id) => guard(() => onGroup(id))} />
        <p role={query.isError ? 'alert' : 'status'} className='card px-6 py-10 text-center text-sm text-fg-muted'>
          {query.isError ? query.error.message : '회차를 불러오는 중입니다.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <GroupPicker groups={groups} groupId={group.id} onPick={(id) => guard(() => onGroup(id))} />

      {noTime ? (
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
            navigator={query.data.studyGroup.navigatorName ?? '미지정'}
            discordHref={detail.discordChannelUrl ?? undefined}
            driveHref={detail.driveUrl ?? undefined}
            rules={query.data.studyGroup.rules ?? ''}
            onSaveRules={(text) => saveRules.mutate(text, { onError: onError('규칙을 저장하지 못했습니다.') })}
            onDirtyChange={onRulesDirty}
          />
          <ScheduleTable
            group={group}
            meetings={meetings}
            people={people}
            pickable={pickable}
            onDirtyChange={onTableDirty}
            startAdding={startAdding}
            onStartedAdding={onStartedAdding}
            onAdd={(input) => addMeetings.mutate(input, { onError: onError('회차를 추가하지 못했습니다.') })}
            onSetKickoff={(input) =>
              setKickoff.mutate(zonedInstant(input.date, input.time, tz).toISOString(), {
                onError: onError('킥오프를 정하지 못했습니다.'),
              })
            }
            onSave={(patches) =>
              updateMeetings.mutateAsync(patches).then(
                () => [],
                (err: Error) => {
                  onError('회차를 저장하지 못했습니다.')(err);
                  return err instanceof MeetingSaveError ? err.failedIds : Object.keys(patches);
                },
              )
            }
            onDelete={(ids) => deleteMeetings.mutate(ids, { onError: onError('회차를 지우지 못했습니다.') })}
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
            setRev((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
