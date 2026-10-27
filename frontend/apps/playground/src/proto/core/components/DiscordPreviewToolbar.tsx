'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getUser, setUser } from '@core/lib/auth';
import { getDiscordOutcome, setDiscordFixture, setDiscordOutcome, type DiscordOutcome } from '@core/lib/discord-preview';

/** Reviewer controls live in the playground shell, outside the product UI. */
export function DiscordPreviewToolbar() {
  const path = usePathname();
  const router = useRouter();
  const [outcome, setOutcome] = useState<DiscordOutcome>('success');
  useEffect(() => setOutcome(getDiscordOutcome()), []);
  if (!/^\/proto\/core\/(ko|en)\/(my|onboarding|studies\/\d+)$/.test(path)) return null;
  const locale = path.includes('/core/en/') ? 'en' : 'ko';
  const ko = locale === 'ko';

  function fixture(value: string) {
    if (!value) return;
    const current = getUser();
    setUser({ id: -1001, email: 'crew@example.com', nickname: current?.nickname || 'Journey', picture: null, role: 'MEMBER', onboardingCompletedAt: new Date().toISOString() });
    setDiscordFixture(value === 'signup' ? 'unlinked' : value as 'unlinked' | 'linked' | 'participating' | 'ended');
    if (value === 'signup') router.push(`/proto/core/${locale}/onboarding?step=discord`);
    else window.location.assign(`/proto/core/${locale}/my`);
  }

  return (
    <aside aria-label={ko ? '디스코드 검토 도구' : 'Discord preview controls'} className='border-b border-border bg-surface-1 px-5 py-2.5'>
      <div className='mx-auto flex max-w-6xl flex-wrap items-center gap-3 type-label-sm'>
        <span className='font-semibold text-fg-muted'>{ko ? '디스코드 미리보기' : 'Discord preview'}</span>
        <label className='flex items-center gap-2'>
          {ko ? '예시 회원 (선택 시 예시 데이터 초기화)' : 'Example member (resets example data)'}
          <select value='' onChange={(event) => fixture(event.target.value)} className='min-h-9 max-w-full rounded-control border border-border-strong bg-bg px-2'>
            <option value=''>{ko ? '상태 선택' : 'Select state'}</option>
            <option value='signup'>{ko ? '가입 완료 후 안내' : 'After sign-up'}</option>
            <option value='unlinked'>{ko ? '미연결' : 'Not connected'}</option>
            <option value='linked'>{ko ? '연결됨 · 참여 없음' : 'Connected · no studies'}</option>
            <option value='participating'>{ko ? '연결됨 · 참여 중' : 'Connected · participating'}</option>
            <option value='ended'>{ko ? '연결됨 · 종료만 있음' : 'Connected · ended studies only'}</option>
          </select>
        </label>
        <label className='flex items-center gap-2'>
          {ko ? '연결 시뮬레이션' : 'Connection simulation'}
          <select value={outcome} onChange={(event) => { const value = event.target.value as DiscordOutcome; setOutcome(value); setDiscordOutcome(value); }} className='min-h-9 rounded-control border border-border-strong bg-bg px-2'>
            <option value='success'>{ko ? '성공' : 'Success'}</option>
            <option value='error'>{ko ? '실패' : 'Failure'}</option>
            <option value='cancelled'>{ko ? '인증 취소' : 'Cancelled'}</option>
          </select>
        </label>
      </div>
    </aside>
  );
}
