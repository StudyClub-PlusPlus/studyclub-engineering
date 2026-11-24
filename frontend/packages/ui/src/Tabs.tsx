'use client';

import { useState, type ReactNode } from 'react';

import { cx } from './cx';

export interface TabItem {
  key: string;
  label: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  content?: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  activeKey?: string;
  defaultActiveKey?: string;
  onChange?: (key: string) => void;
  className?: string;
}

/**
 * design-system.md §9-8 Tabs.
 *
 * 언더라인형 탭.
 * - active: primary-dark + 2px underline primary
 * - inactive: text-muted (hover: ink)
 */
export function Tabs({ items, activeKey, defaultActiveKey, onChange, className }: TabsProps) {
  const [internalActive, setInternalActive] = useState<string>(
    defaultActiveKey ?? items[0]?.key ?? '',
  );

  const currentKey = activeKey !== undefined ? activeKey : internalActive;
  const currentItem = items.find((item) => item.key === currentKey) ?? items[0];

  function handleTabClick(key: string, disabled?: boolean) {
    if (disabled) return;
    if (activeKey === undefined) {
      setInternalActive(key);
    }
    onChange?.(key);
  }

  return (
    <div className={className}>
      {/* 가로로만 넘친다. 바닥 선 · 밑줄 · 포커스 링을 상자 안에 그려 세로 스크롤바가 생기지 않게 한다 */}
      <div
        role='tablist'
        className='flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--color-border)]'
      >
        {items.map((tab) => {
          const isActive = tab.key === currentKey;

          return (
            <button
              key={tab.key}
              role='tab'
              type='button'
              disabled={tab.disabled}
              aria-selected={isActive}
              onClick={() => handleTabClick(tab.key, tab.disabled)}
              className={cx(
                'relative flex items-center whitespace-nowrap px-4 py-2.5 type-label-lg transition-colors focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--color-focus-ring)]',
                isActive ? 'font-semibold text-primary-dark' : 'font-semibold text-fg-muted hover:text-fg',
                tab.disabled && 'cursor-not-allowed opacity-40 hover:text-fg-muted',
              )}
            >
              <span>{tab.label}</span>

              {tab.badge !== undefined && (
                <span
                  className={cx(
                    'ml-1.5 inline-flex items-center rounded-pill px-1.5 py-0.5 type-label-sm',
                    isActive ? 'bg-primary-light text-primary-dark' : 'bg-surface-2 text-fg-muted',
                  )}
                >
                  {tab.badge}
                </span>
              )}

              {isActive && (
                <span
                  className='absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand'
                  aria-hidden='true'
                />
              )}
            </button>
          );
        })}
      </div>

      {currentItem?.content && <div className='pt-4'>{currentItem.content}</div>}
    </div>
  );
}
