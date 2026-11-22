'use client';

import { useRecruitmentClock } from '@/proto/lib/use-recruitment-clock';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type MouseEvent } from 'react';

import { getUser } from '@core/lib/auth';
import type { Locale, Study } from '@core/lib/content';
import { withoutApplyIntent } from '@core/lib/discord-preview';
import { t } from '@core/lib/i18n';
import { getApplication, getDiscord } from '@core/lib/me';
import { recruitLabel, recruitState } from '@core/lib/recruit';
import { Button } from '@studyclub/ui';
import { createPortal } from 'react-dom';

import { ApplyCompleteDialog } from './ApplyCompleteDialog';
import { ApplyDialog } from './ApplyDialog';
import { ApplyDiscordGate } from './ApplyDiscordGate';

/**
 * 신청 버튼 + 로그인 확인 + 디스코드 연동 확인 + 폼 + 완료 팝업.
 *
 * 서버 컴포넌트인 상세 페이지에서 이 조각만 클라이언트로 분리한다.
 * 상세에서만 연다 — 목록 카드는 둘러보기 전용이라 신청하기를 두지 않는다.
 */
export function ApplyButton({ study, locale }: { study: Study; locale: Locale }) {
  const router = useRouter();
  useRecruitmentClock([study]);
  const pathname = usePathname();
  const [formOpen, setFormOpen] = useState(false);
  const [discordOpen, setDiscordOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [deadlineLabel, setDeadlineLabel] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const state = recruitState(study);
  const applyLabel = deadlineLabel ?? recruitLabel(state, locale);
  const doneLabel = t({ ko: '신청 완료', en: 'Applied' }, locale);

  useEffect(() => {
    setAlreadyApplied(Boolean(getApplication(study.id)));
    setReady(true);
  }, [study.id, completeOpen]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('apply') !== '1') return;
    const user = getUser();
    if (!user || user.onboardingCompletedAt === null) return;
    router.replace(withoutApplyIntent(`${url.pathname}${url.search}${url.hash}`), { scroll: false });
    if (state === 'closed' || getApplication(study.id)) return;
    if (getDiscord()) setFormOpen(true);
    else setDiscordOpen(true);
  }, [pathname, router, state, study.id]);


  function requestApply(ev: MouseEvent<HTMLButtonElement>) {
    ev.preventDefault();
    ev.stopPropagation();
    if (alreadyApplied) return;
    const user = getUser();
    const next = `${pathname}?apply=1`;
    if (!user || user.onboardingCompletedAt === null) {
      const entry = user ? 'onboarding' : 'login';
      router.push(`/proto/core/${locale}/${entry}?next=${encodeURIComponent(next)}`);
      return;
    }
    if (!getDiscord()) {
      setDiscordOpen(true);
      return;
    }
    setFormOpen(true);
  }

  function handleLinked() {
    setDiscordOpen(false);
    setFormOpen(true);
  }

  function handleSubmitted() {
    setFormOpen(false);
    setAlreadyApplied(true);
    setCompleteOpen(true);
  }

  const isClosed = state === 'closed' || Boolean(deadlineLabel);

  // 스터디 상세의 신청 버튼만 예외로 알약 모양 · 카드 너비 100% 를 쓴다 — 마감 · 신청 완료 · 신청하기가 같은 자리 같은 크기로 바뀐다
  const trigger =
    isClosed ? (
      <Button type='button' size='lg' className='w-full rounded-pill' data-anno='view:1' disabled>
        {applyLabel}
      </Button>
    ) : ready && alreadyApplied ? (
      <Button type='button' size='lg' className='w-full rounded-pill' data-anno='view:2' disabled>
        {doneLabel}
      </Button>
    ) : (
      <Button type='button' size='lg' className='w-full rounded-pill' data-anno='view:2' onClick={requestApply}>
        {applyLabel}
      </Button>
    );

  if (isClosed) return trigger;

  // 카드는 overflow-hidden + hover transform 이라, 그 안에 두면 fixed 모달이
  // 카드 안에 그려졌다가 팝업으로 튀며 깜빡인다. body 로 빼서 바로 연다.
  const dialogs = (
    <>
      <ApplyDiscordGate
        locale={locale}
        open={discordOpen}
        onClose={() => setDiscordOpen(false)}
        onLinked={handleLinked}
      />
      <ApplyDialog
        study={study}
        locale={locale}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmitted={handleSubmitted}
        onDeadline={(label) => setDeadlineLabel(label)}
      />
      <ApplyCompleteDialog locale={locale} open={completeOpen} onClose={() => setCompleteOpen(false)} />
    </>
  );

  return (
    <>
      {trigger}
      {ready ? createPortal(dialogs, document.body) : null}
    </>
  );
}
