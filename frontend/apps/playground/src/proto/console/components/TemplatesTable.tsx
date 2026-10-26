'use client';

import { useState } from 'react';

import { NotificationTabs } from '@console/components/NotificationTabs';
import { TableCard } from '@console/components/ui';
import {
  TEMPLATE_CHANNEL_LABEL,
  TRIGGERS,
  TRIGGER_LABEL,
  type NotificationTemplate,
  type NotificationTrigger,
} from '@console/lib/templates';
import { Button, Input, Modal, Select, Tabs, Textarea } from '@studyclub/ui';
import { Plus } from 'lucide-react';

import { toPreviewDocument } from '@/proto/mail/render';

type Draft = { trigger: NotificationTrigger; subject: string; body: string };

const EMPTY: Draft = { trigger: 'USER_REGISTERED', subject: '', body: '' };

/**
 * 알림 템플릿.
 *
 * 문구를 보고, 더하고, 고치고, 지운다. 나가는 알림이 늘 때마다 코드를 고치지 않게 문구는 운영자가 다룬다.
 *
 * **추가 팝업이 곧 편집 팝업이다** — 행사 팝업과 같은 규칙. 목록에서 조건을 누르면 값이 채워진 채 열린다.
 * 같은 팝업에서 본문 원문을 편집하고, 미리보기 탭으로 아직 저장하지 않은 메일 모양을 확인한다.
 * 미리보기에서도 치환 변수는 원문 그대로 보여준다. 저장할 draft 의 HTML·줄바꿈도 그대로 둔다.
 * 삭제도 팝업 안에서 한다 — 목록 행에 삭제 버튼을 두면 스치듯 눌러 지우는 사고가 난다.
 *
 * TODO(api): POST /api/admin/notification-templates · PUT·DELETE /api/admin/notification-templates/{id}
 */
