'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { createPortal } from 'react-dom';

import { ApplyCompleteDialog } from '@/components/ApplyCompleteDialog';
import { ApplyDialog } from '@/components/ApplyDialog';
import { ApplyDiscordGate } from '@/components/ApplyDiscordGate';
import { useMyApplication } from '@/features/applications/queries';
import { getUser } from '@/lib/auth';
import type { Locale, Study } from '@/lib/content';
import { t } from '@/lib/i18n';
import { addApplication, getApplication, getDiscord } from '@/lib/me';
import { recruitLabel, recruitState } from '@/lib/recruit';

export function ApplyButton({ study, locale }: { study: Study; locale: Locale }) {
  const router = useRouter();
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

  const isUser = Boolean(getUser());
  const { data: myApp } = useMyApplication(study.study_id, isUser);

  useEffect(() => {
    setReady(true);
    const local = Boolean(getApplication(study.id));
    if (local || myApp?.applied) {
      setAlreadyApplied(true);
      if (myApp?.applied && !local) {
        addApplication({
          studyId: study.id,
          appliedAt: myApp.submittedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
          status: 'pending',
          region: 'KR',
        });
      }
    }
  }, [study.id, myApp, completeOpen]);

  const isClosed = state === 'closed' || Boolean(deadlineLabel);

  const card = 'inline-flex items-center rounded-pill px-8 py-3 text-sm font-bold';
  const live = 'bg-brand text-on-brand shadow-sm transition-[background-color,transform] hover:bg-brand-hover hover:scale-[1.02] focus-visible:outline-none focus-visible:shadow-(--ring)';
  const idle = 'bg-surface-2 text-fg-placeholder';

  function requestApply() {
    if (alreadyApplied) return;
    if (!getUser()) {
      router.push(`/${locale}/login?next=${encodeURIComponent(pathname)}`);
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

  // 외부 신청 폼(구글 폼 등)이 있으면 그쪽으로 보낸다.
  if (study.recruit_url && !isClosed) {
    return (
      <a
        href={study.recruit_url}
        target='_blank'
        rel='noopener noreferrer'
        className={`${card} ${live}`}
      >
        {applyLabel}
      </a>
    );
  }

  const trigger =
    isClosed ? (
      <span className={`${card} ${idle}`}>{applyLabel}</span>
    ) : ready && alreadyApplied ? (
      <button type='button' disabled className={`${card} ${idle}`}>
        {doneLabel}
      </button>
    ) : (
      <button type='button' onClick={requestApply} className={`${card} ${live}`}>
        {applyLabel}
      </button>
    );

  if (isClosed) return trigger;

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
        onRequireDiscord={() => {
          setFormOpen(false);
          setDiscordOpen(true);
        }}
      />
      <ApplyCompleteDialog
        studyId={study.id}
        locale={locale}
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
      />
    </>
  );

  return (
    <>
      {trigger}
      {ready ? createPortal(dialogs, document.body) : null}
    </>
  );
}
