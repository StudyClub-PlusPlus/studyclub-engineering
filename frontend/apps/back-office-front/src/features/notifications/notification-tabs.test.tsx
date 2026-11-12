import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Sidebar } from '@/components/Sidebar';
import { NotificationTabs } from '@/features/notifications/components/NotificationTabs';

const pathname = vi.hoisted(() => ({ current: '/notifications' }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

// 사이드바가 읽는 로그인 정보 — 이 테스트와 무관하다
vi.mock('@/features/auth/auth', () => ({ getUser: () => null, logout: vi.fn() }));

beforeEach(() => {
  pathname.current = '/notifications';
});

describe('알림 탭 — 한 메뉴 두 탭', () => {
  it('두 탭이 템플릿 → 발송 이력 순으로 서고 각자의 화면으로 이어진다', () => {
    render(<NotificationTabs />);

    const tabs = screen.getAllByRole('link');
    expect(tabs.map((t) => t.textContent)).toEqual(['알림 템플릿', '발송 이력']);
    expect(tabs.map((t) => t.getAttribute('href'))).toEqual(['/notification-templates', '/notifications']);
  });

  it('발송 이력 화면에서는 발송 이력 탭만 현재 탭이다', () => {
    pathname.current = '/notifications';
    render(<NotificationTabs />);

    expect(screen.getByRole('link', { name: '발송 이력' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '알림 템플릿' })).not.toHaveAttribute('aria-current');
  });

  it('템플릿 목록과 템플릿 상세에서는 알림 템플릿 탭이 현재 탭이다', () => {
    for (const path of ['/notification-templates', '/notification-templates/1']) {
      pathname.current = path;
      const { unmount } = render(<NotificationTabs />);

      expect(screen.getByRole('link', { name: '알림 템플릿' })).toHaveAttribute('aria-current', 'page');
      expect(screen.getByRole('link', { name: '발송 이력' })).not.toHaveAttribute('aria-current');
      unmount();
    }
  });
});

describe('사이드바 — 알림 메뉴는 하나', () => {
  it('「알림」 한 칸만 있고 알림 템플릿·알림 발송 이력 메뉴는 따로 없다', () => {
    render(<Sidebar />);

    expect(screen.getByRole('link', { name: '알림' })).toHaveAttribute('href', '/notifications');
    expect(screen.queryByRole('link', { name: '알림 템플릿' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '알림 발송 이력' })).not.toBeInTheDocument();
  });

  it('발송 이력·템플릿 목록·템플릿 상세 어디에 있어도 「알림」이 활성이다', () => {
    for (const path of ['/notifications', '/notification-templates', '/notification-templates/3']) {
      pathname.current = path;
      const { unmount } = render(<Sidebar />);

      expect(screen.getByRole('link', { name: '알림' })).toHaveAttribute('aria-current', 'page');
      unmount();
    }
  });

  it('다른 화면에서는 「알림」이 활성이 아니고, 알림 화면에서는 다른 메뉴가 활성이 아니다', () => {
    pathname.current = '/users';
    const { unmount } = render(<Sidebar />);
    expect(screen.getByRole('link', { name: '알림' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: '유저' })).toHaveAttribute('aria-current', 'page');
    unmount();

    pathname.current = '/notifications';
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: '유저' })).not.toHaveAttribute('aria-current');
  });
});
