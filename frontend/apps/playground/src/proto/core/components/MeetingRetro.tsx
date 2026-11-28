'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { meetingWindow } from '@core/lib/attendance';
import { type ScheduleRole } from '@core/lib/meetings';
import {
  RETRO_MAX,
  RETRO_SECTIONS,
  missingOf,
  myRetro,
  retroHref,
  retroStatusOf,
  retroStatuses,
  retrosOf,
  saveMyRetro,
  captainOnRoster,
  retroMeetingDate,
  shortDateTime,
  toggleLike,
  validateRetro,
  type Retro,
  type RetroAnswers,
  type RetroErrors,
  type RetroMeetingStatus,
  type RetroSection,
} from '@core/lib/retros';
import { useDisplayTimeZone } from '@core/lib/use-display-timezone';
import type { Study } from '@studyclub/types';
import { Badge, Button, ButtonLink, FilterChip, Textarea, cx, toast } from '@studyclub/ui';
import { ThumbsUp } from 'lucide-react';

/* ── 👍 ───────────────────────────────────────────────────────────────── */

function LikeChip({ retro, section, onToggle }: { retro: Retro; section: RetroSection; onToggle: () => void }) {
  const count = retro.likes[section];
  const label = RETRO_SECTIONS.find((s) => s.key === section)!.label;
  if (retro.me) {
    // 내 답에는 누르지 못한다 — 받은 수만 본다.
    return (
      <span
        data-anno='retro:3-3'
        className='tnum inline-flex h-8 items-center gap-1.5 rounded-pill bg-surface-2 px-3 type-label-lg text-fg-secondary'
        aria-label={`${label}에 받은 공감 ${count}개`}
      >
        <ThumbsUp size={14} aria-hidden /> {count}
      </span>
    );
  }
  return (
    <FilterChip
      data-anno='retro:3-3'
      selected={retro.liked[section]}
      onClick={onToggle}
      aria-label={`${retro.authorName}의 ${label}에 공감 ${count}개${retro.liked[section] ? ' · 공감 취소' : ''}`}
      className='tnum'
    >
      <ThumbsUp size={14} aria-hidden /> {count}
    </FilterChip>
  );
}

/* ── 회고 탭 ───────────────────────────────────────────────────────────── */

