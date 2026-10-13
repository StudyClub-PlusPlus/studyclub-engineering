import type { HTMLAttributes, ReactNode } from 'react';

import { CapacityBar } from './CapacityBar';
import { Card } from './Card';
import { cx } from './cx';

/**
 * design-system.md §9-5 Study Card.
 *
 * 구조:
 * - 상단 카테고리 컬러 스트립 4px
 * - 헤더: 카테고리 태그 + 상태 pill + 북마크
 * - 타이틀: text-xl/600 ink (2줄 말줄임)
 * - 일정: text-sm text-muted
 * - 메타: 인원(👥 6/8명 tabular-nums) · 조회수(👁 124 tabular-nums) · 액션(신청하기 sm)
 * - 정원 진행바: 80%↑ warning tint 승격
 */
export interface StudyCardProps extends HTMLAttributes<HTMLDivElement> {
  /** 카테고리 라벨 (예: "개발", "AI · ML") */
  category?: string;
  /** 카테고리 스트립/아이콘 색상 (CSS var 또는 토큰, 기본 var(--color-brand)) */
  categoryColor?: string;
  /** 카테고리 아이콘 */
  categoryIcon?: ReactNode;
  /** 상태 뱃지 (예: `<Badge tone="recruiting">모집중</Badge>`) */
  badge?: ReactNode;
  /** 우측 북마크 슬롯 */
  bookmark?: ReactNode;
  /** 스터디 제목 (최대 2줄 말줄임) */
  title: string;
  /** 스터디 일정 / 요약 (예: "매주 목 20:00 · 8주 과정") */
  schedule?: ReactNode;
  /** 추가 설명 / 요약 */
  summary?: ReactNode;
  /** 현재 참여 인원 */
  currentMembers?: number;
  /** 정원 */
  maxMembers?: number;
  /** 조회수 */
  views?: number;
  /** 카드 하단 우측 액션 (예: 신청 버튼) */
  action?: ReactNode;
  /** 호버 인터랙션 활성화 여부 */
  interactive?: boolean;
}

export function StudyCard({
  category,
  categoryColor = 'var(--color-brand)',
  categoryIcon,
  badge,
  bookmark,
  title,
  schedule,
  summary,
  currentMembers,
  maxMembers,
  views,
  action,
  interactive = true,
  className,
  children,
  ...rest
}: StudyCardProps) {
  const hasCapacity = typeof currentMembers === 'number' && typeof maxMembers === 'number' && maxMembers > 0;

  return (
    <Card
      padding='none'
      interactive={interactive}
      className={cx('flex flex-col overflow-hidden', className)}
      {...rest}
    >
      {/* 카테고리 컬러 스트립 (4px) */}
      <div className='h-1 w-full shrink-0' style={{ background: categoryColor }} aria-hidden='true' />

      <div className='flex flex-1 flex-col p-5'>
        {/* 헤더: 태그 + 상태 pill + 북마크 */}
        <div className='flex items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            {category && (
              <span className='inline-flex items-center gap-1 rounded-pill bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-fg-secondary'>
                {categoryIcon}
                {category}
              </span>
            )}
            {badge}
          </div>
          {bookmark && <div className='shrink-0'>{bookmark}</div>}
        </div>

        {/* 타이틀 (2줄 말줄임) */}
        <h3 className='mt-3 line-clamp-2 text-xl font-semibold leading-[1.3] tracking-tight text-ink'>
          {title}
        </h3>

        {/* 일정 / 요약 */}
        {schedule && <p className='mt-1 text-sm text-fg-muted'>{schedule}</p>}
        {summary && <p className='mt-2 line-clamp-2 text-sm leading-relaxed text-fg-secondary'>{summary}</p>}

        {children}

        {/* 하단 메타 + 액션 */}
        <div className='mt-auto pt-4'>
          <div className='flex items-center justify-between gap-3 border-t border-border pt-3'>
            <div className='flex flex-wrap items-center gap-3 text-xs text-fg-muted'>
              {hasCapacity && (
                <span className='tnum font-medium'>
                  👥 {currentMembers}/{maxMembers}명
                </span>
              )}
              {typeof views === 'number' && <span className='tnum'>👁 {views}</span>}
            </div>
            {action && <div className='shrink-0'>{action}</div>}
          </div>

          {/* 정원 진행바 */}
          {hasCapacity && (
            <div className='mt-3'>
              <CapacityBar taken={currentMembers} total={maxMembers} showLabel />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
