'use client';

// 알림 템플릿 목록 — 백오피스 전용 API(`GET /api/admin/notification-templates`).
// 읽기 전용이다. 편집은 백엔드에 저장 API 가 생기면 붙인다.
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { TableCard, PageHeader } from '@/components/ui';
import { CHANNEL_LABEL, EVENT_LABEL, fmtDateTime, type NotificationTemplate } from '@/lib/notifications';

export default function NotificationTemplatesPage() {
  const [templates, setTemplates] = useState<NotificationTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/notification-templates', { cache: 'no-store' })
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.errorMessage ?? data?.message ?? `조회 실패 (${r.status})`);
        return data as NotificationTemplate[];
      })
      .then(setTemplates)
      .catch((e) => setError(e instanceof Error ? e.message : '템플릿 조회 중 오류'));
  }, []);

  return (
    <div>
      <PageHeader title='알림 템플릿' subtitle='가입·신청 등 이벤트마다 나가는 메일·디스코드 문구' />

      {error && (
        <div className='rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-red-600'>
          {error}
        </div>
      )}

      {!error && templates === null && (
        <div className='rounded-xl border border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-fg-subtle)]'>
          불러오는 중…
        </div>
      )}

      {!error && templates?.length === 0 && (
        <div className='rounded-xl border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-fg-subtle)]'>
          등록된 템플릿이 없습니다.
        </div>
      )}

      {templates && templates.length > 0 && (
        <TableCard>
          <thead>
            <tr>
              <th>이벤트</th>
              <th className='whitespace-nowrap'>채널</th>
              <th>제목</th>
              <th className='whitespace-nowrap'>마지막 수정</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td className='whitespace-nowrap'>
                  <Link
                    href={`/notification-templates/${t.id}`}
                    className='font-semibold underline-offset-4 hover:text-brand hover:underline'
                  >
                    {EVENT_LABEL[t.eventType] ?? t.eventType}
                  </Link>
                </td>
                <td className='whitespace-nowrap text-fg-secondary'>{CHANNEL_LABEL[t.channel] ?? t.channel}</td>
                <td className='max-w-0 truncate text-fg-secondary'>{t.subject}</td>
                <td className='tnum whitespace-nowrap text-xs text-fg-muted'>{fmtDateTime(t.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}
    </div>
  );
}
