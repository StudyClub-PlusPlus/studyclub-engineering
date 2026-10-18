'use client';

import { useEffect, useRef, useState } from 'react';

import type { Study } from '@studyclub/mock';
import { Button, DiscordGlyph, Textarea } from '@studyclub/ui';
import { ChevronDown, FolderOpen } from 'lucide-react';

import { meetingsOf } from '@/lib/attendance';
import { saveStudyRules } from '@/lib/joined-detail-api';
import {
  canOpenDiscord,
  canOpenDrive,
  discordUrl,
  DOW_LABEL,
  dowOf,
  driveUrl,
  isKickoff,
  zoneLabel,
  type NavigatorGroup,
} from '@/lib/meetings';

function LinkButton({ label, href, icon }: { label: string; href: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      title={href}
      className='inline-flex h-8 items-center gap-1.5 rounded-control border border-border-strong px-3 text-sm font-semibold text-fg-secondary hover:bg-surface-2 hover:text-fg'
    >
      {icon}
      {label}
    </a>
  );
}

export function StudyInfoCard({
  study,
  group,
  groupId,
  canEdit,
  onDirty,
  discordChannelUrl,
  driveUrlOverride,
  navigatorName,
  initialRules,
  leadingAction,
}: {
  study: Study;
  group: NavigatorGroup;
  groupId: number;
  canEdit: boolean;
  onDirty: (dirty: boolean) => void;
  discordChannelUrl?: string | null;
  driveUrlOverride?: string | null;
  navigatorName?: string | null;
  initialRules?: string | null;
  /** 바로가기 줄 맨 앞(「디스코드」 왼쪽)에 붙일 버튼 — 캡틴의 「백오피스 출석부」 (10-18 D4). */
  leadingAction?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [rules, setRules] = useState(() => initialRules ?? '');
  const [saved, setSaved] = useState(() => initialRules ?? '');
  /** 규칙 저장 중 · 실패 문구 — 두 번 눌러 같은 요청이 두 번 가지 않게 잠근다. */
  const [savingRules, setSavingRules] = useState(false);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const rulesRef = useRef<HTMLParagraphElement>(null);
  const [rulesOverflows, setRulesOverflows] = useState(false);

  useEffect(() => {
    const el = rulesRef.current;
    if (!el || rulesExpanded) return;
    const id = requestAnimationFrame(() => {
      setRulesOverflows(el.scrollHeight > el.clientHeight);
    });
    return () => cancelAnimationFrame(id);
  }, [rules, rulesExpanded]);
  const first = meetingsOf(study).find((m) => !isKickoff(m));
  const dow = first ? DOW_LABEL[dowOf(first.date)] : null;
  const time = dow
    ? `매주 ${dow}요일 ${group.startAt} ${zoneLabel(group.timeZone)}`
    : `${group.startAt} ${zoneLabel(group.timeZone)}`;
  const navigator = navigatorName ?? study.lead ?? '운영진';
  const hasDiscord = discordChannelUrl != null ? !!discordChannelUrl : canOpenDiscord(study);
  const discordHref = discordChannelUrl ?? discordUrl(study);
  const hasDrive = driveUrlOverride != null ? !!driveUrlOverride : canOpenDrive(study);
  const driveHref = driveUrlOverride ?? driveUrl(study);

  return (
    <section className='card px-5 py-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <dl className='flex flex-wrap gap-x-6 gap-y-1 text-sm'>
          <div className='flex gap-2'>
            <dt className='text-fg-muted'>스터디 시간</dt>
            <dd className='tnum font-semibold text-fg'>{time}</dd>
          </div>
          <div className='flex gap-2'>
            <dt className='text-fg-muted'>네비게이터</dt>
            <dd className='font-semibold text-fg'>{navigator}</dd>
          </div>
        </dl>
        <div className='flex w-full items-center justify-between gap-1.5 sm:w-auto sm:justify-start'>
          <div className='flex flex-wrap items-center gap-1.5'>
            {leadingAction}
            {hasDiscord && discordHref && (
              <LinkButton label='디스코드' href={discordHref} icon={<DiscordGlyph size={15} />} />
            )}
            {hasDrive && driveHref && (
              <LinkButton
                label='자료실'
                href={driveHref}
                icon={<FolderOpen size={15} strokeWidth={1.75} aria-hidden />}
              />
            )}
          </div>
          <button
            type='button'
            aria-label='스터디 규칙'
            aria-expanded={open}
            title={open ? '접기' : '펼치기'}
            onClick={() => setOpen((v) => !v)}
            className='ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-control text-fg-muted hover:bg-surface-2 hover:text-fg sm:ml-0'
          >
            <ChevronDown size={16} aria-hidden className={`transition-transform${open ? ' rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      <div hidden={!open} className='mt-3 border-t border-border pt-3'>
        <div className='flex items-center justify-between'>
          <h2 className='text-sm font-bold'>스터디 규칙</h2>
        </div>
        {canEdit ? (
          <Textarea
            aria-label='스터디 규칙'
            value={rules}
            maxLength={500}
            showCount
            onChange={(e) => {
              setRules(e.target.value);
              onDirty(e.target.value !== saved);
            }}
            className='mt-2 min-h-28 resize-y bg-surface-1 text-sm leading-relaxed'
          />
        ) : (
          <div className='mt-2'>
            <p
              ref={rulesRef}
              className={`whitespace-pre-line text-sm leading-relaxed text-fg-secondary${rulesExpanded ? '' : ' line-clamp-4'}`}
            >
              {rules || '아직 규칙이 없습니다.'}
            </p>
            {rules && (rulesExpanded || rulesOverflows) && (
              <button
                type='button'
                onClick={() => setRulesExpanded((v) => !v)}
                className='mt-1 text-xs font-semibold text-brand underline-offset-2 hover:underline'
              >
                {rulesExpanded ? '접기' : '모두 보기'}
              </button>
            )}
          </div>
        )}
        {canEdit && rules !== saved && (
          <div className='mt-2 flex flex-wrap items-center justify-end gap-2'>
            {rulesError && (
              <p role='status' className='mr-auto text-xs font-semibold text-error-700'>
                {rulesError}
              </p>
            )}
            <Button
              size='sm'
              variant='secondary'
              disabled={savingRules}
              onClick={() => {
                setRulesError(null);
                setRules(saved);
                onDirty(false);
              }}
            >
              취소
            </Button>
            <Button
              size='sm'
              loading={savingRules}
              onClick={async () => {
                if (savingRules) return;
                setSavingRules(true);
                setRulesError(null);
                try {
                  await saveStudyRules(Number(study.id), groupId, rules);
                  setSaved(rules);
                  onDirty(false);
                } catch {
                  setRulesError('규칙을 저장하지 못했습니다. 잠시 뒤 다시 저장해 주세요.');
                } finally {
                  setSavingRules(false);
                }
              }}
            >
              저장
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
