'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type MouseEvent } from 'react';

import { getUser } from '@core/lib/auth';
import type { Locale, Study } from '@core/lib/content';
import { t } from '@core/lib/i18n';
import { getApplication, getDiscord } from '@core/lib/me';
import { recruitLabel, recruitState } from '@core/lib/recruit';
import { createPortal } from 'react-dom';

import { ApplyCompleteDialog } from './ApplyCompleteDialog';
import { ApplyDialog } from './ApplyDialog';
import { ApplyDiscordGate } from './ApplyDiscordGate';

/**
 * 신청 버튼 + 로그인 확인 + 디스코드 연동 확인 + 폼 + 완료 팝업.
 *
 * 서버 컴포넌트인 상세 페이지에서 이 조각만 클라이언트로 분리한다.
 */
export function ApplyButton({ study, locale }: { study: Study; locale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const [formOpen, setFormOpen] = useState(false);
  const [discordOpen, setDiscordOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [ready, setReady] = useState(false);

  const state = recruitState(study);
  const applyLabel = recruitLabel(state, locale);
  const doneLabel = t({ ko: '신청 완료', en: 'Applied' }, locale);

  useEffect(() => {
    setAlreadyApplied(Boolean(getApplication(study.id)));
    setReady(true);
  }, [study.id, completeOpen]);

  const card = 'inline-flex items-center rounded-pill px-8 py-3 text-sm font-bold';
  const live =
    'bg-brand text-on-brand shadow-sm transition-[background-color,transform] hover:bg-brand-hover hover:scale-[1.02] focus-visible:outline-none focus-visible:shadow-(--ring)';
  const idle = 'bg-surface-2 text-fg-placeholder';

  function requestApply(ev: MouseEvent<HTMLButtonElement>) {
    ev.preventDefault();
    ev.stopPropagation();
    if (alreadyApplied) return;
    if (!getUser()) {
      router.push(`/proto/core/${locale}/login?next=${encodeURIComponent(pathname)}`);
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

  const trigger =
    state === 'closed' ? (
      <span data-anno='view:9' className={`${card} ${idle}`}>
        {applyLabel}
      </span>
    ) : ready && alreadyApplied ? (
      <span data-anno='view:9' className={`${card} ${idle}`}>
        {doneLabel}
      </span>
    ) : (
      <button type='button' data-anno='view:9' onClick={requestApply} className={`${card} ${live}`}>
        {applyLabel}
      </button>
    );

  if (state === 'closed') return trigger;

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
