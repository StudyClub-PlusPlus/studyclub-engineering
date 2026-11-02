'use client';

// 회원 탈퇴 — 사유(선택) → 역할별 진행 중인 스터디 안내 → 탈퇴.
// 네비게이터로 맡은 스터디가 있으면 한 번 더 확인한다 (specs/user-leave/spec.md).
//
// 들어오는 길은 "내 정보 수정" 모달(ProfileDialog) 맨 아래 한 곳뿐이다.
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import type { Locale } from '@studyclub/types';
import { Button, Select } from '@studyclub/ui';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';

import { clearMyLocalData } from '@/features/account/local-state';
import { getLeaveStudies, type LeaveStudiesResult, type LeaveStudy } from '@/features/account/repository';
import { leaveFormSchema, type LeaveFormValues } from '@/features/account/schema';
import { deleteAccount, getUser, type LeaveReason } from '@/features/auth/auth';

const UNKNOWN_WARNING_TITLE = '스터디 목록을 확인하지 못했습니다';
const UNKNOWN_WARNING_BODY =
  '참여 중이거나 맡고 있는 스터디가 있는지 확인하지 못했습니다. 확인되기 전에는 탈퇴할 수 없습니다. 다시 확인해 주시기 바랍니다.';

const REASON_OPTIONS: { value: LeaveReason; label: string }[] = [
  { value: 'NO_DESIRED_STUDY', label: '원하는 스터디 없음' },
  { value: 'PARTICIPATION_BURDEN', label: '스터디 참여가 부담됨' },
  { value: 'OTHER', label: '기타' },
];

function StudyLeaveNotice({
  id,
  title,
  studies,
  description,
  children,
}: {
  id: string;
  title: string;
  studies: LeaveStudy[];
  description: string;
  children?: ReactNode;
}) {
  if (studies.length === 0) return null;
  return (
    <section
      aria-labelledby={id}
      className='mt-7 rounded-card border border-warning-400 bg-warning-50 px-5 py-4 type-body-sm'
    >
      <h2 id={id} className='flex items-start gap-2 font-semibold text-warning-700'>
        <AlertTriangle size={16} className='mt-0.5 shrink-0' aria-hidden='true' />
        {title} {studies.length}개
      </h2>
      <ul className='mt-2 flex list-disc flex-col gap-1 pl-5 font-semibold text-fg'>
        {studies.map((study) => (
          <li key={study.studyId}>{study.title}</li>
        ))}
      </ul>
      <p className='mt-2 leading-relaxed text-fg'>{description}</p>
      {children}
    </section>
  );
}

