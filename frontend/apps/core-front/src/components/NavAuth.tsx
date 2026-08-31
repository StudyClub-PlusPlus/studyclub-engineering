'use client';

// Nav 우측 auth 영역 — 서버 컴포넌트 Nav 안에 끼우는 client 아일랜드.
// 로그아웃 상태: "로그인" 버튼 / 로그인 상태: 아바타+이름 → 드롭다운(마이페이지·로그아웃).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { ChevronDown } from 'lucide-react';

import { getUser, logout, type SessionUser } from '@/lib/auth';
import type { Locale } from '@/lib/content';
import { IS_DEV, enterPreview as startPreview, syncPreview } from '@/lib/preview';

export function NavAuth({ locale }: { locale: Locale }) {
  const router = useRouter();
  // user=null 이 서버·클라 첫 렌더 공통값이라 하이드레이션 불일치 없음.
  // 로그아웃 방문자(대다수)는 "로그인"이 그대로 SSR 되고, 로그인 상태면 마운트 후 아바타로 스왑.
  const [user, setUser] = useState<SessionUser | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 미리보기 세션은 정의가 바뀌었을 수 있어 맞춰서 읽는다
    setUser(syncPreview());
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function enterPreview() {
    startPreview();
    setUser(getUser());
    router.push(`/${locale}/my`);
  }

  if (!user) {
    return (
      <div className='flex items-center gap-2'>
        <Link
          href={`/${locale}/login`}
          className='rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-fg)] transition-colors hover:bg-[var(--color-surface-subtle)]'
        >
          {locale === 'en' ? 'Log in' : '로그인'}
        </Link>
        {IS_DEV && (
          <button
            type='button'
            onClick={enterPreview}
            title='로그인 없이 마이페이지 보기 (로컬 개발 서버 전용)'
            className='rounded-full border border-dashed border-[var(--color-border-strong)] px-3 py-2 text-sm font-semibold text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-surface-subtle)]'
          >
            MY
          </button>
        )}
      </div>
    );
  }

  return (
    <div className='relative' ref={ref}>
      <button
        type='button'
        onClick={() => setOpen((v) => !v)}
        className='flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-[var(--color-surface-subtle)]'
      >
        {user.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.picture} alt='' className='h-8 w-8 rounded-full' />
        ) : (
          <span className='grid h-8 w-8 place-items-center rounded-full bg-[var(--color-accent-soft)] text-xs font-bold text-[var(--color-accent)]'>
            {(user.name ?? user.email).slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className='hidden max-w-[8rem] truncate text-sm font-semibold sm:block'>{user.name ?? user.email}</span>
        <ChevronDown size={14} className='text-[var(--color-fg-subtle)]' />
      </button>

      {open && (
        <div className='absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] py-1 shadow-lg'>
          <div className='truncate px-4 py-2 text-xs text-[var(--color-fg-subtle)]'>{user.email}</div>
          <Link
            href={`/${locale}/my`}
            onClick={() => setOpen(false)}
            className='block px-4 py-2 text-sm font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-subtle)]'
          >
            {locale === 'en' ? 'My page' : '마이페이지'}
          </Link>
          <button
            type='button'
            onClick={async () => {
              setOpen(false);
              await logout();
              setUser(null);
              router.replace(`/${locale}`);
              router.refresh();
            }}
            className='block w-full px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-[var(--color-surface-subtle)]'
          >
            {locale === 'en' ? 'Log out' : '로그아웃'}
          </button>
        </div>
      )}
    </div>
  );
}
