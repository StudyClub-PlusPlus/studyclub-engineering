'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';


import { getUser, type SessionUser } from '@core/lib/auth';
import type { Locale } from '@core/lib/content';
import { getApplications } from '@core/lib/me';
import { studies as allStudies } from '@studyclub/mock';
import { Button } from '@studyclub/ui';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

import { SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

/**
 * 회원 탈퇴.
 *
 * **모달이 아니라 지면이다.** 읽고 판단할 것이 넷이라(빠지게 되는 스터디 · 인계 · 남는 기록 ·
 * 재가입) 팝업에 담으면 스크롤 안에 갇힌다.
 *
 * TODO(api): DELETE /api/me — 지금은 화면에서만 처리한다. 담당 스터디 여부도 서버가 판정해야 한다.
 */
export default function LeavePage() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const locale = ((params?.locale as string) ?? 'ko') as Locale;

  const [user, setUser] = useState<SessionUser | null>(null);
  const [pending, setPending] = useState(false);
  const [joinedIds, setJoinedIds] = useState<string[]>([]);

  // 담당 스터디는 운영 쪽 값이라 사용자 사이트 mock 에 없다. 검토용으로 주소에서 받는다.
  const navigatorOf = search.get('navigator') === '1' ? allStudies.slice(0, 1) : [];

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace(`/proto/core/${locale}/login?next=/proto/core/${locale}/my/leave`);
      return;
    }
    setUser(u);
    setJoinedIds(getApplications().filter((a) => a.status === 'accepted').map((a) => a.studyId));
  }, [locale, router]);

  const joined = useMemo(() => {
    const byId = new Map(allStudies.map((s) => [s.id, s]));
    return joinedIds.map((id) => byId.get(id)).filter((s): s is (typeof allStudies)[number] => Boolean(s));
  }, [joinedIds]);

  const blocked = navigatorOf.length > 0;

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
        <p className='mt-2 text-sm leading-relaxed text-fg-secondary'>
          탈퇴하면 계정과 참여 기록이 지워집니다. 되돌릴 수 없습니다.
        </p>
      </header>

      {blocked && (
        <section
          data-anno='leave:3'
          className='mt-6 rounded-card border border-warning-300 bg-warning-50 px-5 py-4 text-sm'
        >
          <p className='flex items-center gap-2 font-bold text-warning-800'>
            <AlertTriangle size={16} /> 맡은 스터디가 있어 탈퇴할 수 없습니다
          </p>
          <ul className='mt-2 flex flex-col gap-1 text-warning-800'>
            {navigatorOf.map((s) => (
              <li key={s.id}>· {s.title.ko}</li>
            ))}
          </ul>
          <p className='mt-2 leading-relaxed text-warning-800'>
            네비게이터가 사라지면 그 스터디가 멈춥니다. 캡틴에게 인계를 요청한 뒤 다시 시도해 주세요.
          </p>
        </section>
      )}

      <section data-anno='leave:2' className='mt-6'>
        <h2 className='text-sm font-bold'>지금 참여 중인 스터디 {joined.length}개</h2>
        {joined.length === 0 ? (
          <p className='mt-2 text-sm text-fg-muted'>참여 중인 스터디가 없습니다.</p>
        ) : (
          <>
            <p className='mt-1 text-sm text-fg-secondary'>탈퇴하면 아래 스터디에서 함께 빠집니다.</p>
            <ul className='mt-3 flex flex-col gap-1.5 text-sm text-fg-secondary'>
              {joined.slice(0, 5).map((s) => (
                <li key={s.id} className='truncate'>
                  · {s.title.ko}
                </li>
              ))}
              {joined.length > 5 && <li className='text-fg-muted'>· 외 {joined.length - 5}개</li>}
            </ul>
          </>
        )}
      </section>

      <section data-anno='leave:4' className='mt-7 rounded-card border border-border bg-surface-1 px-5 py-4'>
        <dl className='flex flex-col gap-3 text-sm'>
          <div>
            <dt className='font-bold'>지워지는 것</dt>
            <dd className='mt-1 leading-relaxed text-fg-secondary'>
              계정과 프로필(닉네임 · 이메일 · 시간대), 스터디 참여·관심 기록, 디스코드 연동 정보
            </dd>
          </div>
          <div>
            <dt className='font-bold'>남는 것</dt>
            <dd className='mt-1 leading-relaxed text-fg-secondary'>
              참여했던 회차의 출석 기록. 다른 참여자의 기록과 묶여 있어 빼면 그 회차의 출석률이 성립하지 않습니다.
              누구의 기록인지는 알 수 없게 처리합니다 (이용약관 제11조 3항)
            </dd>
          </div>
          <div>
            <dt className='font-bold'>다시 가입</dt>
            <dd className='mt-1 leading-relaxed text-fg-secondary'>
              같은 구글 계정으로 다시 가입할 수 있습니다. 지난 참여 기록은 돌아오지 않습니다
            </dd>
          </div>
        </dl>
      </section>


      <div data-anno='leave:5' className='mt-7 flex flex-wrap items-center justify-end gap-x-3 gap-y-2'>
        <p className='mr-auto text-xs text-fg-muted'>탈퇴는 즉시 처리되며 되돌릴 수 없습니다.</p>
        <Button variant='secondary' onClick={() => router.push(`/proto/core/${locale}/my`)}>
          취소
        </Button>
        <Button
          variant='destructive'
          disabled={blocked}
          loading={pending}
          onClick={() => {
            setPending(true);
            setTimeout(() => router.replace(`/proto/core/${locale}`), 800);
          }}
        >
          탈퇴하기
        </Button>
      </div>
    </div>
  );
}
