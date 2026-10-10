'use client';

import { useState } from 'react';

import { TableCard } from '@console/components/ui';
import {
  TEMPLATE_CHANNEL_LABEL,
  TEMPLATE_EVENT_LABEL,
  templates,
  type NotificationTemplate,
} from '@console/lib/templates';
import { Button } from '@studyclub/ui';
import { ArrowLeft } from 'lucide-react';

/**
 * 알림 템플릿.
 *
 * **보기만 한다.** 고치는 길을 두지 않는다 — 편집 API 가 없고, 문구를 바꾸는 일은 마이그레이션으로
 * 한다. 있지도 않은 수단을 화면에 두면 운영자가 눌러 보고 되묻는다.
 */
export function TemplatesTable() {
  const [open, setOpen] = useState<NotificationTemplate | null>(null);

  if (open) {
    return (
      <div className='flex flex-col gap-3'>
        <button
          type='button'
          onClick={() => setOpen(null)}
          className='inline-flex w-fit items-center gap-1.5 text-sm font-medium text-fg-secondary hover:text-fg'
        >
          <ArrowLeft size={15} /> 알림 템플릿
        </button>

        <div data-anno='template:3' className='card'>
          <Row label='이벤트'>{TEMPLATE_EVENT_LABEL[open.eventType] ?? open.eventType}</Row>
          <Row label='채널'>{TEMPLATE_CHANNEL_LABEL[open.channel] ?? open.channel}</Row>
          <Row label='제목'>{open.subject}</Row>
          <Row label='본문'>
            {/* 치환 변수({{nickname}})가 그대로 보여야 한다 — 미리 채워 보여주면 원문을 알 수 없다 */}
            <pre className='whitespace-pre-wrap break-words font-sans text-sm leading-relaxed'>{open.body}</pre>
          </Row>
          <Row label='마지막 수정'>{open.updatedAt ? stamp(open.updatedAt) : '수정된 적 없음'}</Row>
        </div>
      </div>
    );
  }

  return (
    <TableCard anno='template:2'>
      <thead>
        <tr>
          <th className='w-[180px] whitespace-nowrap'>이벤트</th>
          <th className='w-[100px] whitespace-nowrap'>채널</th>
          <th>제목</th>
          <th className='w-[180px] whitespace-nowrap'>마지막 수정</th>
        </tr>
      </thead>
      <tbody>
        {templates.map((t) => (
          <tr key={t.id}>
            <td className='whitespace-nowrap'>
              <Button variant='ghost' size='sm' className='-ml-2 font-semibold' onClick={() => setOpen(t)}>
                {TEMPLATE_EVENT_LABEL[t.eventType] ?? t.eventType}
              </Button>
            </td>
            <td className='whitespace-nowrap text-fg-secondary'>{TEMPLATE_CHANNEL_LABEL[t.channel] ?? t.channel}</td>
            <td className='truncate text-fg-secondary'>{t.subject}</td>
            <td className='tnum whitespace-nowrap text-fg-secondary'>
              {t.updatedAt ? stamp(t.updatedAt) : <span className='text-fg-muted'>수정된 적 없음</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </TableCard>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='border-b border-border px-5 py-4 last:border-b-0'>
      <div className='mb-1.5 text-xs font-semibold text-fg-muted'>{label}</div>
      <div className='text-sm'>{children}</div>
    </div>
  );
}

/** 보는 사람의 시간대로 그린다. 약칭은 적지 않는다 — 발송 이력과 같은 규칙. */
function stamp(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}
