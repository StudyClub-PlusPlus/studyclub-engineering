'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * 알림 화면의 두 갈래 — **무엇을 보내는가**(템플릿)와 **무엇이 나갔는가**(발송 이력).
 *
 * 사이드바는 「알림」 하나다. 두 단으로 만들면 다른 메뉴와 깊이가 달라져 훑기 어렵다 — 한 화면 안에서 탭으로 가른다
 * (기획 PRD, playground 와 같은 모양).
 *
 * `action` 은 **그 탭에서만 할 수 있는 일**이 선 자리다 (템플릿 추가). 탭 줄 오른쪽 끝에 둬서 지금 보는 것과
 * 지금 할 수 있는 일이 한 줄에서 읽히고, 다른 탭으로 넘어가면 같이 사라진다.
 */
const TABS = [
  { href: '/notification-templates', label: '알림 템플릿' },
  { href: '/notifications', label: '발송 이력' },
];

export function NotificationTabs({ action }: { action?: ReactNode }) {
  const pathname = usePathname() || '';
  return (
    <nav aria-label='알림' className='mb-5 flex items-center gap-1 border-b border-border'>
      {TABS.map((tab) => {
        const on = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={on ? 'page' : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 type-label-lg transition-colors ${
              on ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg-secondary'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
      {action && <div className='ml-auto pb-1.5'>{action}</div>}
    </nav>
  );
}
