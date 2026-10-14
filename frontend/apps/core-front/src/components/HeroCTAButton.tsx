'use client';

import Link from 'next/link';

import { track } from '@/lib/analytics';

export function HeroCTADiscordLink({ children, ...props }: React.ComponentProps<'a'>) {
  return (
    <a
      {...props}
      onClick={(e) => {
        track({ name: 'Hero CTA Clicked', props: { cta_type: 'discord' } });
        props.onClick?.(e);
      }}
    >
      {children}
    </a>
  );
}

export function HeroCTAStudiesLink({ children, href, onClick, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      href={href}
      {...props}
      onClick={(e) => {
        track({ name: 'Hero CTA Clicked', props: { cta_type: 'studies' } });
        onClick?.(e);
      }}
    >
      {children}
    </Link>
  );
}
