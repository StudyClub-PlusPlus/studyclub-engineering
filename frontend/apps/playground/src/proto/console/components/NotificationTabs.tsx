'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const BASE = '/proto/console/notifications';

/**
 * 알림 화면의 두 갈래 — **무엇을 보내는가**(템플릿)와 **무엇이 나갔는가**(발송 이력).
 *
 * 사이드바를 두 단으로 만들지 않는다. 다른 메뉴와 깊이가 달라져 훑기 어렵다 —
 * 스터디 상세가 탭으로 가르는 것과 같은 방식으로 한 화면 안에서 나눈다.
 */
const TABS = [
  { href: `${BASE}/templates`, label: '알림 템플릿' },
  { href: BASE, label: '발송 이력', exact: true },
];

export function NotificationTabs() {
  const pathname = usePathname() || '';
  return (
    <nav data-anno='noti:1' className='mb-5 flex gap-1 border-b border-border'>
      {TABS.map((tab) => {
        const on = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
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
