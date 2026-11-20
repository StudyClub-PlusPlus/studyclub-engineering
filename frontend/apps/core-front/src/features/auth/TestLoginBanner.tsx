'use client';

import { useEffect, useState } from 'react';

import { getLoginMethod, getUser } from './auth';

/** 테스트 로그인(specs/stage-email-login)으로 들어왔으면 맨 위 한 줄 — 개인 계정과 헷갈리지 않게 */
export function TestLoginBanner() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    if (getLoginMethod() === 'email') setEmail(getUser()?.email ?? null);
  }, []);
  if (!email) return null;
  return (
    <div className='border-b border-border bg-surface-1 px-4 py-2 text-center type-body-sm text-fg' data-clarity-mask='true'>
      테스트 계정으로 로그인했어요 · {email}
    </div>
  );
}
