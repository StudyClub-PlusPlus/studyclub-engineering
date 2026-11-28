'use client';

import { useState } from 'react';

import { Badge, FilterChip, cx } from '@studyclub/ui';
import { ThumbsUp } from 'lucide-react';

import {
  RETRO_SECTIONS,
  deadlineText,
  endedRetroMeetings,
  sectionEntries,
  writingStatus,
  type RetroEntry,
  type WritingStatus,
} from '@/features/meeting-retro/model';
import { useMeetingRetros, useRetroStatus } from '@/features/meeting-retro/queries';
import type { ApiRetroList } from '@/features/meeting-retro/types';
import { useGroupMeetings } from '@/features/schedule/api';
import { GroupPicker } from '@/features/schedule/GroupPicker';
import { useScheduleGroups } from '@/features/schedule/groups';
import type { ApiStudyDetail } from '@/features/studies/types';
import { useDisplayTimeZone } from '@/lib/use-display-timezone';

/**
 * 회고 탭 — 사용자 사이트 스터디 일정의 회고 탭을 캡틴으로 본다. 명세: playground `console/studies/[id]/spec.ts` 탭 줄.
 *
 * 작성 버튼이 없고 👍 는 수만 보인다 — 백오피스 회고 탭은 열람 전용이다. 명부에 있는 캡틴도 회고는 사용자 사이트에서 쓴다.
 * 반 칩은 일정 · 출석 탭과 같은 값이고, 고른 반의 크루만 쓸 사람으로 센다(서버가 반 회차의 명부로 센다).
 */
export function RetroTab({
  detail,
  groupId,
  onGroup,
}: {
  detail: ApiStudyDetail;
  /** 고른 반. 비었거나 없는 반이면 첫 반. */
  groupId: string;
  onGroup: (id: string) => void;
}) {
  const studyId = detail.id;
  const { groups, loading, error: groupsError } = useScheduleGroups(studyId);
  const group = groups.find((g) => g.id === groupId) ?? groups[0];

  if (loading) return null;
  if (!group) {
    return (
      <p role={groupsError ? 'alert' : undefined} className='card px-6 py-10 text-center type-body-sm text-fg-muted'>
        {groupsError ? groupsError.message || '반 목록을 불러오지 못했습니다.' : '아직 반이 없습니다.'}
      </p>
    );
  }

  return (
    <div>
      <GroupPicker groups={groups} groupId={group.id} onPick={onGroup} />
      {/* 반을 바꾸면 고른 회차를 버린다 — 회차는 반마다 다르다 */}
      <GroupRetros key={group.id} studyId={studyId} groupId={Number(group.id)} />
    </div>
  );
}

