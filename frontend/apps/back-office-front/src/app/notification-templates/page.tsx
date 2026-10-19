'use client';

// 알림 템플릿 — 문구를 보고, 더하고, 고치고, 지운다. 추가·수정은 한 팝업(TemplateDialog)이다.
import { useMemo, useState } from 'react';

import { Button } from '@studyclub/ui';
import { Plus } from 'lucide-react';

import { PageHeader, TableCard } from '@/components/ui';
import { TemplateDialog } from '@/features/notification-templates/components/TemplateDialog';
import { useNotificationTemplates } from '@/features/notification-templates/queries';
import type { NotificationTemplate } from '@/features/notification-templates/types';
import { NotificationTabs } from '@/features/notifications/components/NotificationTabs';
import { channelLabel, eventLabel, formatStamp } from '@/features/notifications/labels';

export default function NotificationTemplatesPage() {
  const { data, error, isPending } = useNotificationTemplates();
  /** null = 닫힘, 'new' = 추가, 템플릿 = 그 템플릿 수정 */
  const [target, setTarget] = useState<'new' | NotificationTemplate | null>(null);

  // 새로 더한 것이 맨 위에 선다 — 서버가 준 순서에 기대지 않고 화면에서 id 내림차순으로 놓는다
  const templates = useMemo(() => (data ? [...data].sort((a, b) => b.id - a.id) : undefined), [data]);
  // 수정 중에 목록이 다시 읽혀도 팝업은 같은 템플릿을 가리키게 id 로 다시 찾는다
  const editing = typeof target === 'object' && target ? (data?.find((t) => t.id === target.id) ?? target) : undefined;

  return (
    <div>
      <PageHeader title='알림' subtitle='회원에게 어떤 메일이 나가는지 정하는 문구' />
      {/* 추가는 템플릿 탭에서만 할 수 있는 일이다 — 발송 이력으로 넘어가면 같이 사라진다 */}
      <NotificationTabs
        action={
          <Button size='sm' leadingIcon={<Plus size={14} />} onClick={() => setTarget('new')}>
            템플릿 추가
          </Button>
        }
      />

      {error && (
        <div className='rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 text-sm text-danger-fg'>
          {error.message}
        </div>
      )}

      {isPending && (
        <div className='rounded-xl border border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-fg-muted)]'>
          불러오는 중…
        </div>
      )}

      {templates?.length === 0 && (
        <div className='rounded-xl border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-fg-muted)]'>
          등록된 템플릿이 없습니다.
        </div>
      )}

      {templates && templates.length > 0 && (
        <TableCard>
          <thead>
            <tr>
              <th className='w-[180px] whitespace-nowrap'>알림 조건</th>
              <th className='w-[90px] whitespace-nowrap'>채널</th>
              <th>제목</th>
              <th className='w-[180px] whitespace-nowrap'>마지막 수정</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td className='whitespace-nowrap'>
                  <Button variant='ghost' size='sm' className='-ml-2 font-semibold' onClick={() => setTarget(t)}>
                    {eventLabel(t.eventType)}
                  </Button>
                </td>
                <td className='whitespace-nowrap text-fg-secondary'>{channelLabel(t.channel)}</td>
                <td className='max-w-0 truncate text-fg-secondary'>{t.subject}</td>
                <td className='tnum whitespace-nowrap text-fg-secondary'>
                  {t.updatedAt ? formatStamp(t.updatedAt) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      )}

      <TemplateDialog open={target !== null} onClose={() => setTarget(null)} template={editing} />
    </div>
  );
}
