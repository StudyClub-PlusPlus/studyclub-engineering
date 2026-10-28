'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { ArrowUpRight, Menu, X } from 'lucide-react';

import { getUser } from '@/lib/auth';
import type { Locale } from '@/lib/content';
import { announceMenuOpen, closeOnOtherMenu } from '@/lib/header-menus';
import { t } from '@/lib/i18n';

/**
 * 모바일(md 미만) 메뉴 — 데스크톱 상단 메뉴(NavLinks)가 숨는 폭에서 같은 항목을 연다.
 *
 * `@studyclub/ui` Modal 은 배경을 눌러도 닫히지 않게 돼 있어(POL-0008) 메뉴로는 못 쓴다.
 * 메뉴는 바깥을 누르면 닫혀야 한다 — 그래서 헤더 아래를 덮는 얇은 시트를 따로 둔다.
 */
export function MobileNav({
  locale,
  links,
  mentoring,
  join,
}: {
  locale: Locale;
  links: { href: string; label: string }[];
  mentoring?: { href: string; label: string };
  join: { href: string; label: string };
}) {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 다른 헤더 메뉴가 열리면 닫는다 (lib/header-menus.ts)
  useEffect(() => closeOnOtherMenu('mobile-nav', () => setOpen(false)), []);

  useEffect(() => setSignedIn(Boolean(getUser())), [open]);

  // 이동하면 닫는다
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const all = signedIn
    ? [...links, { href: `/${locale}/my/joined`, label: t({ ko: '내 스터디룸', en: 'My study room' }, locale) }]
    : links;
  const focusRing = 'focus-visible:outline-none focus-visible:shadow-(--ring)';

  return (
    <div className='md:hidden'>
      <button
        ref={buttonRef}
        type='button'
        onClick={() => setOpen((v) => {
          if (!v) announceMenuOpen('mobile-nav');
          return !v;
        })}
        aria-label={open ? t({ ko: '메뉴 닫기', en: 'Close menu' }, locale) : t({ ko: '메뉴 열기', en: 'Open menu' }, locale)}
        aria-expanded={open}
        aria-controls='mobile-nav'
        className={`grid h-9 w-9 place-items-center rounded-full text-fg transition-colors hover:bg-surface-2 ${focusRing}`}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open && (
        <div className='fixed inset-x-0 bottom-0 top-16 z-40'>
          <div className='absolute inset-0' style={{ background: 'var(--overlay)' }} onClick={() => setOpen(false)} aria-hidden='true' />
          <nav id='mobile-nav' className='relative flex flex-col gap-1 border-b border-border bg-bg p-3 shadow-lg'>
            {all.map((l) => {
              const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-control px-3 py-2.5 type-body-md transition-colors ${focusRing} ${
                    active ? 'bg-brand-subtle font-semibold text-brand' : 'font-semibold text-fg hover:bg-surface-2'
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
            {mentoring && (
              <a
                href={mentoring.href}
                target='_blank'
                rel='noreferrer'
                className={`inline-flex items-center gap-1 rounded-control px-3 py-2.5 type-title-md text-fg-muted hover:bg-surface-2 ${focusRing}`}
              >
                {mentoring.label}
                <ArrowUpRight size={14} />
              </a>
            )}
            <a
              href={join.href}
              target='_blank'
              rel='noreferrer'
              className={`mt-2 rounded-full bg-brand px-4 py-2.5 text-center type-label-lg text-on-brand ${focusRing}`}
            >
              {join.label}
            </a>
          </nav>
        </div>
      )}
    </div>
  );
}
