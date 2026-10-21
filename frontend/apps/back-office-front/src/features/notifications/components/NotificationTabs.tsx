'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * 알림 화면의 두 갈래 — **무엇을 보내는가**(템플릿)와 **무엇이 나갔는가**(발송 이력).
 *
 * 사이드바는 「알림」 하나다. 두 단으로 만들면 다른 메뉴와 깊이가 달라져 훑기 어렵다 — 한 화면 안에서 탭으로 가른다
 * (기획 PRD, playground 와 같은 모양). 템플릿 상세(`/notification-templates/[id]`)는 템플릿 탭 안의 화면이다.
 */
const TABS = [
  { href: '/notification-templates', label: '알림 템플릿' },
  { href: '/notifications', label: '발송 이력' },
];

export function NotificationTabs() {
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
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              on ? 'border-brand text-fg' : 'border-transparent text-fg-muted hover:text-fg-secondary'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
