'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

import type { Locale } from '@core/lib/content';
import { ButtonLink } from '@studyclub/ui';

/** Keep the service brand, with only the actions relevant to an unfinished signup. */
export function RegistrationNavigation({ children, locale }: { children: React.ReactNode; locale: Locale }) {
  const path = usePathname();
  const search = useSearchParams();
  if (!/\/(login|onboarding)$/.test(path ?? '')) return children;
  const other = locale === 'ko' ? 'en' : 'ko';
  const params = new URLSearchParams(search.toString());
  if (params.has('next'))
    params.set('next', params.get('next')!.replace(`/proto/core/${locale}`, `/proto/core/${other}`));
  const switchUrl = `${path.replace(`/proto/core/${locale}`, `/proto/core/${other}`)}${params.size ? `?${params}` : ''}`;

  return (
    <header className='sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur-md'>
      <div className='mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-6'>
        <Link href={`/proto/core/${locale}`} className='flex items-center gap-2 type-title-md'>
          <Image src='/logo-mark.png' alt='' width={28} height={28} className='h-7 w-7' />
          <span>
            Study<span className='text-logo-accent'>Club</span>
          </span>
        </Link>
        <ButtonLink linkAs={Link} href={switchUrl} hrefLang={other} lang={other} variant='secondary' size='sm' className='rounded-pill'>
          {other === 'en' ? 'English' : '한국어'}
        </ButtonLink>
      </div>
    </header>
  );
}
