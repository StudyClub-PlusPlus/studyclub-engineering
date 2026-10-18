'use client';

// Nav 우측 auth 영역 — 서버 컴포넌트 Nav 안에 끼우는 client 아일랜드.
// 로그아웃 상태: "로그인" 버튼 / 로그인 상태: 아바타+이름 → 드롭다운(마이페이지·로그아웃).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { openFeedback } from '@core/components/Feedback';
import { getUser, logout, type SessionUser } from '@core/lib/auth';
import type { Locale } from '@core/lib/content';
import { IS_DEV, enterPreview as startPreview, syncPreview } from '@core/lib/preview';
import { ChevronDown, DoorOpen, Heart, LogOut, UserRound, MessageSquareWarning } from 'lucide-react';

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
    router.push(`/proto/core/${locale}/my`);
  }

  if (user?.onboardingCompletedAt === null) {
    return (
      <Link
        href={`/proto/core/${locale}/onboarding`}
        className='rounded-full bg-brand px-4 py-2 text-sm font-semibold text-on-brand'
      >
        {locale === 'en' ? 'Finish sign-up' : '가입 마무리'}
      </Link>
    );
  }

  if (!user) {
    return (
      <div className='flex items-center gap-2'>
        <Link
          href={`/proto/core/${locale}/login`}
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
        {/* 프로필 사진은 받지 않는다 — 이름 첫 글자로 자리만 만든다 */}
        <span className='grid h-8 w-8 place-items-center rounded-full bg-[var(--color-brand-subtle)] text-xs font-bold text-[var(--color-brand)]'>
          {(user.nickname ?? user.email).slice(0, 1).toUpperCase()}
        </span>
        <span className='hidden max-w-[8rem] truncate text-sm font-semibold sm:block'>{user.nickname ?? user.email}</span>
        <ChevronDown size={14} className='text-[var(--color-fg-muted)]' />
      </button>

      {open && (
        // 그림자는 옅게. 테두리로 경계를 잡고 그림자는 아래로만 살짝
        <div className='absolute right-0 z-40 mt-2 w-52 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-1.5 shadow-[0_10px_30px_-12px_rgb(15_23_42/0.18)]'>
          <div className='truncate px-3 pb-2 pt-1.5 text-xs text-[var(--color-fg-muted)]'>{user.email}</div>
          <Link
            href={`/proto/core/${locale}/my/joined`}
            onClick={() => setOpen(false)}
            className='flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--color-fg)] hover:bg-[var(--color-surface-subtle)]'
          >
            <DoorOpen size={16} style={{ color: 'var(--color-brand)' }} />
            {locale === 'en' ? 'My study room' : '내 스터디룸'}
          </Link>
          <Link
            href={`/proto/core/${locale}/my`}
            onClick={() => setOpen(false)}
            className='flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-subtle)]'
          >
            <UserRound size={16} className='text-[var(--color-fg-muted)]' />
            {locale === 'en' ? 'My page' : '마이페이지'}
          </Link>
          <Link
            href={`/proto/core/${locale}/my/saved`}
            onClick={() => setOpen(false)}
            className='flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-subtle)]'
          >
            <Heart size={16} className='text-[var(--color-fg-muted)]' />
            {locale === 'en' ? 'Saved' : '찜한 스터디'}
          </Link>
          {/* 찜한 스터디 아래, 로그아웃 위 — 구분선으로 로그아웃과 떨어뜨린다 */}
          <button
            type='button'
            data-anno='feedback:1'
            onClick={() => {
              setOpen(false);
              openFeedback();
            }}
            className='flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-subtle)]'
          >
            <MessageSquareWarning size={16} className='text-[var(--color-fg-muted)]' />
            {locale === 'en' ? 'Contact · report' : '문의·신고'}
          </button>
          <div className='my-1 h-px bg-[var(--color-border)]' />
          <button
            type='button'
            onClick={async () => {
              setOpen(false);
              await logout();
              setUser(null);
              router.replace(`/proto/core/${locale}`);
              router.refresh();
            }}
            className='flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-danger-fg hover:bg-[var(--color-surface-subtle)]'
          >
            <LogOut size={16} />
            {locale === 'en' ? 'Log out' : '로그아웃'}
          </button>
        </div>
      )}
    </div>
  );
}
