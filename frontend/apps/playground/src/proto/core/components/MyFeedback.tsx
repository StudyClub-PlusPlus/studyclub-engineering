'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { FeedbackDialog } from '@core/components/Feedback';
import { getUser } from '@core/lib/auth';
import type { Locale } from '@core/lib/content';
import { PAGE } from '@core/lib/layout';
import { IS_DEV, syncPreview } from '@core/lib/preview';
import { Badge, Button, Pagination } from '@studyclub/ui';
import { ChevronLeft, Plus } from 'lucide-react';

import {
  FEEDBACK_TYPE_LABEL,
  listMyFeedbacks,
  userStatusLabel,
  type Feedback,
  type FeedbackStatus,
  type FeedbackType,
} from '@/proto/lib/feedback';

/**
 * 내 문의 — 프로필 드롭다운 「문의·오류 신고」가 여는 곳(`/my/feedbacks`).
 *
 * 로그인한 본인 것만 보인다. [문의하기] 는 팝업을 연다. 상태는 둘 — 접수 · 답변 완료. 캡틴 전용 메모는 보이지 않는다.
 * 삭제는 두지 않는다.
 * TODO(api): GET /api/my/feedbacks · GET /api/my/feedbacks/{id} — 서버가 본인 것만 돌려준다
 */

const PAGE_SIZE = 20;
const TYPE_TONE: Record<FeedbackType, 'neutral' | 'recruiting' | 'error'> = {
  question: 'neutral',
  idea: 'recruiting',
  bug: 'error',
};

