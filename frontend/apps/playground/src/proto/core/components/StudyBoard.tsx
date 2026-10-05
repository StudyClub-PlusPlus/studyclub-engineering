'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { AutoTextarea } from '@core/components/AutoTextarea';
import { DiscordGlyph } from '@core/components/DiscordGlyph';
import { meetingsOf } from '@core/lib/attendance';
import { canOpenDiscord, canOpenDrive, discordUrl, driveUrl } from '@core/lib/joined';
import { DOW_LABEL, dowOf, isKickoff, zoneLabel, type NavigatorGroup, type ScheduleRole } from '@core/lib/meetings';
import { RULES_MAX, getRules, navigatorNameOf, saveRules } from '@core/lib/schedule-board';
import type { Study } from '@studyclub/mock';
import { Button, cx } from '@studyclub/ui';
import { FolderOpen } from 'lucide-react';

/** 정보 카드의 바로가기 — 아이콘과 이름만 보이고 새 창으로 연다. 주소는 가리키면 보인다. */
function LinkButton({ label, href, icon }: { label: string; href: string; icon: ReactNode }) {
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

/**
 * 스터디 정보 카드 — 구글 시트 머리(스터디 시간 · 네비게이터 · 디스코드 · 자료실)와 스터디 규칙.
 * 스터디 일정의 탭 위에 두어 일정·출석부 어느 탭에서도 보인다.
 */
export function StudyBoard({
  study,
  group,
  role,
  canEdit,
  onDirtyChange,
}: {
  study: Study;
  group: NavigatorGroup;
  role: ScheduleRole;
  canEdit: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  // 시트의 「스터디 시간 : 목요일 7PM PDT」 — 요일은 첫 정규 회차에서, 시각·시간대는 분반에서.
  const firstRegular = meetingsOf(study).find((m) => !isKickoff(m));
  const fixedTime = firstRegular
    ? `매주 ${DOW_LABEL[dowOf(firstRegular.date)]}요일 ${group.startAt} ${zoneLabel(group.timeZone)}`
    : `${group.startAt} ${zoneLabel(group.timeZone)}`;
  const navigator = navigatorNameOf(study, role);

  const [rules, setRules] = useState('');
  /** 캡틴·네비게이터가 고치는 중인 글. 저장한 글과 다르면 저장·취소가 나온다. */
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = getRules(study.id);
    setRules(saved);
    setDraft(saved);
  }, [study.id]);

  const long = rules.split('\n').length > 4 || rules.length > 240;
  const changed = draft.trim() !== rules.trim();

  const dirty = canEdit && changed;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  // 저장하지 않은 규칙 글이 있으면 새로고침·창 닫기 때 브라우저가 묻는다.
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  function save() {
    // TODO(api): PUT /api/studies/{studyId}/groups/{groupId}/rules
    saveRules(study.id, draft.trim());
    setRules(draft.trim());
    setDraft(draft.trim());
  }

  return (
    <section data-anno='manage:3' className='card px-5 py-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <dl className='flex flex-wrap gap-x-6 gap-y-1 text-sm'>
          <div className='flex gap-2'>
            <dt className='text-fg-muted'>스터디 시간</dt>
            <dd className='tnum font-semibold text-fg'>{fixedTime}</dd>
          </div>
          <div className='flex gap-2'>
            <dt className='text-fg-muted'>네비게이터</dt>
            <dd className='font-semibold text-fg'>{navigator}</dd>
          </div>
        </dl>
        {/* 시트 머리에 적어 두던 두 주소. 참가자에게만 보이는 화면이라 그대로 연다 (share 09-30) */}
        <div className='flex flex-wrap gap-1.5'>
          {canOpenDiscord(study) && (
            <LinkButton label='디스코드' href={discordUrl(study)} icon={<DiscordGlyph size={15} />} />
          )}
          {canOpenDrive(study) && (
            <LinkButton
              label='자료실'
              href={driveUrl(study)}
              icon={<FolderOpen size={15} strokeWidth={1.75} aria-hidden />}
            />
          )}
        </div>
      </div>

      <div data-anno='manage:3-1' className='mt-3 border-t border-border pt-3'>
        <h3 className='text-sm font-bold text-fg'>스터디 규칙</h3>
        {canEdit ? (
          <div className='mt-2 flex flex-col gap-2'>
            <AutoTextarea
              label='스터디 규칙'
              value={draft}
              placeholder='킥오프에서 정한 규칙을 적어 두세요. 발표 방식 · 지각 기준 · 소요 시간 등'
              maxLength={RULES_MAX}
              minRows={4}
              className='px-3 py-2 leading-relaxed'
              onChange={setDraft}
            />
            <div className='flex items-center justify-between gap-2'>
              <span className='tnum text-xs text-fg-muted'>
                {draft.length}/{RULES_MAX}
              </span>
              {changed && (
                <span className='flex gap-2'>
                  <Button variant='secondary' size='sm' onClick={() => setDraft(rules)}>
                    취소
                  </Button>
                  <Button size='sm' onClick={save}>
                    저장
                  </Button>
                </span>
              )}
            </div>
          </div>
        ) : rules ? (
          <>
            <p
              className={cx(
                'mt-1.5 whitespace-pre-line text-sm leading-relaxed text-fg-secondary',
                long && !open && 'line-clamp-4',
              )}
            >
              {rules}
            </p>
            {long && (
              <button
                type='button'
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className='mt-1 text-xs font-semibold text-brand underline-offset-2 hover:underline'
              >
                {open ? '접기' : '모두 보기'}
              </button>
            )}
          </>
        ) : (
          <p className='mt-1.5 text-sm text-fg-muted'>아직 규칙이 없습니다.</p>
        )}
      </div>
    </section>
  );
}
