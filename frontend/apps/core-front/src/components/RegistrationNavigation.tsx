'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import type { Locale } from '@/lib/content';

/** 로그인·온보딩에서는 로고와 언어 전환만 표시한다. */
export function RegistrationNavigation({ children, locale }: { children: React.ReactNode; locale: Locale }) {
  const path = usePathname();
  const search = useSearchParams();
  if (path !== `/${locale}/login` && path !== `/${locale}/onboarding`) return children;

  const other = locale === 'ko' ? 'en' : 'ko';
  const params = new URLSearchParams(search.toString());
  const next = params.get('next');
  if (next) params.set('next', next.replace(/^\/(ko|en)(?=\/|\?|#|$)/, `/${other}`));
  const switchUrl = `${path.replace(`/${locale}/`, `/${other}/`)}${params.size ? `?${params}` : ''}`;

  return (
    <header className='sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur-md'>
      <div className='mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-6'>
        <Link href={`/${locale}`} className='flex items-center gap-2 text-lg font-bold tracking-tight'>
          <span className='grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm font-extrabold text-on-brand'>
            S
          </span>
          StudyClub++
        </Link>
        <Link
          href={switchUrl}
          hrefLang={other}
          lang={other}
          className='rounded-full border border-border-strong px-3.5 py-2 text-xs font-medium text-fg-muted transition hover:bg-surface-1 focus-visible:outline-none focus-visible:shadow-(--ring)'
        >
          {other === 'en' ? 'English' : '한국어'}
        </Link>
      </div>
    </header>
  );
}