function GroupRetros({ studyId, groupId }: { studyId: number; groupId: number }) {
  const zone = useDisplayTimeZone();
  const [meetingId, setMeetingId] = useState<number | undefined>();
  const statusQuery = useRetroStatus(studyId, groupId);
  const meetingsQuery = useGroupMeetings(studyId, groupId);
  const ended = endedRetroMeetings(statusQuery.data, meetingsQuery.data?.meetings);
  // 처음엔 가장 최근에 끝난 회차
  const current = ended.find((m) => m.meetingId === meetingId) ?? ended.at(-1);
  const listQuery = useMeetingRetros(studyId, current?.meetingId);

  if (statusQuery.isPending || meetingsQuery.isPending) {
    return (
      <p role='status' className='card px-6 py-10 text-center type-body-sm text-fg-muted'>
        회고를 불러오는 중입니다.
      </p>
    );
  }
  if (statusQuery.isError || meetingsQuery.isError) {
    return (
      <p role='alert' className='card px-6 py-10 text-center type-body-sm text-fg-muted'>
        {(statusQuery.error ?? meetingsQuery.error)?.message || '회고를 불러오지 못했습니다.'}
      </p>
    );
  }
  if (!current) {
    return (
      <p className='card px-6 py-10 text-center type-body-sm text-fg-muted'>
        이 반은 아직 끝난 미팅이 없습니다. 미팅이 끝나면 크루가 남긴 회고가 여기에 모입니다.
      </p>
    );
  }

  const progress = listQuery.data ? writingStatus(listQuery.data) : null;

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div role='radiogroup' aria-label='회차' className='flex flex-wrap gap-1.5'>
          {ended.map((m) => (
            <FilterChip
              key={m.meetingId}
              role='radio'
              selectMode='single'
              selected={m.meetingId === current.meetingId}
              onClick={() => setMeetingId(m.meetingId)}
            >
              {m.label}
            </FilterChip>
          ))}
        </div>
        <div className='flex flex-wrap items-center gap-3'>
          {progress && (
            <span className='tnum type-body-sm text-fg-secondary'>
              {progress.targets}명 중 <b className='text-fg'>{progress.written}명</b> 작성
            </span>
          )}
          <span className='tnum type-body-sm text-fg-muted'>{deadlineText(current, zone)}</span>
        </div>
      </div>

      {listQuery.isPending ? (
        <p role='status' className='py-12 text-center type-body-sm text-fg-muted'>
          회고를 불러오는 중입니다.
        </p>
      ) : listQuery.isError || !listQuery.data ? (
        <p role='alert' className='py-12 text-center type-body-sm text-fg-muted'>
          {listQuery.error?.message || '회고를 불러오지 못했습니다.'}
        </p>
      ) : (
        <div className={cx(progress && 'grid gap-4 lg:grid-cols-[13rem_1fr]')}>
          {progress && <WritingStatusPanel status={progress} />}
          <div className='flex min-w-0 flex-col gap-4'>
            {listQuery.data.retros.length === 0 ? (
              <p className='rounded-card border border-dashed border-border py-12 text-center type-body-sm text-fg-muted'>
                아직 이 회차에 남긴 회고가 없습니다.
              </p>
            ) : (
              <RetroSections list={listQuery.data} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RetroSections({ list }: { list: ApiRetroList }) {
  return (
    <>
      {RETRO_SECTIONS.map((section, i) => (
        <QuestionCard key={section.key} index={i + 1} section={section} entries={sectionEntries(list, section)} />
      ))}
    </>
  );
}

function QuestionCard({
  index,
  section,
  entries,
}: {
  index: number;
  section: (typeof RETRO_SECTIONS)[number];
  entries: RetroEntry[];
}) {
  const tone = section.key === 'good' ? 'present' : section.key === 'improve' ? 'late' : 'leave';
  return (
    <section aria-label={section.label} className='rounded-card border border-border bg-surface-raised p-5 shadow-sm'>
      <header className='flex flex-wrap items-center gap-2'>
        <Badge tone={tone}>
          {index}. {section.label}
        </Badge>
        <span className='type-label-sm text-fg-muted'>{entries.length}개</span>
      </header>
      <ul className='mt-2'>
        {entries.map((e) => (
          <li
            key={e.retroId}
            className='grid grid-cols-[7rem_1fr_auto] items-center gap-3 border-t border-border py-2.5 first:border-t-0'
          >
            <span className='truncate type-label-sm text-fg-secondary'>{e.authorName}</span>
            <span className='whitespace-pre-wrap break-words type-body-sm text-fg'>{e.answer}</span>
            <span
              className='tnum inline-flex h-8 items-center gap-1.5 rounded-pill bg-surface-2 px-3 type-label-lg text-fg-secondary'
              aria-label={`${e.authorName}의 ${section.label}에 받은 공감 ${e.likes}개`}
            >
              <ThumbsUp size={14} aria-hidden /> {e.likes}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WritingStatusPanel({ status }: { status: WritingStatus }) {
  return (
    <aside className='h-fit rounded-card border border-border bg-surface-raised p-4 shadow-sm' aria-label='작성 현황'>
      <p className='type-label-lg text-fg'>작성 현황</p>
      <ul className='mt-2'>
        {status.rows.map((r) => (
          <li key={r.participantId} className='flex items-center justify-between gap-2 border-t border-border py-2 type-body-sm'>
            <span className='min-w-0 truncate'>{r.name}</span>
            <Badge tone={r.wrote ? 'present' : 'neutral'}>{r.wrote ? '작성' : '미작성'}</Badge>
          </li>
        ))}
      </ul>
    </aside>
  );
}
