'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { meetingWindow } from '@core/lib/attendance';
import { dateWithDow, type ProtoMeeting, type ScheduleRole } from '@core/lib/meetings';
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
  shortDateTime,
  toggleLike,
  validateRetro,
  type Retro,
  type RetroAnswers,
  type RetroErrors,
  type RetroMeetingStatus,
  type RetroSection,
} from '@core/lib/retros';
import type { Study } from '@studyclub/types';
import { Badge, Button, ButtonLink, FilterChip, Segmented, Textarea, cx, toast } from '@studyclub/ui';
import { ThumbsUp } from 'lucide-react';

/* ── 스터디 일정의 회고 칸 ─────────────────────────────────────────────── */

/**
 * 일정 표 한 줄의 회고 칸. 미팅이 끝나기 전에는 「-」.
 * 크루·네비게이터: 아직 안 썼고 기한 안이면 「회고 작성」, 아니면 「회고 보기」.
 * 네비게이터·캡틴: 반의 작성 현황(쓴 사람/쓸 사람)을 함께 본다. 캡틴은 미팅 참여자가 아니라 쓰지 않는다.
 */
export function RetroCell({
  study,
  meeting,
  role,
  locale,
}: {
  study: Study;
  meeting: ProtoMeeting;
  role: ScheduleRole;
  locale: string;
}) {
  const [status, setStatus] = useState<RetroMeetingStatus | undefined>();
  useEffect(() => setStatus(retroStatusOf(study, meeting.id)), [study, meeting.id]);
  if (!status?.ended) return <span className='inline-block py-1.5 text-fg-muted'>-</span>;

  const canWrite = role !== 'captain' && status.open && !status.mine;
  return (
    <span className='inline-flex flex-col items-center gap-1 py-0.5'>
      {canWrite ? (
        <ButtonLink
          data-anno='retro:1-1'
          size='sm'
          linkAs={Link}
          href={retroHref(locale, study.study_id, meeting.id, true)}
        >
          회고 작성
        </ButtonLink>
      ) : (
        <ButtonLink
          data-anno='retro:1-2'
          size='sm'
          variant='secondary'
          linkAs={Link}
          href={retroHref(locale, study.study_id, meeting.id)}
        >
          회고 보기
        </ButtonLink>
      )}
    </span>
  );
}

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

type View = 'author' | 'question';
const VIEW_KEY = 'sc_retro_view';

function readView(role: ScheduleRole): View {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'author' || v === 'question') return v;
  } catch {
    // 못 읽으면 역할 기본값
  }
  return role === 'crew' ? 'author' : 'question';
}

