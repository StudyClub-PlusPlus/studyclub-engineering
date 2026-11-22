'use client';

import { useMemo, useState } from 'react';

import { Badge, Button, Checkbox, IconButton, Select, SelectionCount, TableActionBar, cx } from '@studyclub/ui';
import { availableDaysText } from '@studyclub/utils';
import { useIsMutating } from '@tanstack/react-query';
import { X } from 'lucide-react';

import { TableCard } from '@/components/ui';
import { AvailabilitySection, pickLabel, type AvailabilityPick } from '@/features/participants/AvailabilitySection';
import { DiscardGroupChangesDialog } from '@/features/participants/DiscardGroupChangesDialog';
import { GroupsSection } from '@/features/participants/GroupsSection';
import { OwnerCaptainSection } from '@/features/participants/OwnerCaptainSection';
import { participantKeys, useParticipants } from '@/features/participants/queries';
import type { Participant, ParticipantsResponse } from '@/features/participants/types';
import { useGroupAssignment } from '@/features/participants/use-group-assignment';
import { DISPLAY_ZONES, zoneLabel, zoneTitle } from '@/features/schedule/time';
import { ApiError } from '@/lib/http';
import { useUrlState } from '@/lib/use-url-state';

const FILTER_DEFAULTS = { tz: 'all', group: 'all' };
const FILTER_ALLOWED = { tz: ['all', ...DISPLAY_ZONES.map((z) => z.iana)] };
const ROLE_LABELS = { MEMBER: '크루', LEADER: '네비게이터' };

