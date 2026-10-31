'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import type { Locale, Study } from '@studyclub/types';
import { Button, Card, EmptyState, categoryGradient, categoryMeta } from '@studyclub/ui';
import { Heart } from 'lucide-react';

import { getUser } from '@/features/auth/auth';
import { getBookmarks, setBookmarked } from '@/features/bookmarks/storage';
import { useStudies } from '@/features/studies/queries';
import { track } from '@/lib/analytics';
import { t } from '@/lib/i18n';
import { PAGE } from '@/lib/layout';

/**
 * 찜한 스터디 — 프로필 드롭다운의 「찜한 스터디」 목적지. 참여 목록과 섞지 않는다.
 *
 * 찜 목록은 하트 버튼이 남긴 브라우저 값이다 — 북마크 추가·해제 API 가 아직 없다 (specs/study-bookmark).
 * 스터디 정보는 실제 목록 API(GET /api/studies)에서 찾는다. 목록에 없는 스터디(비공개 전환 등)는 보이지 않는다.
 */
export default function SavedStudiesPage() {
  const params = useParams();
  const router = useRouter();
  const locale = ((params?.locale as string) ?? 'ko') as Locale;
  const [ready, setReady] = useState(false);
  const [ids, setIds] = useState<string[]>([]);
  const { data: studies = [], isPending } = useStudies({});

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.replace(`/${locale}/login?next=/${locale}/my/saved`);
      return;
    }
    if (!user.onboardingCompletedAt) {
      router.replace(`/${locale}/onboarding?next=${encodeURIComponent(`/${locale}/my/saved`)}`);
      return;
    }
    setIds(getBookmarks());
    setReady(true);
  }, [locale, router]);

  // 최근에 담은 것이 위로
  const saved = useMemo<Study[]>(() => {
    const byId = new Map(studies.map((s) => [s.id, s]));
    return ids
      .map((id) => byId.get(id))
      .filter((s): s is Study => Boolean(s))
      .reverse();
  }, [ids, studies]);

  if (!ready || isPending) {
    return <div className='px-6 py-16 text-center type-body-sm text-fg-secondary'>불러오는 중…</div>;
  }

  function unsave(studyId: string) {
    track({ name: 'Study Unbookmarked', props: { study_id: studyId, source: 'saved_page' } });
    setBookmarked(studyId, false);
    setIds(getBookmarks());
  }

  return (
    <div className={`${PAGE} pb-16 pt-10`}>
      <div className='flex items-center justify-between gap-3'>
        <h1 className='type-headline-lg'>찜한 스터디</h1>
        <Button variant='secondary' size='sm' onClick={() => router.push(`/${locale}/my/joined`)}>
          내 스터디룸
        </Button>
      </div>
      <p className='mt-1 type-body-sm text-fg-secondary'>하트로 담아 둔 스터디 {saved.length}개</p>

      {saved.length === 0 ? (
        <div className='mt-8'>
          <EmptyState
            icon={<Heart size={28} />}
            title='찜한 스터디가 없습니다'
            description='스터디 카드의 하트를 누르면 여기에 모입니다.'
          />
        </div>
      ) : (
        <ul className='mt-6 flex flex-col gap-3'>
          {saved.map((study) => {
            const { icon: Icon, label } = categoryMeta(study.category);
            return (
              <li key={study.id}>
                <Card className='flex items-center gap-4'>
                  <span
                    className='grid h-11 w-11 shrink-0 place-items-center rounded-card text-white'
                    style={{ background: categoryGradient(study.category) }}
                    aria-hidden='true'
                  >
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <div className='min-w-0 flex-1'>
                    <Link
                      href={`/${locale}/studies/${study.id}`}
                      className='block truncate font-semibold underline-offset-4 hover:underline'
                    >
                      {t(study.title, locale)}
                    </Link>
                    <p className='mt-0.5 type-body-sm text-fg-muted'>{label}</p>
                  </div>
                  <button
                    type='button'
                    aria-label='찜한 스터디에서 빼기'
                    className='grid h-9 w-9 place-items-center rounded-full text-error-500 hover:bg-surface-2'
                    onClick={() => unsave(study.id)}
                  >
                    <Heart size={16} strokeWidth={2} className='fill-current' />
                  </button>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
