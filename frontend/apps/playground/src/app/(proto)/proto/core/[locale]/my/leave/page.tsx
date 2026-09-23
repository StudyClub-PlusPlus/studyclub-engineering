'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { getUser, type SessionUser } from '@core/lib/auth';
import type { Locale } from '@core/lib/content';
import { studies as allStudies } from '@studyclub/mock';
import { Button } from '@studyclub/ui';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

import { SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

/** 탈퇴 사유 — 둘에 기타 하나. 겹치는 항목을 두면 같은 사람이 날마다 다른 칸을 골라 집계가 흔들린다. */
const REASONS = ['원하는 스터디 없음', '스터디 참여가 부담됨', '기타'];

/**
 * 회원 탈퇴.
 *
 * 읽을 것은 두 줄(되돌릴 수 없음 · 재가입해도 기록은 없음)뿐이다. 그 아래 사유 한 칸과 버튼.
 * 맡은 스터디가 있는 사람에게만 버튼 아래로 경고가 서고, 거기서 한 번 더 묻는다.
 *
 * TODO(api): DELETE /api/me — 지금은 화면에서만 처리한다. 담당 스터디 여부도 서버가 판정해야 한다.
 */
export default function LeavePage() {
  return (
    <Suspense fallback={<div className='px-6 py-16 text-center text-sm text-fg-secondary'>불러오는 중…</div>}>
      <LeaveScreen />
    </Suspense>
  );
}

function LeaveScreen() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const locale = ((params?.locale as string) ?? 'ko') as Locale;

  const [user, setUser] = useState<SessionUser | null>(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');

  // 담당 스터디는 운영 쪽 값이라 사용자 사이트 mock 에 없다.
  // **프로토는 네비게이터 버전을 보여준다** — 볼 것이 더 많은 쪽이다. `?navigator=0` 이면 크루 화면.
  const navigatorOf = search.get('navigator') === '0' ? [] : allStudies.slice(0, 2);
  const isNavigator = navigatorOf.length > 0;

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace(`/proto/core/${locale}/login?next=/proto/core/${locale}/my/leave`);
      return;
    }
    setUser(u);
  }, [locale, router]);

  function leave() {
    setPending(true);
    setTimeout(() => router.replace(`/proto/core/${locale}`), 800);
  }

  if (!user) return <div className='px-6 py-16 text-center text-sm text-fg-secondary'>불러오는 중…</div>;

  return (
    <div className='mx-auto w-full max-w-[640px] px-6 py-10'>
      <ScreenSpecRegistrar spec={SPEC} />

      <button
        type='button'
        onClick={() => router.push(`/proto/core/${locale}/my`)}
        className='mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-fg-muted hover:text-fg'
      >
        <ArrowLeft size={15} /> 마이페이지
      </button>

      <header data-anno='leave:1'>
        <h1 className='text-2xl font-bold tracking-tight'>회원 탈퇴</h1>
        <ul className='mt-3 flex flex-col gap-1.5 text-sm leading-relaxed text-fg-secondary'>
          <li>· 탈퇴는 즉시 처리되며 되돌릴 수 없습니다.</li>
          <li>· 같은 구글 계정으로 다시 가입할 수 있지만, 지난 기록은 돌아오지 않습니다.</li>
        </ul>
      </header>

      <section data-anno='leave:2' className='mt-7'>
        <label htmlFor='leave-reason' className='text-sm font-bold'>
          탈퇴 사유 <span className='font-medium text-fg-muted'>(선택)</span>
        </label>
        <select
          id='leave-reason'
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className='mt-2 h-11 w-full rounded-control border border-border bg-surface px-3 text-sm'
        >
          <option value=''>사유 선택</option>
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </section>

      {isNavigator && (
        <section
          data-anno='leave:3'
          className='mt-7 rounded-card border border-warning-400 bg-warning-50 px-5 py-4 text-sm'
        >
          <p className='flex items-center gap-2 font-bold text-warning-700'>
            <AlertTriangle size={16} /> 네비게이터로 맡은 스터디 {navigatorOf.length}개
          </p>
          <ul className='mt-2 flex flex-col gap-1 font-medium text-fg'>
            {navigatorOf.map((s) => (
              <li key={s.id}>· {s.title.ko}</li>
            ))}
          </ul>
          <p className='mt-2 leading-relaxed text-fg'>
            캡틴에게 탈퇴 사실을 꼭 공유해 주시길 바랍니다.
          </p>
          {confirming && (
            <div className='mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-warning-400/50 pt-4'>
              <p className='mr-auto text-sm font-bold text-fg'>그래도 탈퇴하시겠습니까?</p>
              <Button variant='secondary' onClick={() => setConfirming(false)}>
                탈퇴 취소
              </Button>
              <Button variant='destructive' loading={pending} onClick={leave}>
                탈퇴
              </Button>
            </div>
          )}
        </section>
      )}
      <div data-anno='leave:4' className='mt-7 flex flex-wrap items-center justify-end gap-3'>
        <Button variant='secondary' onClick={() => router.push(`/proto/core/${locale}/my`)}>
          취소
        </Button>
        <Button
          variant='destructive'
          loading={pending && !isNavigator}
          // 한 번 더 묻는 것은 맡은 스터디가 있는 사람뿐 — 남는 것이 자기 것이 아니라서다.
          onClick={() => (isNavigator ? setConfirming(true) : leave())}
        >
          탈퇴
        </Button>
      </div>

    </div>
  );
}