export function ParticipantsTab({
  studyId,
  onDirtyChange,
}: {
  studyId: number;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const query = useParticipants(studyId);
  if (query.isPending)
    return (
      <p role='status' className='py-10 text-center text-fg-muted'>
        불러오는 중
      </p>
    );
  if (!query.data || (query.error instanceof ApiError && [401, 403].includes(query.error.status)))
    return (
      <div className='py-10 text-center'>
        <p role='alert'>
          {query.data === null
            ? '참여 명단을 볼 권한이 없습니다.'
            : query.error instanceof ApiError
              ? query.error.message
              : '참여 명단을 불러오지 못했습니다.'}
        </p>
        <Button variant='secondary' onClick={() => void query.refetch()}>
          다시 시도
        </Button>
      </div>
    );
  return <ParticipantAssignment key={studyId} studyId={studyId} data={query.data} onDirtyChange={onDirtyChange} />;
}

function ParticipantAssignment({
  studyId,
  data,
  onDirtyChange,
}: {
  studyId: number;
  data: ParticipantsResponse;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [filters, setUrlFilters] = useUrlState(FILTER_DEFAULTS, FILTER_ALLOWED);
  const [timePick, setTimePick] = useState<AvailabilityPick | null>(null);
  // 반 · 시간대 필터를 바꾸면 센 사람이 달라진다 — 고른 시각은 푼다
  const setFilters = (next: Partial<typeof FILTER_DEFAULTS>) => {
    setUrlFilters(next);
    setTimePick(null);
  };
  const tz = filters.tz;
  const group = data.groups.some((g) => String(g.groupId) === filters.group) ? filters.group : 'all';
  const [selected, setSelected] = useState<number[]>([]);
  const {
    drafts,
    dirty,
    saving,
    mutation,
    change,
    discard,
    save,
    navigationPending,
    cancelNavigation,
    confirmNavigation,
  } = useGroupAssignment(studyId, data.participants, onDirtyChange);
  // 반 생성·수정·삭제 중에도 배정은 잠근다(지워지는 반으로 옮기지 않게). 이동 차단은 배정 저장만 본다.
  const groupSaving = useIsMutating({ mutationKey: participantKeys.groups(studyId) }) > 0;
  const busy = saving || groupSaving;
  const filtered = data.participants.filter(
    (p) => (tz === 'all' || p.timeZone === tz) && (group === 'all' || String(p.groupId) === group),
  );
  // 참여 가능 시간은 반 · 시간대 필터로 좁힌 명단 중 지금 참여 중인 사람을 센다
  const people = useMemo(
    () =>
      filtered
        .filter((p) => p.status === 'ACTIVE' || p.status === 'PAUSED')
        .map((p) => ({ id: p.participantId, name: p.nickname, days: p.availableDays, timeZone: p.timeZone })),
    [filtered],
  );
  const rows = timePick ? filtered.filter((p) => timePick.ids.includes(p.participantId)) : filtered;
  const editable = rows.filter((p) => p.status === 'ACTIVE' || p.status === 'PAUSED');
  const picked = editable.filter((p) => selected.includes(p.participantId));
  // 스펙: 배정 실패 응답의 errorMessage 에 걸린 participantId 를 적는다.
  const failedIds = new Set(
    mutation.error instanceof ApiError
      ? [...mutation.error.message.matchAll(/\bparticipantId\s*[:=]?\s*(\d+)\b/g)].map((m) => Number(m[1]))
      : [],
  );
  return (
    <div className='space-y-8'>
      <DiscardGroupChangesDialog
        open={navigationPending}
        busy={saving}
        onClose={cancelNavigation}
        onConfirm={confirmNavigation}
      />
      <OwnerCaptainSection studyId={studyId} owner={data.ownerCaptain} />
      <GroupsSection studyId={studyId} data={data} disabled={busy || dirty} />
      {data.participants.length > 0 && (
        <AvailabilitySection people={people} pick={timePick} onPick={setTimePick} rosterId='crew-roster' />
      )}
      <section id='crew-roster' aria-label='참여 크루' className='scroll-mt-20 space-y-3'>
        <div className='space-y-2'>
          <h2 className='font-semibold'>참여 크루 {data.participantCount}명</h2>
          <div className='flex flex-wrap gap-2'>
            {data.groups.length > 1 && (
              <Select aria-label='반 필터' value={group} onChange={(e) => setFilters({ group: e.target.value })}>
                <option value='all'>전체 반</option>
                {data.groups.map((g) => (
                  <option key={g.groupId} value={g.groupId}>
                    {g.name}
                  </option>
                ))}
              </Select>
            )}
            <Select aria-label='시간대 필터' value={tz} onChange={(e) => setFilters({ tz: e.target.value })}>
              <option value='all'>전체 시간대</option>
              {DISPLAY_ZONES.map((z) => (
                <option key={z.iana} value={z.iana}>
                  {zoneTitle(z.iana)}
                </option>
              ))}
            </Select>
            {timePick && (
              <span className='inline-flex items-center gap-1 rounded-pill border border-brand bg-brand-subtle pl-3 pr-1 type-label-lg text-fg'>
                {pickLabel(timePick)}에 되는 크루 {rows.length}명
                <IconButton
                  size='xs'
                  variant='tertiary'
                  icon={<X />}
                  aria-label='시각 필터 풀기'
                  onClick={() => setTimePick(null)}
                />
              </span>
            )}
          </div>
        </div>
        {mutation.error && (
          <p role='alert' className='type-body-sm text-error-600'>
            {mutation.error instanceof ApiError
              ? mutation.error.message
              : '반 · 역할 변경을 저장하지 못했습니다. 변경 내용을 확인하고 다시 시도해 주세요.'}
          </p>
        )}
        <TableCard
          // 칸이 많아 좁은 화면에서 줄이지 않고 가로로 민다
          tableClassName='min-w-[64rem]'
          top={
            <TableActionBar
              position='top'
              className='rounded-t-card border-b border-border bg-surface-raised px-4'
              selection={
                <>
                  <SelectionCount count={picked.length} unit='명' />
                  {data.groups.length > 1 && (
                    <Select
                      size='sm'
                      aria-label='바꿀 반'
                      value=''
                      disabled={busy || picked.length === 0}
                      onChange={(e) => {
                        if (e.target.value)
                          change(
                            picked.map((p) => p.participantId),
                            { groupId: Number(e.target.value) },
                          );
                      }}
                    >
                      <option value=''>반 변경</option>
                      {data.groups.map((g) => (
                        <option key={g.groupId} value={g.groupId}>
                          {g.name}
                        </option>
                      ))}
                    </Select>
                  )}
                  <Select
                    size='sm'
                    aria-label='바꿀 역할'
                    value=''
                    disabled={busy || picked.length === 0}
                    onChange={(e) => {
                      if (e.target.value)
                        change(
                          picked.map((p) => p.participantId),
                          { participantRole: e.target.value as Participant['participantRole'] },
                        );
                    }}
                  >
                    <option value=''>역할 변경</option>
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  {picked.length > 0 && (
                    <Button
                      variant='tertiary'
                      size='sm'
                      onClick={() =>
                        setSelected((ids) => ids.filter((id) => !editable.some((p) => p.participantId === id)))
                      }
                    >
                      선택 해제
                    </Button>
                  )}
                </>
              }
              save={
                <>
                  {dirty && (
                    <Button variant='tertiary' size='sm' disabled={busy} onClick={discard}>
                      변경 취소
                    </Button>
                  )}
                  <Button size='sm' disabled={busy || !dirty} onClick={save}>
                    {dirty ? `변경 ${Object.keys(drafts).length}명 저장` : '저장'}
                  </Button>
                </>
              }
            />
          }
        >
          <thead>
            <tr>
              <th>
                <Checkbox
                  label=''
                  aria-label='보이는 크루 전체 선택'
                  checked={editable.length > 0 && picked.length === editable.length}
                  indeterminate={picked.length > 0 && picked.length < editable.length}
                  disabled={busy || editable.length === 0}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSelected((ids) =>
                      checked
                        ? [...new Set([...ids, ...editable.map((p) => p.participantId)])]
                        : ids.filter((id) => !editable.some((p) => p.participantId === id)),
                    );
                  }}
                />
              </th>
              <th>닉네임</th>
              <th>디스코드 닉네임</th>
              <th>이메일</th>
              <th>시간대</th>
              <th>참여 가능 요일</th>
              <th>반</th>
              <th>역할</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const active = p.status === 'ACTIVE' || p.status === 'PAUSED';
              const failed = failedIds.has(p.participantId);
              const role = drafts[p.participantId]?.participantRole ?? p.participantRole;
              return (
                <tr
                  key={p.participantId}
                  className={
                    failed ? 'bg-error-50' : drafts[p.participantId] !== undefined ? 'bg-brand-subtle/40' : undefined
                  }
                >
                  <td>
                    <Checkbox
                      label=''
                      aria-label={`${p.nickname} 선택`}
                      disabled={busy || !active}
                      checked={selected.includes(p.participantId)}
                      onChange={(e) =>
                        setSelected((ids) =>
                          e.target.checked ? [...ids, p.participantId] : ids.filter((id) => id !== p.participantId),
                        )
                      }
                    />
                  </td>
                  <td className='font-semibold'>
                    {p.nickname} {failed && <span className='text-error-600'>저장 실패</span>}{' '}
                    {p.captain && <Badge>캡틴</Badge>}
                  </td>
                  <td>{p.discordNickname ?? '-'}</td>
                  <td>{p.email}</td>
                  <td title={p.timeZone ?? undefined}>{p.timeZone ? zoneLabel(p.timeZone) : '-'}</td>
                  {/* 크루가 고른 현지 요일 그대로 — 기준 시간대로 옮기면 하루가 이틀에 걸친다 */}
                  <td className='whitespace-nowrap'>{availableDaysText(p.availableDays) || '-'}</td>
                  <td>
                    {data.groups.length > 1 ? (
                      // 칸 너비가 아니라 글자 너비로 — 화살표가 상자 안에 붙게 감싼다
                      <div className='inline-flex'>
                        <Select
                          size='sm'
                          className='w-auto'
                          aria-label={`${p.nickname} 반`}
                          disabled={busy || !active}
                          value={drafts[p.participantId]?.groupId ?? p.groupId}
                          onChange={(e) => change([p.participantId], { groupId: Number(e.target.value) })}
                        >
                          {data.groups.map((g) => (
                            <option key={g.groupId} value={g.groupId}>
                              {g.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                    ) : (
                      (data.groups.find((g) => g.groupId === p.groupId)?.name ?? '-')
                    )}
                  </td>
                  <td>
                    {/* 칸 너비가 아니라 글자 너비로 — 화살표가 상자 안에 붙게 감싼다 */}
                    <div className='inline-flex'>
                      <Select
                        size='sm'
                        aria-label={`${p.nickname} 역할`}
                        disabled={busy || !active}
                        value={role}
                        onChange={(e) =>
                          change([p.participantId], {
                            participantRole: e.target.value as Participant['participantRole'],
                          })
                        }
                        // 네비게이터는 몇 안 된다. 긴 명단에서 바로 보이게 브랜드 테두리 · 굵은 글씨로 드러낸다 (스터디 목록 필터와 같은 모양)
                        className={cx('w-auto', role === 'LEADER' && 'border-brand font-semibold text-fg')}
                      >
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className='text-center text-fg-muted'>
                  {data.participants.length === 0 ? '아직 크루가 없습니다.' : '조건에 맞는 크루가 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </TableCard>
      </section>
    </div>
  );
}