function UserStatus({ status }: { status: FeedbackStatus }) {
  const done = status === 'done';
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-pill px-2 py-0.5 text-xs font-semibold ${
        done ? 'bg-success-50 text-success-700' : 'bg-surface-2 text-fg-secondary'
      }`}
    >
      {userStatusLabel(status)}
    </span>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
/** 목록 접수일 — 「10.18」 */
const day = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
};
/** 상세 시각 — 「26.10.18 14:02」 */
const stamp = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getFullYear()).slice(2)}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** 로그인 확인 — 안 했으면 로그인으로 보낸다. 닉네임을 돌려준다 */
function useMe(locale: Locale, next: string): string | null | undefined {
  const router = useRouter();
  const [me, setMe] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    const u = IS_DEV ? syncPreview() : getUser();
    if (!u) {
      router.replace(`/proto/core/${locale}/login?next=${next}`);
      setMe(null);
      return;
    }
    setMe(u.nickname ?? u.email);
  }, [locale, next, router]);
  return me;
}

export function MyFeedbackList({ locale, discordUrl }: { locale: Locale; discordUrl: string }) {
  const router = useRouter();
  const base = `/proto/core/${locale}/my/feedbacks`;
  const me = useMe(locale, base);
  const [rows, setRows] = useState<Feedback[] | null>(null);
  const [page, setPage] = useState(1);
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    if (me) setRows(listMyFeedbacks(me));
  }, [me]);

  const pageCount = Math.max(1, Math.ceil((rows?.length ?? 0) / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = (rows ?? []).slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const writeButton = (
    <Button data-anno='my-feedback:1' size='sm' leadingIcon={<Plus size={15} />} onClick={() => setWriting(true)}>
      문의하기
    </Button>
  );

  return (
    <div className={`${PAGE} pb-16 pt-10`}>
      <div className='flex items-end justify-between gap-4'>
        <h1 className='text-2xl font-extrabold tracking-tight'>내 문의</h1>
        {writeButton}
      </div>

      <div data-anno='my-feedback:2' className='card mt-6 overflow-x-auto p-0'>
        <table className='w-full table-fixed text-sm'>
          <colgroup>
            <col className='w-[110px]' />
            <col className='min-w-[180px]' />
            <col className='w-[110px]' />
            <col className='w-[110px]' />
          </colgroup>
          <thead className='border-b border-border text-left text-xs font-semibold text-fg-muted'>
            <tr>
              <th className='px-5 py-3'>유형</th>
              <th className='px-5 py-3'>제목</th>
              <th className='px-5 py-3'>접수일</th>
              <th className='px-5 py-3'>상태</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-border'>
            {rows === null &&
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i}>
                  <td colSpan={4} className='px-5 py-4'>
                    <span className='block h-4 animate-pulse rounded bg-surface-2' />
                  </td>
                </tr>
              ))}
            {pageRows.map((f) => (
              <tr
                key={f.id}
                onClick={() => router.push(`${base}/${f.id}`)}
                className='cursor-pointer transition-colors hover:bg-surface-2'
              >
                <td className='px-5 py-4'>
                  <Badge tone={TYPE_TONE[f.type]}>{FEEDBACK_TYPE_LABEL[f.type]}</Badge>
                </td>
                <td className='truncate px-5 py-4 font-semibold' title={f.title}>
                  {f.title}
                </td>
                <td className='tnum px-5 py-4 text-fg-secondary'>{day(f.createdAt)}</td>
                <td className='px-5 py-4'>
                  <UserStatus status={f.status} />
                </td>
              </tr>
            ))}
            {rows !== null && rows.length === 0 && (
              <tr>
                <td colSpan={4} className='px-5 py-16 text-center text-fg-muted'>
                  <span className='inline-flex flex-col items-center gap-3'>
                    접수한 문의가 없습니다.
                    {writeButton}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination className='mt-4' page={current} total={pageCount} onChange={setPage} />

      <FeedbackDialog
        open={writing}
        onClose={() => setWriting(false)}
        onSent={() => {
          if (me) setRows(listMyFeedbacks(me));
          setPage(1);
        }}
        discordUrl={discordUrl}
      />
    </div>
  );
}

export function MyFeedbackDetail({ locale, id }: { locale: Locale; id: string }) {
  const base = `/proto/core/${locale}/my/feedbacks`;
  const me = useMe(locale, `${base}/${id}`);
  const [f, setF] = useState<Feedback | null | undefined>(undefined);

  useEffect(() => {
    // 본인 것만 — 남의 것이나 없는 id 는 찾을 수 없음
    if (me) setF(listMyFeedbacks(me).find((x) => x.id === id) ?? null);
  }, [me, id]);

  return (
    <div className={`${PAGE} pb-16 pt-10`}>
      <Link href={base} className='inline-flex items-center gap-1 text-sm font-medium text-fg-muted hover:text-fg'>
        <ChevronLeft size={15} /> 목록으로
      </Link>

      {f === undefined ? (
        <div className='mt-4 h-60 max-w-3xl animate-pulse rounded-card bg-surface-2' />
      ) : f === null ? (
        <p className='mt-16 text-center text-sm text-fg-muted'>찾을 수 없는 문의입니다.</p>
      ) : (
        <article data-anno='my-feedback:3' className='card mt-4 max-w-3xl divide-y divide-border overflow-hidden p-0'>
          <header className='px-6 py-5'>
            <div className='flex min-w-0 items-center gap-2'>
              <Badge tone={TYPE_TONE[f.type]}>{FEEDBACK_TYPE_LABEL[f.type]}</Badge>
              <h1 className='min-w-0 break-words text-lg font-bold tracking-tight'>{f.title}</h1>
            </div>
            <div className='mt-2 flex items-center justify-between gap-3'>
              <span className='tnum text-sm text-fg-muted'>{stamp(f.createdAt)}</span>
              <UserStatus status={f.status} />
            </div>
          </header>

          {/* 내가 쓴 내용 — 평문, 줄바꿈 그대로 */}
          <section className='px-6 py-5'>
            <p className='whitespace-pre-wrap break-words text-[15px] leading-relaxed [overflow-wrap:anywhere]'>{f.body}</p>
            {f.images && f.images.length > 0 && (
              <div className='mt-4 flex flex-wrap gap-2'>
                {f.images.map((src, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- 내가 붙인 이미지
                  <img key={i} src={src} alt={`첨부 이미지 ${i + 1}`} className='h-24 w-36 rounded-control border border-border object-cover' />
                ))}
              </div>
            )}
          </section>

          <section data-anno='my-feedback:4' className='bg-surface-2/50 px-6 py-5'>
            {f.reply ? (
              <>
                <div className='flex items-baseline justify-between gap-3'>
                  <h2 className='text-sm font-bold'>답변</h2>
                  <span className='tnum text-sm text-fg-muted'>{stamp(f.reply.at)}</span>
                </div>
                <p className='mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed [overflow-wrap:anywhere]'>
                  {f.reply.body}
                </p>
              </>
            ) : (
              <p className='text-sm text-fg-muted'>답변을 준비하고 있어요</p>
            )}
          </section>
        </article>
      )}
    </div>
  );
}
