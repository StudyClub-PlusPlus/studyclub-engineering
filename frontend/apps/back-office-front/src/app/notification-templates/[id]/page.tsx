'use client';

// 알림 템플릿 상세. 목록과 같은 쿼리를 쓰므로 목록에서 들어오면 요청이 다시 나가지 않는다.
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';

import { PageHeader } from '@/components/ui';
import { useNotificationTemplate } from '@/features/notification-templates/queries';
import { CHANNEL_LABEL, EVENT_LABEL, fmtDateTime } from '@/features/notification-templates/types';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className='border-b border-[var(--color-border)] px-5 py-4 last:border-b-0'>
      <div className='mb-1.5 text-xs font-semibold text-[var(--color-fg-subtle)]'>{label}</div>
      <div className='text-sm'>{children}</div>
    </div>
  );
}

export default function NotificationTemplateDetail() {
  const params = useParams<{ id: string }>();
  const { data: template, error, isPending } = useNotificationTemplate(Number(params?.id));

  return (
    <div>
      <Link href='/notification-templates' className='mb-3 inline-block text-sm text-fg-muted hover:text-brand'>
        ← 알림 템플릿
      </Link>

      {error && (
        <div className='rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-red-600'>
          {error.message}
        </div>
      )}

      {isPending && (
        <div className='rounded-xl border border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-fg-subtle)]'>
          불러오는 중…
        </div>
      )}

      {!isPending && !error && !template && (
        <div className='rounded-xl border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-fg-subtle)]'>
          템플릿을 찾을 수 없습니다.
        </div>
      )}

      {template && (
        <>
          <PageHeader
            title={EVENT_LABEL[template.eventType] ?? template.eventType}
            subtitle={`${CHANNEL_LABEL[template.channel] ?? template.channel} · 마지막 수정 ${fmtDateTime(template.updatedAt)}`}
          />
          <div className='card'>
            <Field label='제목'>{template.subject}</Field>
            <Field label='본문'>
              {/* 치환 변수({{nickname}} 등)가 그대로 보여야 하므로 원문을 손대지 않는다. */}
              <pre className='whitespace-pre-wrap break-words font-sans text-sm leading-relaxed'>{template.body}</pre>
            </Field>
            <Field label='이벤트 코드'>
              <code className='rounded bg-[var(--color-surface-subtle)] px-1.5 py-0.5 text-xs'>
                {template.eventType}
              </code>
            </Field>
          </div>
        </>
      )}
    </div>
  );
}