export function TemplatesTable({ initialTemplates }: { initialTemplates: NotificationTemplate[] }) {
  const [rows, setRows] = useState<NotificationTemplate[]>(initialTemplates);
  /** null = 닫힘, 'new' = 추가, 숫자 = 그 id 편집 */
  const [target, setTarget] = useState<'new' | number | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [bodyTab, setBodyTab] = useState('edit');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const editing = typeof target === 'number';
  const current = editing ? rows.find((r) => r.id === target) : undefined;
  const blocked = !draft.subject.trim() || !draft.body.trim();

  function openAdd() {
    setDraft(EMPTY);
    setBodyTab('edit');
    setConfirmDelete(false);
    setTarget('new');
  }

  function openEdit(t: NotificationTemplate) {
    setDraft({ trigger: t.trigger, subject: t.subject, body: t.body });
    setBodyTab('edit');
    setConfirmDelete(false);
    setTarget(t.id);
  }

  function close() {
    setTarget(null);
    setConfirmDelete(false);
  }

  function save() {
    if (blocked) return;
    // 등록·수정한 때가 곧 마지막 수정이다 — 비어 있는 경우를 만들지 않는다
    const now = new Date().toISOString();
    if (editing) {
      setRows((prev) => prev.map((r) => (r.id === target ? { ...r, ...draft, updatedAt: now } : r)));
    } else {
      setRows((prev) => [
        // 채널은 메일 하나뿐이라 고르게 하지 않는다 — 고를 것이 하나면 묻지 않는다
        { id: Math.max(0, ...prev.map((r) => r.id)) + 1, ...draft, channel: 'EMAIL', updatedAt: now },
        ...prev,
      ]);
    }
    close();
  }

  function remove() {
    // 되돌리기는 없다 — 확인 단계가 막는다. 지난 발송 이력은 지우지 않는다
    setRows((prev) => prev.filter((r) => r.id !== target));
    close();
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
                <Button variant='ghost' size='sm' className='-ml-2 font-semibold' onClick={() => openEdit(t)}>
                  {TRIGGER_LABEL[t.trigger] ?? t.trigger}
                </Button>
              </td>
              <td className='whitespace-nowrap text-fg-secondary'>{TEMPLATE_CHANNEL_LABEL[t.channel] ?? t.channel}</td>
              <td className='truncate text-fg-secondary'>{t.subject}</td>
              <td className='tnum whitespace-nowrap text-fg-secondary'>{stamp(t.updatedAt)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className='py-10 text-center text-sm text-fg-muted'>
                등록된 템플릿이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </TableCard>

      <Modal
        open={target !== null}
        onClose={close}
        title={editing ? '템플릿 수정' : '템플릿 추가'}
        size='lg'
        /* 닫는 수단은 X 하나다 — 취소 버튼을 따로 두지 않는다 (POL-0008) */
        footer={
          confirmDelete ? (
            <>
              {/* 결정을 묻는 단계 — 안전한 쪽이 기본 포커스 (POL-0008) */}
              <Button variant='secondary' autoFocus data-autofocus onClick={() => setConfirmDelete(false)}>
                취소
              </Button>
              <Button variant='destructive' onClick={remove}>
                삭제
              </Button>
            </>
          ) : (
            <>
              {/* 삭제는 저장 버튼과 멀리 떨어뜨린다 — 잘못 누르면 되돌릴 수 없다 */}
              {editing && (
                <button
                  type='button'
                  data-anno='template:2-2'
                  onClick={() => setConfirmDelete(true)}
                  className='mr-auto h-10 text-sm font-semibold text-error-600 underline-offset-4 hover:underline'
                >
                  템플릿 삭제
                </button>
              )}
              <Button onClick={save} disabled={blocked}>
                {editing ? '저장' : '추가'}
              </Button>
            </>
          )
        }
      >
        {confirmDelete && current ? (
          <div className='py-6 text-center'>
            <p className='text-sm font-semibold text-fg'>
              ‘{TRIGGER_LABEL[current.trigger] ?? current.trigger}’ 알림 템플릿을 삭제합니다.
            </p>
            <p className='mt-1 text-sm text-fg-secondary'>{current.subject}</p>
            <p className='mt-3 text-sm text-fg-muted'>
              이 문구로는 더 이상 메일이 나가지 않으며 되돌릴 수 없습니다. 지난 발송 이력은 남습니다.
            </p>
          </div>
        ) : (
          <div data-anno='template:2-1' className='flex flex-col gap-4'>
            {/* 알림은 이름이 아니라 이 조건으로 나간다 — 조건이 없으면 보낼 계기가 없다 */}
            <Select
              label='알림 조건'
              required
              value={draft.trigger}
              onChange={(e) => setDraft({ ...draft, trigger: e.target.value as NotificationTrigger })}
            >
              {TRIGGERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Input
              label='제목'
              required
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              placeholder='[StudyClub] 새 스터디 모집이 시작됐습니다'
            />
            <div data-anno='template:2-3'>
              <Tabs
                activeKey={bodyTab}
                onChange={setBodyTab}
                items={[
                  {
                    key: 'edit',
                    label: '본문 편집',
                    content: (
                      <div role='tabpanel' aria-label='본문 편집'>
                        <Textarea
                          label='본문'
                          required
                          rows={12}
                          value={draft.body}
                          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                          placeholder={'안녕하세요, {{nickname}}님.\n\n…'}
                          helper='{{nickname}} 으로 닉네임 삽입. HTML과 일반 텍스트를 입력할 수 있습니다.'
                        />
                      </div>
                    ),
                  },
                  {
                    key: 'preview',
                    label: '미리보기',
                    content: (
                      <div role='tabpanel' aria-label='미리보기' className='flex flex-col gap-3'>
                        <div className='rounded-card border border-border bg-surface-1 px-4 py-3'>
                          <span className='text-xs text-fg-muted'>메일 제목</span>
                          <p className='break-words text-sm font-semibold text-ink'>
                            {draft.subject.trim() ? draft.subject : '제목을 입력해 주세요.'}
                          </p>
                        </div>
                        {draft.body.trim() ? (
                          /* 기존 메일 시안과 같은 렌더러를 쓰고, 스크립트·폼·팝업은 허용하지 않는다. */
                          <iframe
                            title='메일 본문 미리보기'
                            sandbox=''
                            srcDoc={toPreviewDocument(draft.body)}
                            className='h-[28rem] w-full rounded-card border border-border bg-white'
                          />
                        ) : (
                          <div className='flex min-h-64 items-center justify-center rounded-card border border-border bg-surface-1 p-6 text-center text-sm text-fg-muted'>
                            본문을 입력하면 여기에 미리보기가 표시됩니다.
                          </div>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </div>
        )}
      </Modal>
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
