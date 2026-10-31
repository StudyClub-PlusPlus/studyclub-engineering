'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button, Modal } from '@studyclub/ui';
import { ChevronLeft } from 'lucide-react';

import { LOAD_FAILED_MESSAGE, NOT_FOUND_MESSAGE, formatStamp, isNotFound, isOnboardingRequired } from './feedback';
import { FeedbackStatusBadge, FeedbackTypeBadge } from './FeedbackBadges';
import { useMyFeedback, type MyFeedbackDetail as Detail } from './queries';
import { useOnboardedAccount } from './useOnboardedAccount';
import type { Locale } from '@/lib/content';
import { PAGE, READ } from '@/lib/layout';

/**
 * 내 문의 상세 — 프로토 proto/core/components/MyFeedback.tsx 의 상세.
 *
 * 본인 것만 보인다. 남의 것 · 없는 번호는 서버가 404 로 가르지 않고 준다 → 「찾을 수 없는 문의입니다.」
 * 내용 · 답변은 평문이다. HTML 로 해석하지 않고(React 기본 출력) 줄바꿈만 살린다.
 * 제출 환경 · 캡틴 전용 메모는 응답에 없다.
 */
export function MyFeedbackDetail() {
  const params = useParams();
  const router = useRouter();
  const locale = ((params?.locale as string) ?? 'ko') as Locale;
  const rawId = String(params?.id ?? '');
  // 숫자가 아닌 번호는 서버에 묻지 않는다 — 없는 번호와 같다
  const id = /^\d+$/.test(rawId) ? Number(rawId) : null;
  const base = `/${locale}/my/feedbacks`;
  const accountId = useOnboardedAccount(locale, `${base}/${rawId}`);
  const { data, error, isPending, isError, isFetching, refetch } = useMyFeedback(accountId, id);

  useEffect(() => {
    if (isOnboardingRequired(error)) {
      router.replace(`/${locale}/onboarding?next=${encodeURIComponent(`${base}/${rawId}`)}`);
    }
  }, [error, locale, base, rawId, router]);

  let body: React.ReactNode;
  if (id === null || isNotFound(error)) {
    body = <p className='mt-16 text-center text-sm text-fg-muted'>{NOT_FOUND_MESSAGE}</p>;
  } else if (accountId === undefined || (isPending && !isError)) {
    body = <div className={`mt-4 h-60 animate-pulse rounded-card bg-surface-2 ${READ}`} />;
  } else if (isError || !data) {
    body = (
      <div className='mt-16 text-center'>
        <p className='text-sm text-fg-muted'>{LOAD_FAILED_MESSAGE}</p>
        <Button variant='secondary' size='sm' className='mt-4' loading={isFetching} onClick={() => void refetch()}>
          다시 시도
        </Button>
      </div>
    );
  } else {
    body = <FeedbackArticle feedback={data} />;
  }

  return (
    <div className={`${PAGE} pb-16 pt-10`}>
      <Link href={base} className='inline-flex items-center gap-1 text-sm font-medium text-fg-muted hover:text-fg'>
        <ChevronLeft size={15} /> 목록으로
      </Link>
      {body}
    </div>
  );
}

function FeedbackArticle({ feedback: f }: { feedback: Detail }) {
  // 누른 첨부 이미지를 크게 본다
  const [zoomed, setZoomed] = useState<number | null>(null);

  return (
    <>
      <article className={`card mt-4 divide-y divide-border overflow-hidden p-0 ${READ}`}>
        <header className='px-6 py-5'>
          <div className='flex min-w-0 items-center gap-2'>
            <FeedbackTypeBadge type={f.type} />
            <h1 className='min-w-0 break-words text-lg font-bold tracking-tight'>{f.title}</h1>
          </div>
          <div className='mt-2 flex items-center justify-between gap-3'>
            <time dateTime={f.createdAt} className='tnum text-sm text-fg-muted'>
              {formatStamp(f.createdAt)}
            </time>
            <FeedbackStatusBadge status={f.status} />
          </div>
        </header>

        {/* 내가 쓴 내용 — 평문, 줄바꿈 그대로 */}
        <section className='px-6 py-5'>
          <p className='whitespace-pre-wrap break-words text-base leading-relaxed [overflow-wrap:anywhere]'>
            {f.content}
          </p>
          {f.images.length > 0 && (
            <div className='mt-4 flex flex-wrap gap-2'>
              {f.images.map((img, i) => (
                <button
                  key={`${i}-${img.url}`}
                  type='button'
                  onClick={() => setZoomed(i)}
                  aria-label={`첨부 이미지 ${i + 1} 크게 보기`}
                  className='overflow-hidden rounded-control border border-border transition-opacity hover:opacity-90'
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- 내가 붙인 이미지, 외부(CDN) 주소 그대로 */}
                  <img src={img.url} alt={`첨부 이미지 ${i + 1}`} className='h-24 w-36 object-cover' />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className='bg-surface-2/50 px-6 py-5'>
          {f.reply ? (
            <>
              <div className='flex items-baseline justify-between gap-3'>
                <h2 className='text-sm font-bold'>답변</h2>
                <time dateTime={f.reply.repliedAt} className='tnum text-sm text-fg-muted'>
                  {formatStamp(f.reply.repliedAt)}
                </time>
              </div>
              <p className='mt-2 whitespace-pre-wrap break-words text-base leading-relaxed [overflow-wrap:anywhere]'>
                {f.reply.content}
              </p>
            </>
          ) : (
            <p className='text-sm text-fg-muted'>답변을 준비하고 있어요</p>
          )}
        </section>
      </article>

      <Modal
        open={zoomed !== null}
        onClose={() => setZoomed(null)}
        title={zoomed === null ? '' : `첨부 이미지 ${zoomed + 1}`}
        size='lg'
      >
        {zoomed !== null && f.images[zoomed] && (
          // eslint-disable-next-line @next/next/no-img-element -- 내가 붙인 이미지, 외부(CDN) 주소 그대로
          <img
            src={f.images[zoomed].url}
            alt={`첨부 이미지 ${zoomed + 1}`}
            className='mx-auto max-h-[70vh] w-auto max-w-full object-contain'
          />
        )}
      </Modal>
    </>
  );
}
