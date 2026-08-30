'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { enterPreview } from '@core/lib/preview';

import { AnnotateProvider, AnnotateToggle, AnnotationLayer } from '@/proto/annotate';

const LINKS = [
  // href 는 들어가는 문, match 는 "지금 여기에 있는가" 판정. en 으로 보다가도 사용자 사이트가 켜져 있어야 한다.
  { href: '/proto/core/ko', match: '/proto/core', label: '사용자 사이트' },
  { href: '/proto/console', match: '/proto/console', label: '운영 콘솔' },
];

/**
 * 프로토 화면을 감싸는 껍데기.
 *
 * 상단 바는 **일부러 sticky 가 아니다.** 실제 서비스의 헤더가 sticky 라서, 이 바까지 붙어 있으면
 * 스크롤할 때 화면 상단이 두 겹이 되어 시안이 실제와 달라 보인다. 스크롤하면 비켜난다.
 */
export function ProtoShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';

  // 마이페이지·내 스터디는 로그인해야 열린다. mock 세션을 미리 깔아 두면
  // 디자이너가 로그인 화면을 통과하려 애쓰지 않아도 된다.
  //
  // useEffect 로 깔면 늦다. React 는 **자식 이펙트를 부모보다 먼저** 실행하므로,
  // 화면이 로그인 여부를 확인하는 시점에 세션이 아직 없어 로그인으로 튕긴다.
  // useState 초기화 함수는 자식이 렌더되기 전에 한 번 돌아서 순서가 맞는다.
  // (서버 렌더에는 localStorage·document 가 없으므로 브라우저에서만.)
  useState(() => {
    if (typeof window !== 'undefined') enterPreview();
    return null;
  });

  return (
    <AnnotateProvider>
      <div className='proto-stack'>
        <div className='border-b border-[var(--color-border)] bg-[var(--color-fg)] text-white'>
          <div className='mx-auto flex h-10 max-w-none items-center gap-5 px-5 text-[12px]'>
            <Link href='/' className='font-bold opacity-70 transition-opacity hover:opacity-100'>
              ← playground
            </Link>
            <nav className='flex items-center gap-4'>
              {LINKS.map((l) => {
                const active = pathname.startsWith(l.match);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className='transition-opacity'
                    style={{ opacity: active ? 1 : 0.6, fontWeight: active ? 700 : 400 }}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>
            <span className='ml-auto opacity-50'>mock 데이터 · 저장되지 않음</span>
          </div>
        </div>

        {children}

        <AnnotationLayer />
        <AnnotateToggle />
      </div>
    </AnnotateProvider>
  );
}
