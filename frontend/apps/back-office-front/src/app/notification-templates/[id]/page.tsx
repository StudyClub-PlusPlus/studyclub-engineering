'use client';

// 알림 템플릿 상세.
// 단건 조회 API 가 아직 없어 목록에서 id 로 골라 쓴다 — 템플릿은 이벤트당 한 건이라 목록이 짧다.
// 단건 API 가 생기면 이 fetch 만 바꾼다.
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/ui';
import { CHANNEL_LABEL, EVENT_LABEL, fmtDateTime, type NotificationTemplate } from '@/lib/notifications';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='border-b border-[var(--color-border)] px-5 py-4 last:border-b-0'>
      <div className='mb-1.5 text-xs font-semibold text-[var(--color-fg-subtle)]'>{label}</div>
      <div className='text-sm'>{children}</div>
    </div>
  );
}

export default function NotificationTemplateDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const [template, setTemplate] = useState<NotificationTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/notification-templates', { cache: 'no-store' })
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.errorMessage ?? data?.message ?? `조회 실패 (${r.status})`);
        return data as NotificationTemplate[];
      })
      .then((list) => {
        const found = list.find((t) => t.id === id);
        if (!found) throw new Error('템플릿을 찾을 수 없습니다.');
        setTemplate(found);
      })
      .catch((e) => setError(e instanceof Error ? e.message : '템플릿 조회 중 오류'));
  }, [id]);

  return (
    <div>
      <Link href='/notification-templates' className='mb-3 inline-block text-sm text-fg-muted hover:text-brand'>
        ← 알림 템플릿
      </Link>

      {error && (
        <div className='rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-red-600'>
          {error}
        </div>
      )}

      {!error && !template && (
        <div className='rounded-xl border border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-fg-subtle)]'>
          불러오는 중…
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