export default function LeavePage() {
  const params = useParams();
  const router = useRouter();
  const locale = ((params?.locale as string) ?? 'ko') as Locale;

  const [studyCheck, setStudyCheck] = useState<LeaveStudiesResult | null>(null);
  // 빈 목록과 조회 실패를 구분하고, 재확인 중에도 탈퇴를 막는다.
  const [checking, setChecking] = useState(false);
  const { register, handleSubmit } = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: { reason: '' },
  });
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkStudies() {
    setChecking(true);
    setStudyCheck(await getLeaveStudies());
    setChecking(false);
  }

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace(`/${locale}/login?next=/${locale}/my/leave`);
      return;
    }
    let cancelled = false;
    getLeaveStudies().then((result) => {
      if (!cancelled) setStudyCheck(result);
    });
    return () => {
      cancelled = true;
    };
  }, [locale, router]);

  const crewStudies = studyCheck?.status === 'ok' ? studyCheck.crewStudies : [];
  const navigatorStudies = studyCheck?.status === 'ok' ? studyCheck.navigatorStudies : [];
  const hasNavigatorWarning = navigatorStudies.length > 0;
  // 확인 자체가 안 된 상태에서는 탈퇴를 아예 막는다 — "네트워크 오류로 확인 못 하고 그냥 탈퇴되는"
  // 경우를 만들지 않기 위해 재확인(다시 확인)만 제공하고 "그래도 탈퇴" 우회는 두지 않는다.
  const blockedByCheckFailure = studyCheck?.status === 'unknown' || checking;
  const requiresConfirmation = hasNavigatorWarning;

  async function handleLeaveClick({ reason }: LeaveFormValues) {
    if (blockedByCheckFailure) {
      return;
    }
    if (requiresConfirmation && !confirming) {
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

  if (!studyCheck) {
    return <div className='px-6 py-16 text-center type-body-sm text-fg-secondary'>불러오는 중…</div>;
  }

  return (
    <div className='mx-auto w-full max-w-[640px] px-6 py-10'>
      <button
        type='button'
        onClick={() => router.push(`/${locale}/my`)}
        className='mb-6 inline-flex items-center gap-1.5 type-label-lg text-fg-muted hover:text-fg'
      >
        <ArrowLeft size={15} /> 마이페이지
      </button>

      <header>
        <h1 className='type-headline-lg'>회원 탈퇴</h1>
        <ul className='mt-3 flex flex-col gap-1.5 type-body-sm text-fg-secondary'>
          <li>· 탈퇴는 즉시 처리되며 되돌릴 수 없습니다.</li>
          <li>· 같은 구글 계정으로 다시 가입할 수 있지만, 지난 기록은 돌아오지 않습니다.</li>
          <li>· 회원 탈퇴 시 홈페이지에 저장된 디스코드 연동 정보도 삭제됩니다.</li>
        </ul>
      </header>

      <div className='mt-6'>
        <Select label='탈퇴 사유' helper='선택하지 않아도 탈퇴할 수 있습니다.' {...register('reason')}>
          <option value=''>사유 선택</option>
          {REASON_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      <StudyLeaveNotice
        id='crew-study-guidance'
        title='크루로 참여 중인 스터디'
        studies={crewStudies}
        description='담당 네비게이터에게 탈퇴 사실을 알리고, 참여 중단을 요청해 주시기 바랍니다.'
      />
      <StudyLeaveNotice
        id='navigator-study-guidance'
        title='네비게이터로 맡은 스터디'
        studies={navigatorStudies}
        description='담당 캡틴에게 탈퇴 사실을 알리고, 스터디 인계 방법을 상의해 주시기 바랍니다.'
      >
        {confirming && (
          <div className='mt-4 border-t border-warning-400/50 pt-4'>
            <p className='font-semibold text-fg'>그래도 탈퇴하시겠습니까?</p>
            <div className='mt-3 flex justify-end gap-2'>
              <Button variant='secondary' size='sm' onClick={() => setConfirming(false)}>
                탈퇴 취소
              </Button>
              <Button variant='destructive' size='sm' loading={pending} onClick={handleSubmit(handleLeaveClick)}>
                탈퇴
              </Button>
            </div>
          </div>
        )}
      </StudyLeaveNotice>

      {blockedByCheckFailure && (
        <section
          aria-labelledby='study-check-warning'
          className='mt-7 rounded-card border border-warning-400 bg-warning-50 px-5 py-4 type-body-sm'
        >
          <h2 id='study-check-warning' className='flex items-start gap-2 font-semibold text-warning-700'>
            <AlertTriangle size={16} className='mt-0.5 shrink-0' aria-hidden='true' /> {UNKNOWN_WARNING_TITLE}
          </h2>
          <p className='mt-2 leading-relaxed text-fg'>{UNKNOWN_WARNING_BODY}</p>
          <div className='mt-3 flex justify-end'>
            <Button variant='secondary' size='sm' loading={checking} onClick={checkStudies}>
              다시 확인
            </Button>
          </div>
        </section>
      )}

      {error && <p className='mt-4 type-body-sm text-error-700'>{error}</p>}

      {!(requiresConfirmation && confirming) && (
        <div className='mt-7 flex flex-wrap items-center justify-end gap-x-3 gap-y-2'>
          <p className='mr-auto type-label-sm text-fg-muted'>
            {blockedByCheckFailure
              ? '스터디 목록 확인이 끝나야 탈퇴할 수 있습니다.'
              : '탈퇴는 즉시 처리되며 되돌릴 수 없습니다.'}
          </p>
          <Button variant='secondary' onClick={() => router.push(`/${locale}/my`)}>
            취소
          </Button>
          <Button
            variant='destructive'
            loading={pending}
            disabled={blockedByCheckFailure}
            onClick={handleSubmit(handleLeaveClick)}
          >
            탈퇴하기
          </Button>
        </div>
      )}
    </div>
  );
}