export function RetroBoard({
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
  const [statuses, setStatuses] = useState<RetroMeetingStatus[] | null>(null);
  const [view, setView] = useState<View>('author');
  const [rev, setRev] = useState(0);
  useEffect(() => {
    setStatuses(retroStatuses(study));
    setView(readView(role));
  }, [study, role, rev]);

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
  const retros = retrosOf(study, current.meeting.id);
  const missing = missingOf(study, current.meeting.id);
  const lead = role !== 'crew';
  const canWrite = role !== 'captain' && current.open;
  const like = (r: Retro, s: RetroSection) => {
    toggleLike(study, current.meeting.id, r.authorId, s);
    setRev((n) => n + 1);
  };
  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // 다음에 열 때 기본값으로 열린다
    }
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
              onClick={() => router.replace(retroHref(locale, study.study_id, s.meeting.id))}
            >
              {s.label}
            </FilterChip>
          ))}
        </div>
        <div data-anno='retro:2-2'>
          <Segmented<View>
            size='sm'
            shape='pill'
            value={view}
            onChange={changeView}
            options={[
              { value: 'author', label: '작성자별' },
              { value: 'question', label: '문항별' },
            ]}
          />
        </div>
      </div>

      <div className='flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface-raised px-5 py-4'>
        <div data-anno='retro:2-3' className='min-w-0'>
          <p className='type-label-lg text-fg'>
            {current.label} · {dateWithDow(current.meeting.date)}
            {current.meeting.title ? ` · ${current.meeting.title}` : ''}
          </p>
          <p className='mt-0.5 type-body-sm text-fg-muted'>
            {current.open
              ? `${shortDateTime(current.deadline.toISOString())}까지 쓰고 고칠 수 있어요`
              : '작성 기한이 지났어요'}
          </p>
        </div>
        <div className='flex items-center gap-3'>
          <span data-anno='retro:2-4' className='tnum type-body-sm text-fg-secondary'>
            {current.targets}명 중 <b className='text-fg'>{current.written}명</b> 작성
          </span>
          {canWrite && !current.mine && (
            <ButtonLink
              data-anno='retro:2-5'
              size='sm'
              linkAs={Link}
              href={retroHref(locale, study.study_id, current.meeting.id, true)}
            >
              내 회고 작성
            </ButtonLink>
          )}
        </div>
      </div>

      <div className={cx(lead && 'grid gap-4 lg:grid-cols-[13rem_1fr]')}>
        {lead && <WritingStatus retros={retros} missing={missing} />}
        <div className='flex min-w-0 flex-col gap-4'>
          {retros.length === 0 ? (
            <p className='rounded-card border border-dashed border-border py-12 text-center type-body-sm text-fg-muted'>
              아직 이 회차에 남긴 회고가 없어요.
            </p>
          ) : view === 'author' ? (
            <div className='grid gap-4 md:grid-cols-2'>
              {retros.map((r) => (
                <AuthorCard
                  key={r.authorId}
                  retro={r}
                  canEdit={r.me && current.open}
                  editHref={retroHref(locale, study.study_id, current.meeting.id, true)}
                  onLike={(s) => like(r, s)}
                />
              ))}
            </div>
          ) : (
            RETRO_SECTIONS.map((s, i) => (
              <QuestionCard key={s.key} index={i + 1} section={s.key} retros={retros} lead={lead} onLike={like} />
            ))
          )}
          {!lead && missing.length > 0 && (
            <p data-anno='retro:4' className='type-body-sm text-fg-muted'>
              아직 쓰지 않은 참여자 {missing.length}명 · {missing.map((m) => m.name).join(', ')}
            </p>
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

function AuthorCard({
  retro,
  canEdit,
  editHref,
  onLike,
}: {
  retro: Retro;
  canEdit: boolean;
  editHref: string;
  onLike: (s: RetroSection) => void;
}) {
  return (
    <article
      data-anno={retro.me ? 'retro:3 retro:3-1' : 'retro:3'}
      className={cx(
        'rounded-card border bg-surface-raised p-5 shadow-sm',
        retro.me ? 'border-border-strong' : 'border-border',
      )}
    >
      <header className='flex items-center gap-2'>
        <b className='type-label-lg text-fg'>{retro.authorName}</b>
        {retro.me && <Badge tone='member'>내 회고</Badge>}
        {retro.navigator && <Badge tone='navigator'>네비게이터</Badge>}
        {canEdit && (
          <span className='ml-auto'>
            <ButtonLink data-anno='retro:3-2' size='sm' variant='tertiary' linkAs={Link} href={editHref}>
              수정
            </ButtonLink>
          </span>
        )}
      </header>
      {/* 넓은 화면은 「문항 · 글 · 👍」 한 줄(문항 칸 폭 고정 — 글 시작이 세로로 맞는다), 좁은 화면은 문항 아래에 「글 · 👍」.
          제목 · 👍 는 글 첫 줄 높이에 두고 긴 글만 아래로 꺾인다. 문항별 보기의 「이름 · 글 · 👍」 줄과 같은 틀.
          비운 문항(소감)은 백오피스 표처럼 제목과 「-」만 — 👍 할 답이 없다. */}
      {RETRO_SECTIONS.map((s, i) => (
        <section
          key={s.key}
          className='mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1.5 border-t border-dashed border-border pt-3 md:grid-cols-[5.75rem_minmax(0,1fr)_auto]'
        >
          <span className='col-span-2 md:col-span-1 md:pt-1'>
            <SectionTag index={i + 1} section={s.key} />
          </span>
          {retro[s.key] ? (
            <>
              <p className='whitespace-pre-wrap break-words pt-1.5 type-body-sm text-fg'>{retro[s.key]}</p>
              <LikeChip retro={retro} section={s.key} onToggle={() => onLike(s.key)} />
            </>
          ) : (
            <p className='pt-1.5 type-body-sm text-fg-muted'>
              <span aria-hidden>-</span>
              <span className='sr-only'>{s.label}을 남기지 않았어요</span>
            </p>
          )}
        </section>
      ))}
    </article>
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
  // 네비게이터·캡틴은 👍 많은 순 — 공감이 많은 개선점부터 다음 미팅에 반영한다. 크루는 내 답이 맨 앞, 나머지는 쓴 순서.
  const list = lead ? [...answered].sort((a, b) => b.likes[section] - a.likes[section]) : answered;
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
  if (status === undefined) return null;

  const blocked =
    role === 'captain'
      ? '캡틴은 미팅 참여자가 아니라 회고를 쓰지 않아요.'
      : !status
        ? '이 회차를 찾을 수 없어요.'
        : !status.ended
          ? '미팅이 끝나면 회고를 쓸 수 있어요.'
          : !status.open
            ? '작성 기한이 지나 회고를 쓰거나 고칠 수 없어요.'
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
    <div className='mx-auto max-w-3xl'>
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
            {status.label} · {dateWithDow(status.meeting.date)}
            {status.meeting.title ? ` · ${status.meeting.title}` : ''}
          </p>
          <p className='mt-0.5 type-body-sm text-fg-muted'>
            {shortDateTime(status.deadline.toISOString())}까지 쓰고 고칠 수 있어요
          </p>
        </div>
        <Badge tone='ended'>미팅 종료 {shortDateTime(end.toISOString())}</Badge>
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
