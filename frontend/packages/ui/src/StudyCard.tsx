import type { ElementType, HTMLAttributes, ReactNode } from 'react';

import type { LucideIcon } from 'lucide-react';

import { cx } from './cx';
import { categoryArtUrl, categoryGradient, categoryMeta } from './StudyThumb';

/**
 * design-system.md §9-5 Study Card — **둘러보기 전용.**
 *
 * 신청하기·찜·인기(HOT) 배지를 두지 않는다. 신청은 상세에서만 한다 — 둘러보는 화면과 신청하는 화면을
 * 섞으면 목록에서 실수로 신청 버튼을 누르는 일이 생긴다.
 *
 * 구조:
 * - 컬러 헤더(고정 높이 160px): 카테고리 그라디언트 + 워터마크 아이콘, 글래스 상태 배지, 카테고리 라벨, 제목(2줄)
 * - 본문: 한 줄 소개(2줄) + 정보 줄(일정·시간대·시작 예정일 …)
 * - 카드 전체가 링크다(stretched link). 앱은 `linkAs` 로 Next.js `Link` 를 넘긴다.
 *
 * 무엇을 보여 줄지(배지 문구, 날짜 형식, 번역)는 앱이 정해서 넘긴다. 이 부품은 그리기만 한다.
 */
export interface StudyCardDetail {
  icon: LucideIcon;
  label: ReactNode;
}

export interface StudyCardProps extends HTMLAttributes<HTMLDivElement> {
  /** 상세 화면 주소 */
  href: string;
  /** 링크 컴포넌트 (기본 `a`, Next.js 앱은 `Link`) */
  linkAs?: ElementType;
  /** 스터디 제목 (최대 2줄 말줄임) */
  title: string;
  /** 카테고리 — 공식 표기나 API enum 값. 헤더 색·아이콘·라벨이 여기서 정해진다 */
  category?: string;
  /** 헤더 왼쪽 위 상태 배지 (예: 모집중 D-3) */
  badge?: { label: ReactNode; dotClassName?: string };
  /** 한 줄 소개 (최대 2줄 말줄임) */
  summary?: ReactNode;
  /** 본문 정보 줄 — 위에서부터 차례로 */
  details?: StudyCardDetail[];
}

export function StudyCard({
  href,
  linkAs: LinkComponent = 'a',
  title,
  category,
  badge,
  summary,
  details = [],
  className,
  ...rest
}: StudyCardProps) {
  const { icon: CategoryIcon, label: categoryLabel } = categoryMeta(category);
  const artUrl = categoryArtUrl(category);

  return (
    <div {...rest} className={cx('card card-hover relative flex flex-col overflow-hidden', className)}>
      {/* Stretched link — 앵커를 겹치지 않고 카드 전체를 덮는다 */}
      <LinkComponent href={href} className='absolute inset-0 z-[1] rounded-[inherit]' aria-label={title} />

      {/* 컬러 헤더 — 고정 높이. 색은 카테고리를 따라간다(같은 분야 = 같은 색) */}
      <div
        className='relative flex h-40 shrink-0 flex-col justify-between overflow-hidden p-4'
        style={{ background: categoryGradient(category) }}
      >
        {artUrl ? (
          <span
            className='pointer-events-none absolute right-3 top-3 h-24 w-24 bg-contain bg-center bg-no-repeat drop-shadow-lg'
            style={{ backgroundImage: `url(${artUrl})` }}
            aria-hidden='true'
          />
        ) : (
          <CategoryIcon
            className='pointer-events-none absolute -bottom-5 -right-4 text-white/15'
            size={104}
            strokeWidth={1.25}
            aria-hidden='true'
          />
        )}
        {badge ? (
          <span className='relative inline-flex w-fit items-center gap-1.5 rounded-pill bg-black/40 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md'>
            {badge.dotClassName && (
              <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', badge.dotClassName)} aria-hidden='true' />
            )}
            {badge.label}
          </span>
        ) : (
          <span />
        )}
        <div className='relative text-white'>
          <span className='flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/70'>
            <CategoryIcon size={12} strokeWidth={1.75} className='shrink-0' />
            {categoryLabel}
          </span>
          {/* 최대 2줄 — 넘치면 말줄임. 카드 높이를 균일하게 유지한다. */}
          <h3 className='mt-1 line-clamp-2 break-keep text-xl font-bold leading-[1.3] tracking-tight'>{title}</h3>
        </div>
      </div>

      {/* 본문 — 한 줄 소개와 정보 줄을 한 영역에 모은다. 별도 하단 바로 나누지 않는다. */}
      <div className='flex flex-1 flex-col gap-3 p-5'>
        {summary && <p className='line-clamp-2 text-sm leading-relaxed text-fg-secondary'>{summary}</p>}

        {details.length > 0 && (
          <div className='space-y-1.5 text-xs text-fg-muted'>
            {details.map(({ icon: Icon, label }, i) => (
              <div key={i} className='flex items-center gap-2'>
                <Icon size={13} strokeWidth={1.75} className='shrink-0' />
                {label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
