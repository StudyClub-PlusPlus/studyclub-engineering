'use client';

import { useState } from 'react';

import { Badge, Button, Checkbox, Select, SelectionCount, TableActionBar } from '@studyclub/ui';
import { useIsMutating } from '@tanstack/react-query';


import { DiscardGroupChangesDialog } from './DiscardGroupChangesDialog';
import { GroupsSection } from './GroupsSection';
import { participantKeys, useParticipants } from './queries';
import type { ParticipantsResponse } from './types';
import { useGroupAssignment } from './use-group-assignment';
import { TableCard } from '@/components/ui';
import { ApiError } from '@/lib/http';
import { useUrlState } from '@/lib/use-url-state';

const FILTER_DEFAULTS = { region: 'all', group: 'all' };
const FILTER_ALLOWED = { region: ['all', 'KR', 'NA', 'ETC'] };
const REGION_LABELS = { KR: '한국', NA: '북미', ETC: '기타' };

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
  const [filters, setFilters] = useUrlState(FILTER_DEFAULTS, FILTER_ALLOWED);
  const region = filters.region;
  const group = data.groups.some((g) => String(g.groupId) === filters.group) ? filters.group : 'all';
  const [selected, setSelected] = useState<number[]>([]);
  const {
    drafts,
    dirty,
    saving,
    notice,
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
  const rows = data.participants.filter(
    (p) => (region === 'all' || p.regionGroup === region) && (group === 'all' || String(p.groupId) === group),
  );
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
      <GroupsSection studyId={studyId} data={data} disabled={busy || dirty} />
      <section aria-label='참여 크루' className='space-y-3'>
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
            <Select aria-label='지역 필터' value={region} onChange={(e) => setFilters({ region: e.target.value })}>
              <option value='all'>전체 지역</option>
              {Object.entries(REGION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {mutation.error && (
          <p role='alert' className='type-body-sm text-error-600'>
            {mutation.error instanceof ApiError
              ? mutation.error.message
              : '반 변경을 저장하지 못했습니다. 변경 내용을 확인하고 다시 시도해 주세요.'}
          </p>
        )}
        <TableCard
          top={
            <TableActionBar
              position='top'
              className='rounded-t-card border-b border-border bg-surface-raised px-4'
              selection={
                <>
                  <SelectionCount count={picked.length} unit='명' />
                  {data.groups.length > 1 && (
                    <Select
                      aria-label='바꿀 반'
                      value=''
                      disabled={busy || picked.length === 0}
                      onChange={(e) => {
                        if (e.target.value)
                          change(
                            picked.map((p) => p.participantId),
                            Number(e.target.value),
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
                  <span role='status' className='type-body-sm text-fg-muted'>
                    {notice}
                  </span>
                  {dirty && (
                    <Button variant='tertiary' size='sm' disabled={busy} onClick={discard}>
                      변경 취소
                    </Button>
                  )}
                  <Button size='sm' disabled={busy || !dirty} onClick={save}>
                    저장
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
              <th>지역</th>
              <th>반</th>
              <th>역할</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const active = p.status === 'ACTIVE' || p.status === 'PAUSED';
              const failed = failedIds.has(p.participantId);
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
                  <td>{p.regionGroup ? REGION_LABELS[p.regionGroup] : '-'}</td>
                  <td>
                    {data.groups.length > 1 ? (
                      <Select
                        aria-label={`${p.nickname} 반`}
                        disabled={busy || !active}
                        value={drafts[p.participantId] ?? p.groupId}
                        onChange={(e) => change([p.participantId], Number(e.target.value))}
                      >
                        {data.groups.map((g) => (
                          <option key={g.groupId} value={g.groupId}>
                            {g.name}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      (data.groups.find((g) => g.groupId === p.groupId)?.name ?? '-')
                    )}
                  </td>
                  <td>{p.participantRole === 'LEADER' ? '네비게이터' : '크루'}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className='text-center text-fg-muted'>
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
