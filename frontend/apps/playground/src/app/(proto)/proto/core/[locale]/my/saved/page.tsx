'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { categoryGradient, categoryMeta } from '@core/components/StudyThumb';
import { getUser } from '@core/lib/auth';
import type { Locale } from '@core/lib/content';
import { t } from '@core/lib/i18n';
import { getBookmarks, setBookmarked } from '@core/lib/me';
import { studies as allStudies, type Study } from '@studyclub/mock';
import { Button, Card, EmptyState } from '@studyclub/ui';
import { Heart } from 'lucide-react';

/**
 * 찜한 스터디 — 내 스터디 탭 줄의 페이지 이동 목적지.
 * 참여 목록과 섞지 않는다.
 */
export default function SavedStudiesPage() {
  const params = useParams();
  const router = useRouter();
  const locale = ((params?.locale as string) ?? 'ko') as Locale;
  const [ready, setReady] = useState(false);
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    if (!getUser()) {
      router.replace(`/proto/core/${locale}/login?next=/proto/core/${locale}/my/saved`);
      return;
    }
    setIds(getBookmarks());
    setReady(true);
  }, [locale, router]);

  const saved = useMemo<Study[]>(() => {
    const byId = new Map(allStudies.map((s) => [s.id, s]));
    return ids.map((id) => byId.get(id)).filter((s): s is Study => Boolean(s)).reverse();
  }, [ids]);

  if (!ready) {
    return <div className='px-6 py-16 text-center text-sm text-fg-secondary'>불러오는 중…</div>;
  }

  return (
    <div className='mx-auto max-w-3xl px-6 pb-16 pt-10'>
      <div className='flex items-center justify-between gap-3'>
        <h1 className='text-2xl font-extrabold tracking-tight'>찜한 스터디</h1>
        <Button variant='secondary' size='sm' onClick={() => router.push(`/proto/core/${locale}/my/joined`)}>
          내 스터디
        </Button>
      </div>
      <p className='mt-1 text-sm text-fg-secondary'>하트로 담아 둔 스터디 {saved.length}개</p>

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
                      href={`/proto/core/${locale}/studies/${study.id}`}
                      className='block truncate font-bold underline-offset-4 hover:underline'
                    >
                      {t(study.title, locale)}
                    </Link>
                    <p className='mt-0.5 text-[13px] text-fg-muted'>{label}</p>
                  </div>
                  <button
                    type='button'
                    aria-label='찜한 스터디에서 빼기'
                    className='grid h-9 w-9 place-items-center rounded-full text-error-500 hover:bg-surface-2'
                    onClick={() => {
                      setBookmarked(study.id, false);
                      setIds(getBookmarks());
                    }}
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
