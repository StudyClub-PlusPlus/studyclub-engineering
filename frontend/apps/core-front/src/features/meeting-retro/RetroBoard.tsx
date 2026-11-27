'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';

import { Badge, Button, ButtonLink, FilterChip, cx, toast } from '@studyclub/ui';
import { ThumbsUp } from 'lucide-react';

import {
  RETRO_SECTIONS,
  deadlineText,
  endedRetroMeetings,
  retroHref,
  sectionEntries,
  writingStatus,
  type RetroEntry,
  type WritingStatus,
} from '@/features/meeting-retro/model';
import { useMeetingRetros, useRetroStatus, useRetroViewer, useToggleRetroLike } from '@/features/meeting-retro/queries';
import type { ApiRetroList, ApiRetroViewer } from '@/features/meeting-retro/types';
import { useDisplayTimeZone } from '@/features/profile/use-display-timezone';
import { useStudyMeetings } from '@/features/schedule/queries';
import { useManage } from '@/features/schedule/StudyManageShell';
import { track } from '@/lib/analytics';

export function RetroBoard({ meetingId }: { meetingId?: number }) {
  const { study, groupId, locale, role } = useManage();
  const router = useRouter();
  const zone = useDisplayTimeZone();
  const studyId = Number(study.id);
  const statusQuery = useRetroStatus(studyId, groupId);
  const meetingsQuery = useStudyMeetings(studyId, groupId);
  const ended = endedRetroMeetings(statusQuery.data, meetingsQuery.data?.meetings);
  const current = ended.find((m) => m.meetingId === meetingId) ?? ended.at(-1);
  const listQuery = useMeetingRetros(studyId, current?.meetingId);
  const viewerQuery = useRetroViewer(studyId, current?.meetingId);
  const myParticipantId = meetingsQuery.data?.me.participantId ?? null;

  if (statusQuery.isPending || meetingsQuery.isPending) {
    return <p className='py-16 text-center type-body-sm text-fg-muted'>불러오는 중…</p>;
  }
  if (statusQuery.isError || meetingsQuery.isError) {
    return <p className='py-16 text-center type-body-sm text-fg-muted'>회고를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>;
  }
  if (!current) {
    return (
      <p className='py-16 text-center type-body-sm text-fg-muted'>
        아직 끝난 미팅이 없어요. 미팅이 끝나면 여기서 회고를 남기고 볼 수 있어요.
      </p>
    );
  }

  const canWrite = role !== 'captain' && current.open;
  const progress = listQuery.data ? writingStatus(listQuery.data, myParticipantId) : null;

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
              onClick={() => router.replace(retroHref(locale, study.id, m.meetingId))}
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
          {role !== 'captain' &&
            (!current.open ? (
              <Button size='sm' disabled>
                회고 마감
              </Button>
            ) : (
              <ButtonLink
                size='sm'
                variant={current.mine ? 'secondary' : 'primary'}
                linkAs={Link}
                href={retroHref(locale, study.id, current.meetingId, true)}
              >
                {current.mine ? '내 회고 수정' : '회고 작성'}
              </ButtonLink>
            ))}
        </div>
      </div>

      <div className={cx(progress && 'grid gap-4 lg:grid-cols-[13rem_1fr]')}>
        {progress && <WritingStatusPanel status={progress} />}
        <div className='flex min-w-0 flex-col gap-4'>
          {/* 크루에게는 누가 안 썼는지(이름)를 보이지 않는다. 내가 안 썼을 때만 쓰자고 권한다 */}
          {canWrite && current.mine === false && (
            <p className='rounded-card bg-info-bg px-5 py-3 type-body-sm text-info-fg'>
              아직 회고를 작성하지 않았어요! 회고를 작성해 생각을 나누어 보아요.
            </p>
          )}

          {listQuery.isPending ? (
            <p className='py-12 text-center type-body-sm text-fg-muted'>불러오는 중…</p>
          ) : listQuery.isError || !listQuery.data ? (
            <p className='py-12 text-center type-body-sm text-fg-muted'>회고를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</p>
          ) : listQuery.data.retros.length === 0 ? (
            <p className='rounded-card border border-dashed border-border py-12 text-center type-body-sm text-fg-muted'>
              아직 이 회차에 남긴 회고가 없어요.
            </p>
          ) : (
            <RetroSections
              studyId={studyId}
              meetingId={current.meetingId}
              list={listQuery.data}
              viewer={viewerQuery.data}
              myParticipantId={myParticipantId}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function RetroSections({
  studyId,
  meetingId,
  list,
  viewer,
  myParticipantId,
}: {
  studyId: number;
  meetingId: number;
  list: ApiRetroList;
  viewer: ApiRetroViewer | undefined;
  myParticipantId: number | null;
}) {
  const like = useToggleRetroLike(studyId, meetingId);
  // 같은 칸을 빠르게 두 번 누르면 PUT · DELETE 가 엇갈려 도착할 수 있다 — 응답 전에는 그 칸만 막는다
  const pending = useRef(new Set<string>());

  function toggle(entry: RetroEntry, section: (typeof RETRO_SECTIONS)[number]) {
    const key = `${entry.retroId}:${section.api}`;
    if (pending.current.has(key)) return;
    pending.current.add(key);
    const next = !entry.liked;
    // mutate 의 콜백은 마지막 호출에만 불린다 — 칸마다 정리하려면 호출마다의 약속을 쓴다
    like
      .mutateAsync({ retroId: entry.retroId, section: section.api, liked: next })
      .then(() => {
        if (next) {
          track({
            name: 'Meeting Retro Liked',
            props: { study_id: String(studyId), meeting_id: String(meetingId), section: section.key },
          });
        }
      })
      .catch(() => toast.error('공감을 반영하지 못했어요. 다시 시도해 주세요.'))
      .finally(() => pending.current.delete(key));
  }

  return (
    <>
      {RETRO_SECTIONS.map((section, i) => (
        <QuestionCard
          key={section.key}
          index={i + 1}
          section={section}
          entries={sectionEntries(list, viewer, section, myParticipantId)}
          onLike={(e) => toggle(e, section)}
        />
      ))}
    </>
  );
}

function QuestionCard({
  index,
  section,
  entries,
  onLike,
}: {
  index: number;
  section: (typeof RETRO_SECTIONS)[number];
  entries: RetroEntry[];
  onLike: (entry: RetroEntry) => void;
}) {
  const tone = section.key === 'good' ? 'present' : section.key === 'improve' ? 'late' : 'leave';
  return (
    <section className='rounded-card border border-border bg-surface-raised p-5 shadow-sm'>
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
            className={cx(
              'grid grid-cols-[7rem_1fr_auto] items-center gap-3 border-t border-border py-2.5 first:border-t-0',
              e.me && '-mx-3 rounded-control bg-brand-subtle/40 px-3',
            )}
          >
            <span className='flex min-w-0 items-center gap-1.5 type-label-sm text-fg-secondary'>
              <span className='truncate'>{e.authorName}</span>
              {e.me && <Badge tone='member'>나</Badge>}
            </span>
            <span className='whitespace-pre-wrap break-words type-body-sm text-fg'>{e.answer}</span>
            <LikeChip entry={e} label={section.label} onToggle={() => onLike(e)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LikeChip({ entry, label, onToggle }: { entry: RetroEntry; label: string; onToggle: () => void }) {
  if (entry.me) {
    return (
      <span
        className='tnum inline-flex h-8 items-center gap-1.5 rounded-pill bg-surface-2 px-3 type-label-lg text-fg-secondary'
        aria-label={`${label}에 받은 공감 ${entry.likes}개`}
      >
        <ThumbsUp size={14} aria-hidden /> {entry.likes}
      </span>
    );
  }
  return (
    <FilterChip
      selected={entry.liked}
      onClick={onToggle}
      aria-label={`${entry.authorName}의 ${label}에 공감 ${entry.likes}개${entry.liked ? ' · 공감 취소' : ''}`}
      className='tnum'
    >
      <ThumbsUp size={14} aria-hidden /> {entry.likes}
    </FilterChip>
  );
}

function WritingStatusPanel({ status }: { status: WritingStatus }) {
  return (
    <aside className='h-fit rounded-card border border-border bg-surface-raised p-4 shadow-sm' aria-label='작성 현황'>
      <p className='type-label-lg text-fg'>작성 현황</p>
      <ul className='mt-2'>
        {status.rows.map((r) => (
          <li
            key={r.participantId}
            className='flex items-center justify-between gap-2 border-t border-border py-2 type-body-sm'
          >
            <span className='min-w-0 truncate'>
              {r.name}
              {r.me ? ' (나)' : ''}
            </span>
            <Badge tone={r.wrote ? 'present' : 'neutral'}>{r.wrote ? '작성' : '미작성'}</Badge>
          </li>
        ))}
      </ul>
    </aside>
  );
}
