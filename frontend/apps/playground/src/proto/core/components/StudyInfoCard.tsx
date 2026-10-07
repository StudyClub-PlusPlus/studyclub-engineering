'use client';

import { useId, useState, type ReactNode } from 'react';

import { DiscordGlyph } from '@core/components/DiscordGlyph';
import { RulesEditor } from '@core/components/RulesEditor';
import { cx } from '@studyclub/ui';
import { ChevronDown, FolderOpen } from 'lucide-react';

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
 *
 * 사용자 사이트 스터디 일정(내 분반)과 백오피스 일정 탭(고른 반)이 같은 카드를 쓴다.
 * 무엇을 보일지는 부르는 쪽이 정한다 — 카드는 받은 값을 그릴 뿐이다.
 *
 * 번호는 `anno` 하나를 받아 카드 · `-1` 규칙 · `-2` 접기로 붙인다.
 */
export function StudyInfoCard({
  time,
  navigator,
  discordHref,
  driveHref,
  rulesKey,
  canEdit,
  onDirtyChange,
  anno,
  className,
}: {
  /** 「매주 수요일 20:30 KST」 */
  time: string;
  /** 네비게이터 이름. 없으면 부르는 쪽이 「미지정」 등으로 넘긴다. */
  navigator: string;
  /** 비면 그 버튼을 두지 않는다. */
  discordHref?: string;
  driveHref?: string;
  /** 분반 규칙의 저장 키. */
  rulesKey: string;
  canEdit: boolean;
  onDirtyChange: (dirty: boolean) => void;
  anno: string;
  className?: string;
}) {
  /** 카드 접기 — 처음엔 펼친다. 접으면 머리 줄(시간 · 네비게이터 · 바로가기)만 남는다. */
  const [expanded, setExpanded] = useState(true);
  const bodyId = useId();

  return (
    <section data-anno={anno} className={cx('card px-5 py-4', className)}>
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
        {/* 시트 머리에 적어 두던 두 주소. 참가자·운영자에게만 보이는 화면이라 그대로 연다 (share 09-30) */}
        <div className='flex flex-wrap gap-1.5'>
          {discordHref && <LinkButton label='디스코드' href={discordHref} icon={<DiscordGlyph size={15} />} />}
          {driveHref && (
            <LinkButton
              label='자료실'
              href={driveHref}
              icon={<FolderOpen size={15} strokeWidth={1.75} aria-hidden />}
            />
          )}
          <button
            type='button'
            data-anno={`${anno}-2`}
            aria-expanded={expanded}
            aria-controls={bodyId}
            aria-label='스터디 규칙'
            title={expanded ? '접기' : '펼치기'}
            onClick={() => setExpanded((v) => !v)}
            className='grid h-8 w-8 place-items-center rounded-control text-fg-muted hover:bg-surface-2 hover:text-fg'
          >
            <ChevronDown size={16} aria-hidden className={cx('transition-transform', expanded && 'rotate-180')} />
          </button>
        </div>
      </div>

      {/* 접어도 본문을 지우지 않고 숨긴다 — aria-controls 가 가리킬 곳이 늘 있고, 저장하지 않은 글도 남는다 */}
      <div id={bodyId} hidden={!expanded} data-anno={`${anno}-1`} className='mt-3 border-t border-border pt-3'>
        <RulesEditor storeKey={rulesKey} canEdit={canEdit} onDirtyChange={onDirtyChange} />
      </div>
    </section>
  );
}
