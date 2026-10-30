'use client';

import { useState } from 'react';

import { NotificationTabs } from '@console/components/NotificationTabs';
import { TableCard } from '@console/components/ui';
import {
  TEMPLATE_CHANNEL_LABEL,
  TRIGGERS,
  TRIGGER_LABEL,
  templates as seeded,
  type NotificationTemplate,
  type NotificationTrigger,
} from '@console/lib/templates';
import { Button, Input, Modal, Select, Textarea } from '@studyclub/ui';
import { ArrowLeft, Plus } from 'lucide-react';

type Draft = { trigger: NotificationTrigger; subject: string; body: string };

const EMPTY: Draft = { trigger: 'USER_REGISTERED', subject: '', body: '' };

/**
 * 알림 템플릿.
 *
 * 등록한 문구를 보고, 새 알림의 문구를 더한다. **고치는 길은 아직 없다** — 편집 API 가 없다.
 * 나가는 알림이 늘어날 때마다 코드를 고치지 않게, 문구는 운영자가 더할 수 있어야 한다.
 */
export function TemplatesTable() {
  const [rows, setRows] = useState<NotificationTemplate[]>(seeded);
  const [open, setOpen] = useState<NotificationTemplate | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);

  // 조건 하나에 템플릿 하나다 — 같은 계기에 두 통을 보내지 않는다
  const taken = new Set(rows.map((r) => r.trigger));
  const free = TRIGGERS.filter((t) => !taken.has(t.value));
  const blocked = !draft.subject.trim() || !draft.body.trim() || taken.has(draft.trigger);

  function openAdd() {
    setDraft({ ...EMPTY, trigger: free[0]?.value ?? 'USER_REGISTERED' });
    setAdding(true);
  }

  function add() {
    if (blocked) return;
    // 등록한 날이 곧 마지막 수정일이다 — 비어 있는 경우를 만들지 않는다
    const now = new Date().toISOString();
    setRows((prev) => [
      // 채널은 메일 하나뿐이라 고르게 하지 않는다 — 고를 것이 하나면 묻지 않는다
      { id: Math.max(0, ...prev.map((r) => r.id)) + 1, ...draft, channel: 'EMAIL', updatedAt: now },
      ...prev,
    ]);
    setDraft(EMPTY);
    setAdding(false);
  }

  if (open) {
    return (
      <div className='flex flex-col gap-3'>
        <NotificationTabs />
        <button
          type='button'
          onClick={() => setOpen(null)}
          className='inline-flex w-fit items-center gap-1.5 type-label-lg text-fg-secondary hover:text-fg'
        >
          <ArrowLeft size={15} /> 알림 템플릿
        </button>

        <div data-anno='template:4' className='card'>
          <Row label='알림 조건'>{TRIGGER_LABEL[open.trigger] ?? open.trigger}</Row>
          <Row label='채널'>{TEMPLATE_CHANNEL_LABEL[open.channel] ?? open.channel}</Row>
          <Row label='제목'>{open.subject}</Row>
          <Row label='본문'>
            {/* 치환 변수({{nickname}})가 그대로 보여야 한다 — 미리 채워 보여주면 원문을 알 수 없다 */}
            <pre className='whitespace-pre-wrap break-words font-sans type-body-sm'>{open.body}</pre>
          </Row>
          <Row label='마지막 수정'>{stamp(open.updatedAt)}</Row>
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-3'>
      {/* 추가는 **템플릿 탭에서만** 할 수 있는 일이다 — 발송 이력으로 넘어가면 같이 사라진다 */}
      <NotificationTabs
        action={
          <Button data-anno='template:2' size='sm' leadingIcon={<Plus size={14} />} onClick={openAdd}>
            템플릿 추가
          </Button>
        }
      />

      <TableCard anno='template:3'>
        <thead>
          <tr>
            <th className='w-[180px] whitespace-nowrap'>알림 조건</th>
            <th className='w-[90px] whitespace-nowrap'>채널</th>
            <th>제목</th>
            <th className='w-[180px] whitespace-nowrap'>마지막 수정</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td className='whitespace-nowrap'>
                <Button variant='tertiary' size='sm' className='-ml-2' onClick={() => setOpen(t)}>
                  {TRIGGER_LABEL[t.trigger] ?? t.trigger}
                </Button>
              </td>
              <td className='whitespace-nowrap text-fg-secondary'>{TEMPLATE_CHANNEL_LABEL[t.channel] ?? t.channel}</td>
              <td className='truncate text-fg-secondary'>{t.subject}</td>
              <td className='tnum whitespace-nowrap text-fg-secondary'>{stamp(t.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </TableCard>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title='템플릿 추가'
        /* 닫는 수단은 X 하나다 — 취소 버튼을 따로 두지 않는다 (POL-0008) */
        footer={
          <div className='flex justify-end'>
            <Button onClick={add} disabled={blocked}>
              추가
            </Button>
          </div>
        }
      >
        <div data-anno='template:2-1' className='flex flex-col gap-4'>
          {/* 알림은 이름이 아니라 이 조건으로 나간다 — 조건이 없으면 보낼 계기가 없다 */}
          <Select
            label='알림 조건'
            required
            value={draft.trigger}
            onChange={(e) => setDraft({ ...draft, trigger: e.target.value as NotificationTrigger })}
          >
            {free.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          {free.length === 0 && (
            <p className='-mt-2 type-label-sm text-fg-muted'>조건마다 템플릿이 이미 하나씩 있습니다.</p>
          )}
          <Input
            label='제목'
            required
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
            placeholder='[StudyClub++] 새 스터디 모집이 시작됐습니다'
          />
          <Textarea
            label='본문'
            required
            rows={8}
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            placeholder={'안녕하세요, {{nickname}}님.\n\n…'}
            labelHint='{{nickname}} 으로 닉네임 삽입'
          />
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='border-b border-border px-5 py-4 last:border-b-0'>
      <div className='mb-1.5 type-label-sm text-fg-muted'>{label}</div>
      <div className='type-body-sm'>{children}</div>
    </div>
  );
}

/**
 * 보는 사람의 시간대로 그린다. 약칭은 적지 않는다 — 발송 이력과 같은 규칙.
 * **24시간제로 적는다** — 프로토의 다른 지면(회차·반·지역 시계·발송 이력)이 모두 그렇다.
 */
function stamp(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
