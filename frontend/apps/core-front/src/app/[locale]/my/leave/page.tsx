'use client';

// 회원 탈퇴 — 지면형(모달 아님) 화면. 안내 두 줄 · 사유 고르기 → (네비게이터로 맡은 진행 중인
// 스터디가 있으면 경고 + 재확인) → 탈퇴 → 즉시 처리 · 홈으로 (specs/user-leave/spec.md).
//
// 들어오는 길은 "내 정보 수정" 모달(ProfileDialog) 맨 아래 한 곳뿐이다.
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button, Select } from '@studyclub/ui';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

import { deleteAccount, getUser, type LeaveReason } from '@/lib/auth';
import type { Locale } from '@/lib/content';
import { clearMyLocalData, getActiveNavigatorStudies, type ActiveNavigatorStudy } from '@/lib/me';

const REASON_OPTIONS: { value: LeaveReason; label: string }[] = [
  { value: 'NO_DESIRED_STUDY', label: '원하는 스터디 없음' },
  { value: 'PARTICIPATION_BURDEN', label: '스터디 참여가 부담됨' },
  { value: 'OTHER', label: '기타' },
];

export default function LeavePage() {
  const params = useParams();
  const router = useRouter();
  const locale = ((params?.locale as string) ?? 'ko') as Locale;

  const [ready, setReady] = useState(false);
  const [navigatorStudies, setNavigatorStudies] = useState<ActiveNavigatorStudy[]>([]);
  const [reason, setReason] = useState<LeaveReason | ''>('');
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace(`/${locale}/login?next=/${locale}/my/leave`);
      return;
    }
    getActiveNavigatorStudies().then((studies) => {
      setNavigatorStudies(studies);
      setReady(true);
    });
  }, [locale, router]);

  const hasNavigatorWarning = navigatorStudies.length > 0;

  async function handleLeaveClick() {
    if (hasNavigatorWarning && !confirming) {
      // 첫 클릭 — 아직 지우지 않는다. 경고 상자 안에서 한 번 더 확인받는다.
      setConfirming(true);
      return;
    }
    setPending(true);
    setError(null);
    const result = await deleteAccount(reason || null);
    if (!result.ok) {
      setPending(false);
      setError(result.errorMessage);
      return;
    }
    // 세션(sc_user)은 deleteAccount 안의 logout() 이 지웠다 — 이 브라우저에 남은 회원별 데이터
    // (디스코드 핸들·관심·신청·출석 등)도 함께 지운다. 공용 기기에서 다음 사람에게 보이면 안 된다.
    clearMyLocalData();
    // router.replace(SPA 전환)는 안 쓴다 — NavAuth 등 레이아웃에 남아있는 컴포넌트가
    // 리마운트되지 않아 로그인 상태 표시가 (localStorage 는 실제로 지워졌는데도) 그대로
    // 남는다. 계정이 사라졌으니 앱을 완전히 새로 그리는 게 맞기도 하다.
    window.location.href = `/${locale}`;
  }

  if (!ready) {
    return <div className='px-6 py-16 text-center text-sm text-fg-secondary'>불러오는 중…</div>;
  }

  return (
    <div className='mx-auto w-full max-w-[640px] px-6 py-10'>
      <button
        type='button'
        onClick={() => router.push(`/${locale}/my`)}
        className='mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-fg-muted hover:text-fg'
      >
        <ArrowLeft size={15} /> 마이페이지
      </button>

      <header>
        <h1 className='text-2xl font-bold tracking-tight'>회원 탈퇴</h1>
        <p className='mt-2 text-sm leading-relaxed text-fg-secondary'>
          탈퇴는 즉시 처리되며 되돌릴 수 없습니다.
          <br />
          같은 구글 계정으로 다시 가입할 수 있지만, 지난 기록은 돌아오지 않습니다.
        </p>
      </header>

      <div className='mt-6'>
        <Select
          label='탈퇴 사유'
          helper='선택하지 않아도 탈퇴할 수 있습니다.'
          value={reason}
          onChange={(e) => setReason(e.target.value as LeaveReason | '')}
        >
          <option value=''>사유 선택</option>
          {REASON_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {hasNavigatorWarning && (
        <section className='mt-6 rounded-card border border-warning-300 bg-warning-50 px-5 py-4 text-sm'>
          <p className='flex items-center gap-2 font-bold text-fg'>
            <AlertTriangle size={16} className='shrink-0 text-warning-700' /> 맡고 있는 스터디가{' '}
            {navigatorStudies.length}개 있습니다
          </p>
          <ul className='mt-2 flex flex-col gap-1 text-fg'>
            {navigatorStudies.map((s) => (
              <li key={s.studyId}>· {s.title}</li>
            ))}
          </ul>
          <p className='mt-2 leading-relaxed text-fg'>캡틴에게 탈퇴 사실을 꼭 공유해 주시길 바랍니다.</p>

          {confirming && (
            <div className='mt-4 border-t border-warning-300 pt-4'>
              <p className='font-bold text-fg'>그래도 탈퇴하시겠습니까?</p>
              <div className='mt-3 flex justify-end gap-2'>
                <Button variant='secondary' size='sm' onClick={() => setConfirming(false)}>
                  탈퇴 취소
                </Button>
                <Button variant='destructive' size='sm' loading={pending} onClick={handleLeaveClick}>
                  탈퇴
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {error && <p className='mt-4 text-sm text-error-700'>{error}</p>}

      {!(hasNavigatorWarning && confirming) && (
        <div className='mt-7 flex flex-wrap items-center justify-end gap-x-3 gap-y-2'>
          <p className='mr-auto text-xs text-fg-muted'>탈퇴는 즉시 처리되며 되돌릴 수 없습니다.</p>
          <Button variant='secondary' onClick={() => router.push(`/${locale}/my`)}>
            취소
          </Button>
          <Button variant='destructive' loading={pending} onClick={handleLeaveClick}>
            탈퇴하기
          </Button>
        </div>
      )}
    </div>
  );
}