export function RetroBoard({
  study,
  role,
  locale,
  meetingId,
  onMeetingChange,
  members,
  readOnly = false,
}: {
  study: Study;
  role: ScheduleRole;
  locale: string;
  meetingId?: string;
  /** 열람 전용 — 백오피스 회고 탭. 작성 버튼 · 「나」 표시가 없다 */
  readOnly?: boolean;
  /** 회차를 고를 때 — 없으면 사용자 사이트 주소(…/retro?meeting=)를 바꾼다. 백오피스 회고 탭은 탭 안 상태로 바꾼다 */
  onMeetingChange?: (meetingId: string) => void;
  /** 이 사람들만 쓸 사람으로 본다 — 백오피스 회고 탭에서 고른 반의 크루. 없으면 스터디 전체(사용자 사이트는 서버가 내 반만 준다) */
  members?: readonly string[];
}) {
  const router = useRouter();
  const zone = useDisplayTimeZone();
  const [statuses, setStatuses] = useState<RetroMeetingStatus[] | null>(null);
  const [rev, setRev] = useState(0);
  useEffect(() => setStatuses(retroStatuses(study, undefined, members)), [study, members, rev]);

  if (!statuses) return null;
  const ended = statuses.filter((s) => s.ended);
  if (ended.length === 0) {
    return (
      <p data-anno='retro:5' className='py-16 text-center type-body-sm text-fg-muted'>
        아직 끝난 미팅이 없어요. 미팅이 끝나면 여기서 회고를 남기고 볼 수 있어요.
      </p>
    );
  }
  const current = ended.find((s) => s.meeting.id === meetingId) ?? ended[ended.length - 1];
  // 백오피스 회고 탭은 열람 전용이다 — 「나」로 표시할 답이 없다. 프로토 로그인 회원이 그 반 참여자로도 잡혀 있어 걸러 준다
  const retros = retrosOf(study, current.meeting.id, undefined, members).map((r) =>
    readOnly && r.me ? { ...r, me: false } : r,
  );
  const missing = missingOf(study, current.meeting.id, undefined, members);
  const lead = role !== 'crew';
  // 쓸 사람 = 그날 반 명부에 있던 사람. 캡틴도 명부에 있으면 쓴다 — 명부에 없는 캡틴은 쓰지 않는다
  const writer = !readOnly && current.iWrite;
  const canWrite = writer && current.open;
  const deadline = shortDateTime(current.deadline.toISOString(), zone, true);
  const like = (r: Retro, s: RetroSection) => {
    toggleLike(study, current.meeting.id, r.authorId, s);
    setRev((n) => n + 1);
  };

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div data-anno='retro:2-1' role='radiogroup' aria-label='회차' className='flex flex-wrap gap-1.5'>
          {ended.map((s) => (
            <FilterChip
              key={s.meeting.id}
              role='radio'
              selectMode='single'
              selected={s.meeting.id === current.meeting.id}
              onClick={() =>
                onMeetingChange
                  ? onMeetingChange(s.meeting.id)
                  : router.replace(retroHref(locale, study.study_id, s.meeting.id))
              }
            >
              {s.label}
            </FilterChip>
          ))}
        </div>
        <div data-anno='retro:2-3' className='flex flex-wrap items-center gap-3'>
          {/* 쓴 사람 수는 네비게이터 · 캡틴만 — 크루에게는 남이 썼는지 보이지 않는다 */}
          {lead && (
            <span data-anno='retro:2-4' className='tnum type-body-sm text-fg-secondary'>
              {current.targets}명 중 <b className='text-fg'>{current.written}명</b> 작성
            </span>
          )}
          <span className='tnum type-body-sm text-fg-muted'>
            {current.open ? `${deadline}까지` : `${deadline} 마감`}
          </span>
          {writer &&
            (!current.open ? (
              <Button data-anno='retro:2-5' size='sm' disabled>
                회고 마감
              </Button>
            ) : (
              <ButtonLink
                data-anno='retro:2-5'
                size='sm'
                variant={current.mine ? 'secondary' : 'primary'}
                linkAs={Link}
                href={retroHref(locale, study.study_id, current.meeting.id, true)}
              >
                {current.mine ? '내 회고 수정' : '회고 작성'}
              </ButtonLink>
            ))}
        </div>
      </div>

      <div className={cx(lead && 'grid gap-4 lg:grid-cols-[13rem_1fr]')}>
        {lead && <WritingStatus retros={retros} missing={missing} />}
        <div className='flex min-w-0 flex-col gap-4'>
          {/* 크루에게는 누가 안 썼는지(이름)를 보이지 않는다 — 내가 안 썼을 때만 쓰자고 권한다. 이름 목록은 네비게이터 · 캡틴의 작성 현황에만. */}
          {canWrite && !current.mine && (
            <p data-anno='retro:4' className='rounded-card bg-info-bg px-5 py-3 type-body-sm text-info-fg'>
              아직 회고를 작성하지 않았어요! 회고를 작성해 생각을 나누어 보아요.
            </p>
          )}
          {retros.length === 0 ? (
            <p className='rounded-card border border-dashed border-border py-12 text-center type-body-sm text-fg-muted'>
              아직 이 회차에 남긴 회고가 없어요.
            </p>
          ) : (
            RETRO_SECTIONS.map((s, i) => (
              <QuestionCard key={s.key} index={i + 1} section={s.key} retros={retros} lead={lead} onLike={like} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SectionTag({ index, section }: { index: number; section: RetroSection }) {
  const label = RETRO_SECTIONS[index - 1]!.label;
  const tone = section === 'good' ? 'present' : section === 'improve' ? 'late' : 'leave';
  return (
    <Badge tone={tone}>
      {index}. {label}
    </Badge>
  );
}

function QuestionCard({
  index,
  section,
  retros,
  lead,
  onLike,
}: {
  index: number;
  section: RetroSection;
  retros: Retro[];
  lead: boolean;
  onLike: (r: Retro, s: RetroSection) => void;
}) {
  const answered = retros.filter((r) => r[section]);
  // 누구나 👍 많은 순 — 공감이 많은 의견부터 읽는다. 같으면 쓴 순서. 내 답은 「나」 표시로 찾는다
  const list = [...answered].sort((a, b) => b.likes[section] - a.likes[section]);
  return (
    <section
      data-anno={index === 1 ? 'retro:3' : undefined}
      className='rounded-card border border-border bg-surface-raised p-5 shadow-sm'
    >
      <header className='flex flex-wrap items-center gap-2'>
        <SectionTag index={index} section={section} />
        <span className='type-label-sm text-fg-muted'>{answered.length}개</span>
      </header>
      <ul data-anno={lead ? 'retro-lead:2' : undefined} className='mt-2'>
        {list.map((r) => (
          <li
            key={r.authorId}
            className={cx(
              'grid grid-cols-[7rem_1fr_auto] items-center gap-3 border-t border-border py-2.5 first:border-t-0',
              r.me && '-mx-3 rounded-control bg-brand-subtle/40 px-3',
            )}
          >
            <span className='flex min-w-0 items-center gap-1.5 type-label-sm text-fg-secondary'>
              <span className='truncate'>{r.authorName}</span>
              {r.me && <Badge tone='member'>나</Badge>}
            </span>
            <span className='whitespace-pre-wrap break-words type-body-sm text-fg'>{r[section]}</span>
            <LikeChip retro={r} section={section} onToggle={() => onLike(r, section)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function WritingStatus({ retros, missing }: { retros: Retro[]; missing: { id: string; name: string }[] }) {
  return (
    <aside
      data-anno='retro-lead:1'
      className='h-fit rounded-card border border-border bg-surface-raised p-4 shadow-sm'
      aria-label='작성 현황'
    >
      <p className='type-label-lg text-fg'>작성 현황</p>
      <ul className='mt-2'>
        {retros.map((r) => (
          <li key={r.authorId} className='flex items-center justify-between border-t border-border py-2 type-body-sm'>
            <span>
              {r.authorName}
              {r.me ? ' (나)' : ''}
            </span>
            <Badge tone='present'>작성</Badge>
          </li>
        ))}
        {missing.map((m) => (
          <li key={m.id} className='flex items-center justify-between border-t border-border py-2 type-body-sm'>
            <span>{m.name}</span>
            <Badge tone='neutral'>미작성</Badge>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/* ── 작성 페이지 ───────────────────────────────────────────────────────── */

export function RetroWriteForm({
  study,
  role,
  locale,
  meetingId,
}: {
  study: Study;
  role: ScheduleRole;
  locale: string;
  meetingId?: string;
}) {
  const router = useRouter();
  const zone = useDisplayTimeZone();
  const [status, setStatus] = useState<RetroMeetingStatus | null | undefined>();
  const [answers, setAnswers] = useState<RetroAnswers>({ good: '', improve: '', feeling: '' });
  const [errors, setErrors] = useState<RetroErrors>({});
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const s = meetingId ? retroStatusOf(study, meetingId) : undefined;
    setStatus(s ?? null);
    const mine = meetingId ? myRetro(study, meetingId) : undefined;
    if (mine) {
      setAnswers({ good: mine.good, improve: mine.improve, feeling: mine.feeling });
      setEditing(true);
    }
  }, [study, meetingId]);

  const listHref = retroHref(locale, study.study_id, meetingId);
  // 명부에 없는 캡틴은 작성 버튼이 없다. 공유된 작성 주소로 들어오면 안내 화면 없이 그 회차의 회고 탭으로 돌려보낸다
  const [offRoster, setOffRoster] = useState(false);
  useEffect(() => {
    const off = role === 'captain' && !captainOnRoster(study.id);
    setOffRoster(off);
    if (off) router.replace(listHref);
  }, [role, study.id, router, listHref]);

  if (status === undefined || offRoster) return null;

  const blocked = !status
    ? '이 회차를 찾을 수 없어요.'
    : !status.ended
      ? '미팅이 끝나면 회고를 쓸 수 있어요.'
      : !status.open
        ? '작성 기한이 지나 회고를 쓰거나 고칠 수 없어요.'
        : !status.iWrite
          ? '이 회차의 회고를 작성할 수 없어요.'
          : null;
  if (blocked || !status) {
    return (
      <div data-anno='retro:6' className='py-16 text-center'>
        <p className='font-semibold text-fg'>{blocked}</p>
        <ButtonLink className='mt-4' variant='secondary' linkAs={Link} href={listHref}>
          회고 목록으로
        </ButtonLink>
      </div>
    );
  }

  const end = meetingWindow(study, status.meeting).end;
  const submit = () => {
    const errs = validateRetro(answers);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const res = saveMyRetro(study, status.meeting.id, answers);
    if (!res.ok) {
      toast.error(res.reason === 'CLOSED' ? '작성 기한이 지나 저장하지 못했어요.' : '저장하지 못했어요.');
      return;
    }
    toast.success(editing ? '회고를 고쳤어요.' : '회고를 남겼어요.');
    router.push(listHref);
  };

  return (
    <div>
      <h2 className='type-headline-md'>
        {status.label} 회고 {editing ? '수정' : '작성'}
      </h2>
      <p className='mt-1 type-body-sm text-fg-secondary'>오늘 미팅에서 좋았던 점, 개선할 점, 소감을 남겨 주세요.</p>

      <div
        data-anno='retro:7'
        className='mt-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface-raised px-5 py-4'
      >
        <div>
          <p className='type-label-lg text-fg'>
            {status.label} · {retroMeetingDate(study, status.meeting, zone)}
            {status.meeting.title ? ` · ${status.meeting.title}` : ''}
          </p>
          <p className='mt-0.5 type-body-sm text-fg-muted'>
            {shortDateTime(status.deadline.toISOString(), zone, true)}까지 쓰고 고칠 수 있어요
          </p>
        </div>
        <Badge tone='ended'>미팅 종료 {shortDateTime(end.toISOString(), zone, true)}</Badge>
      </div>

      <form
        data-anno='retro:8'
        noValidate
        className='mt-6 flex flex-col gap-6'
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {RETRO_SECTIONS.map((s, i) => (
          <Textarea
            key={s.key}
            label={`${i + 1}. ${s.label}`}
            required={s.required}
            labelHint={s.required ? undefined : '선택'}
            helper={errors[s.key] ? undefined : s.hint}
            error={errors[s.key]}
            placeholder={s.placeholder}
            rows={5}
            maxLength={RETRO_MAX}
            showCount
            value={answers[s.key]}
            onChange={(e) => {
              const v = e.target.value;
              setAnswers((a) => ({ ...a, [s.key]: v }));
              if (errors[s.key]) setErrors((er) => ({ ...er, [s.key]: undefined }));
            }}
          />
        ))}
        <div data-anno='retro:8-1' className='flex items-center justify-end gap-2 border-t border-border pt-5'>
          <ButtonLink variant='secondary' linkAs={Link} href={listHref}>
            취소
          </ButtonLink>
          <Button type='submit'>{editing ? '수정 저장' : '회고 제출'}</Button>
        </div>
      </form>
    </div>
  );
}
