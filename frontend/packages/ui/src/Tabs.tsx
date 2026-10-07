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
 * - active: text primary-700 + 2px underline brand(600)
 * - inactive: neutral-600 (hover: neutral-900)
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
      <div role='tablist' className='flex gap-1 overflow-x-auto border-b border-border'>
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
                'relative -mb-px flex items-center whitespace-nowrap px-4 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:shadow-(--ring)',
                isActive ? 'font-semibold text-primary-700' : 'font-medium text-fg-muted hover:text-fg',
                tab.disabled && 'cursor-not-allowed opacity-40 hover:text-fg-muted',
              )}
            >
              <span>{tab.label}</span>

              {tab.badge !== undefined && (
                <span
                  className={cx(
                    'ml-1.5 inline-flex items-center rounded-pill px-1.5 py-0.5 text-xs font-semibold',
                    isActive ? 'bg-brand-subtle text-primary-700' : 'bg-surface-2 text-fg-muted',
                  )}
                >
                  {tab.badge}
                </span>
              )}

              {isActive && (
                <span
                  className='absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand'
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
