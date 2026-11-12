'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getUser } from '@core/lib/auth';
import type { Locale } from '@core/lib/content';
import { withoutApplyIntent } from '@core/lib/discord-preview';
import { getDiscord } from '@core/lib/me';
import { Button } from '@studyclub/ui';
import { CheckCircle2, MessageCircle } from 'lucide-react';

import { useDiscordLink } from './useDiscordLink';
import { DISCORD_SPEC } from '@/app/(proto)/proto/core/[locale]/onboarding/spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export function OnboardingDiscord({ locale, next }: { locale: Locale; next: string }) {
  const ko = locale === 'ko';
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const { linking, error, connect, cancel } = useDiscordLink(locale);

  useEffect(() => {
    if (!getUser()?.onboardingCompletedAt) {
      router.replace(`/proto/core/${locale}/onboarding?next=${encodeURIComponent(next)}`);
    } else if (getDiscord()) {
      router.replace(next);
    } else {
      setReady(true);
    }
  }, [locale, next, router]);

  if (!ready) return <div role='status' className='p-8 text-center'>{ko ? '가입 정보를 확인하고 있어요…' : 'Loading your profile…'}</div>;

  return (
    <div className='min-h-[72vh] bg-surface-1 px-4 py-12 sm:px-6'>
      <ScreenSpecRegistrar spec={DISCORD_SPEC} />
      <section className='mx-auto max-w-lg rounded-card border border-border bg-bg p-6 shadow-xs sm:p-8'>
        <div data-anno='onboarding-discord:1'>
          <p className='mb-5 flex items-center gap-2 type-label-lg text-success-700'>
            <CheckCircle2 size={20} aria-hidden='true' />
            {ko ? '홈페이지 가입이 완료됐어요' : 'Your sign-up is complete'}
          </p>
          <h1 className='type-headline-sm'>
            {ko ? '스터디는 디스코드에서 진행돼요. 지금 연결할까요?' : 'Studies happen on Discord. Connect now?'}
          </h1>
          {/* 부제를 두지 않는다 — 아래 두 버튼이 「언제 연결하나」를 이미 말한다 */}
        </div>
        {error && <p data-anno='onboarding-discord:4' role='alert' className='mt-5 type-body-sm text-error-700'>{error}</p>}
        <div className='mt-7 flex flex-col gap-3'>
          <Button data-anno='onboarding-discord:2' size='lg' loading={linking} leadingIcon={<MessageCircle size={18} />} onClick={() => connect(() => router.replace(next))}>
            {ko ? '지금 연결' : 'Connect now'}
          </Button>
          <Button data-anno='onboarding-discord:3' size='lg' variant='secondary' onClick={() => { cancel(); router.replace(withoutApplyIntent(next)); }}>
            {ko ? '스터디 신청할 때 하기' : 'When I apply for a study'}
          </Button>
        </div>
      </section>
    </div>
  );
}
