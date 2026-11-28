'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Badge, Button, ButtonLink, Textarea, toast } from '@studyclub/ui';

import {
  RETRO_MAX,
  RETRO_SECTIONS,
  deadlineText,
  endedRetroMeetings,
  meetingDate,
  myAnswers,
  retroErrorCode,
  retroHref,
  saveFailureMessage,
  shortDateTime,
  trimAnswers,
  validateRetro,
  type RetroErrors,
  type RetroMeeting,
} from '@/features/meeting-retro/model';
import { useMeetingRetros, useRetroStatus, useSaveMyRetro } from '@/features/meeting-retro/queries';
import type { RetroAnswers } from '@/features/meeting-retro/types';
import { useDisplayTimeZone } from '@/features/profile/use-display-timezone';
import { useStudyMeetings } from '@/features/schedule/queries';
import { useManage } from '@/features/schedule/StudyManageShell';
import { track } from '@/lib/analytics';

const EMPTY: RetroAnswers = { good: '', improve: '', feeling: '' };

export function RetroWriteForm({ meetingId }: { meetingId?: number }) {
  const { study, groupId, locale } = useManage();
  const router = useRouter();
  const zone = useDisplayTimeZone();
  const studyId = Number(study.id);
  const statusQuery = useRetroStatus(studyId, groupId);
  const meetingsQuery = useStudyMeetings(studyId, groupId);
  const ended = endedRetroMeetings(statusQuery.data, meetingsQuery.data?.meetings);
  const current = ended.find((m) => m.meetingId === meetingId);
  // 쓸 사람 = 반 명부에 있는 사람. 캡틴도 명부에 있으면 쓴다 (명부에 없는 캡틴은 participantId 가 null)
  const writer = (meetingsQuery.data?.me.participantId ?? null) !== null;
  const fetchMine = writer && current?.mine === true;
  const listQuery = useMeetingRetros(studyId, fetchMine ? current.meetingId : undefined);
  const listHref = retroHref(locale, study.id, meetingId);
  const initial = fetchMine ? myAnswers(listQuery.data, meetingsQuery.data?.me.participantId ?? null) : null;
  // 명부에 없는 캡틴은 작성 버튼이 없다. 공유된 작성 주소로 들어오면 안내 화면 없이 그 회차의 회고 탭으로 돌려보낸다
  const offRoster = meetingsQuery.isSuccess && !writer;

  useEffect(() => {
    if (offRoster) router.replace(listHref);
  }, [offRoster, router, listHref]);

  if (offRoster) return null;
  if (statusQuery.isPending || meetingsQuery.isPending || (fetchMine && listQuery.isPending)) {
    return <p className='py-16 text-center type-body-sm text-fg-muted'>불러오는 중…</p>;
  }

  const blocked =
    statusQuery.isError || meetingsQuery.isError
      ? '회고를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.'
      : !current
        ? statusQuery.data?.meetings.some((s) => s.meetingId === meetingId && s.retroDeadline !== null)
          ? '미팅이 끝나면 회고를 쓸 수 있어요.'
          : '이 회차를 찾을 수 없어요.'
        : !current.open
          ? '작성 기한이 지나 회고를 쓰거나 고칠 수 없어요.'
          : // 쓴 회고를 못 읽었는데 빈 폼을 열면, 제출할 때 쓴 내용을 덮어쓴다
            fetchMine && !initial
            ? '내 회고를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.'
            : null;

  if (blocked || !current) {
    return (
      <div className='py-16 text-center'>
        <p className='font-semibold text-fg'>{blocked}</p>
        <ButtonLink className='mt-4' variant='secondary' linkAs={Link} href={listHref}>
          회고 목록으로
        </ButtonLink>
      </div>
    );
  }

  return (
    <RetroForm
      key={current.meetingId}
      studyId={studyId}
      meeting={current}
      initial={initial}
      listHref={listHref}
      zone={zone}
    />
  );
}

function RetroForm({
  studyId,
  meeting,
  initial,
  listHref,
  zone,
}: {
  studyId: number;
  meeting: RetroMeeting;
  initial: RetroAnswers | null;
  listHref: string;
  zone: string;
}) {
  const router = useRouter();
  const { setDirty } = useManage();
  const editing = initial !== null;
  const [answers, setAnswers] = useState<RetroAnswers>(initial ?? EMPTY);
  const [errors, setErrors] = useState<RetroErrors>({});
  const save = useSaveMyRetro(studyId, meeting.meetingId);

  useEffect(() => () => setDirty(false), [setDirty]);

  function submit() {
    const errs = validateRetro(answers);
    setErrors(errs);
    if (Object.keys(errs).length > 0 || save.isPending) return;
    const body = trimAnswers(answers);
    // 저장 뒤 상태를 다시 받는 동안 이 폼이 잠깐 내려갈 수 있다. mutate 의 콜백은 그때 불리지 않아 약속으로 받는다
    save
      .mutateAsync(body)
      .then(() => {
        track({
          name: 'Meeting Retro Submitted',
          props: {
            study_id: String(studyId),
            meeting_id: String(meeting.meetingId),
            is_edit: editing,
            has_feeling: body.feeling !== '',
          },
        });
        setDirty(false);
        toast.success(editing ? '회고를 고쳤어요.' : '회고를 남겼어요.');
        router.push(listHref);
      })
      .catch((error: unknown) => {
        toast.error(saveFailureMessage(error));
        if (retroErrorCode(error) === 'VALIDATION') setErrors(validateRetro(answers));
      });
  }

  return (
    <div>
      <h2 className='type-headline-md'>
        {meeting.label} 회고 {editing ? '수정' : '작성'}
      </h2>
      <p className='mt-1 type-body-sm text-fg-secondary'>오늘 미팅에서 좋았던 점, 개선할 점, 소감을 남겨 주세요.</p>

      <div className='mt-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface-raised px-5 py-4'>
        <div>
          <p className='type-label-lg text-fg'>
            {meeting.label} · {meetingDate(meeting.scheduledAt, zone)}
            {meeting.title ? ` · ${meeting.title}` : ''}
          </p>
          <p className='mt-0.5 type-body-sm text-fg-muted'>{deadlineText(meeting, zone)} 쓰고 고칠 수 있어요</p>
        </div>
        {meeting.meetingEndAt && <Badge tone='ended'>미팅 종료 {shortDateTime(meeting.meetingEndAt, zone)}</Badge>}
      </div>

      <form
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
              setDirty(true);
              if (errors[s.key]) setErrors((er) => ({ ...er, [s.key]: undefined }));
            }}
          />
        ))}
        <div className='flex items-center justify-end gap-2 border-t border-border pt-5'>
          <ButtonLink variant='secondary' linkAs={Link} href={listHref}>
            취소
          </ButtonLink>
          <Button type='submit' loading={save.isPending}>
            {editing ? '수정 저장' : '회고 제출'}
          </Button>
        </div>
      </form>
    </div>
  );
}
