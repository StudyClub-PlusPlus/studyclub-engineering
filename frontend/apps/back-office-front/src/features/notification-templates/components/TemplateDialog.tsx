'use client';

import { useEffect, useState } from 'react';

import { Button, Input, Modal, Select, Tabs, Textarea } from '@studyclub/ui';

import { TemplatePreview } from '@/features/notification-templates/components/TemplatePreview';
import {
  useCreateNotificationTemplate,
  useDeleteNotificationTemplate,
  useInvalidateTemplates,
  useNotificationTemplateForEdit,
  useUpdateNotificationTemplate,
} from '@/features/notification-templates/queries';
import {
  TEMPLATE_CONDITIONS,
  type NotificationTemplate,
  type TemplateDraft,
} from '@/features/notification-templates/types';
import { eventLabel } from '@/features/notifications/labels';
import { ApiError } from '@/lib/http';

const EMPTY: TemplateDraft = { eventType: TEMPLATE_CONDITIONS[0].value, subject: '', body: '' };
const SAVE_FAILED = '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
const DELETE_FAILED = '삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.';
const GONE = '이미 삭제된 템플릿입니다. 목록을 새로 불러왔습니다.';

/**
 * 알림 템플릿 추가·수정 팝업.
 *
 * **추가 팝업이 곧 수정 팝업이다.** 목록에서 조건을 누르면 값이 채워진 채 열린다. 전문을 보는 화면을 따로 두지
 * 않는다 — 본문 편집·미리보기를 오가며 저장 전 내용을 확인한다. 치환 변수와 저장 원문은 그대로 둔다.
 * 삭제도 이 안에서 한다 — 목록 행에 삭제 버튼을 두면 스치듯 눌러 지우는 사고가 난다.
 */
export function TemplateDialog(props: { open: boolean; onClose: () => void; template?: NotificationTemplate }) {
  const fresh = useNotificationTemplateForEdit(props.template?.id);
  if (!props.template) return <TemplateEditor {...props} />;
  const loading = fresh.isPending || !fresh.isFetchedAfterMount;
  if (loading || fresh.isError || !fresh.data) {
    return (
      <Modal open={props.open} onClose={props.onClose} title='템플릿 수정' size='lg'>
        {loading ? (
          <p role='status'>최신 템플릿을 불러오는 중…</p>
        ) : (
          <div>
            <p role='alert'>{fresh.isError ? '템플릿을 불러오지 못했습니다.' : '이미 삭제된 템플릿입니다.'}</p>
            <Button variant='secondary' onClick={() => void fresh.refetch()}>
              다시 불러오기
            </Button>
          </div>
        )}
      </Modal>
    );
  }
  return <TemplateEditor {...props} template={fresh.data} />;
}

function TemplateEditor({
  open,
  onClose,
  template,
}: {
  open: boolean;
  onClose: () => void;
  /** 지정하면 수정, 없으면 추가. */
  template?: NotificationTemplate;
}) {
  const editing = Boolean(template);
  const [draft, setDraft] = useState<TemplateDraft>(EMPTY);
  const [bodyTab, setBodyTab] = useState('edit');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 서버에 이미 없는 템플릿 — 저장·삭제를 더 보내지 않는다. */
  const [gone, setGone] = useState(false);

  const create = useCreateNotificationTemplate();
  const update = useUpdateNotificationTemplate();
  const remove = useDeleteNotificationTemplate();
  const refresh = useInvalidateTemplates();
  const busy = create.isPending || update.isPending || remove.isPending;
  const blocked = !draft.subject.trim() || !draft.body.trim();

  useEffect(() => {
    if (!open) return;
    setDraft(template ? { eventType: template.eventType, subject: template.subject, body: template.body } : EMPTY);
    setBodyTab('edit');
    setConfirmDelete(false);
    setError(null);
    setGone(false);
    // 열릴 때 한 번만 채운다 — 목록이 다시 읽혀도 쓰던 값을 덮지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template?.id]);

  // 모르는 조건 코드(서버가 새 조건을 먼저 내보낸 경우)도 고른 채로 보이게 한다 — 빈칸으로 바뀌면 저장이 조건을 덮는다
  const conditions = TEMPLATE_CONDITIONS.some((c) => c.value === draft.eventType)
    ? TEMPLATE_CONDITIONS
    : [...TEMPLATE_CONDITIONS, { value: draft.eventType, label: eventLabel(draft.eventType) }];

  /**
   * 저장·삭제가 실패했을 때의 안내. 기존 템플릿의 404 는 다른 캡틴이 먼저 지운 것이라 목록을 다시 읽는다.
   * 추가의 404 는 지워질 대상이 없으니 그렇게 읽지 않는다.
   */
  function fail(err: unknown, fallback: string, existing: boolean): boolean {
    if (existing && err instanceof ApiError && err.status === 404) {
      setError(GONE);
      void refresh();
      return true;
    }
    // 4xx 는 서버가 이유를 말해 준다(입력 오류 등) — 다시 눌러도 같은 결과라 그 말을 그대로 보여 준다
    const reason = err instanceof ApiError && err.status >= 400 && err.status < 500 ? err.message : null;
    setError(reason || fallback);
    return false;
  }

  function save() {
    if (blocked || busy || gone) return;
    setError(null);
    const body: TemplateDraft = { ...draft, subject: draft.subject.trim() };
    const done = {
      onSuccess: onClose,
      // 이미 지워진 템플릿에는 다시 저장해도 같은 실패라, 저장을 막고 닫게 한다
      onError: (err: unknown) => setGone(fail(err, SAVE_FAILED, Boolean(template))),
    };
    if (template) update.mutate({ id: template.id, draft: body }, done);
    else create.mutate(body, done);
  }

  function destroy() {
    if (!template || busy) return;
    setError(null);
    remove.mutate(template.id, {
      onSuccess: onClose,
      onError: (err) => {
        // 지우려던 것이 이미 없으면 목적은 이뤄진 것이다 — 목록을 다시 읽고 닫는다
        if (fail(err, DELETE_FAILED, true)) onClose();
        else setConfirmDelete(false);
      },
    });
  }

  return (
    <Modal
      open={open}
      // 요청이 끝나기 전에는 닫지 않는다 — 늦게 온 응답이 다른 팝업을 닫거나 실패를 삼키는 일을 막는다
      onClose={() => {
        if (!busy) onClose();
      }}
      title={editing ? '템플릿 수정' : '템플릿 추가'}
      size='lg'
      /* 닫는 수단은 X 하나다 — 취소 버튼을 따로 두지 않는다 (POL-0008) */
      footer={
        confirmDelete ? (
          <>
            {/* 결정을 묻는 단계 — 안전한 쪽이 기본 포커스 (POL-0008) */}
            <Button
              variant='secondary'
              autoFocus
              data-autofocus
              onClick={() => setConfirmDelete(false)}
              disabled={busy}
            >
              취소
            </Button>
            <Button variant='destructive' onClick={destroy} loading={remove.isPending}>
              삭제
            </Button>
          </>
        ) : (
          <>
            {/* 삭제는 저장 버튼과 멀리 떨어뜨린다 — 잘못 누르면 되돌릴 수 없다 */}
            {editing && (
              <button
                type='button'
                onClick={() => setConfirmDelete(true)}
                disabled={busy || gone}
                className='mr-auto h-10 type-label-lg text-error-600 underline-offset-4 hover:underline disabled:opacity-50'
              >
                템플릿 삭제
              </button>
            )}
            <Button onClick={save} disabled={blocked || gone} loading={create.isPending || update.isPending}>
              {editing ? '저장' : '추가'}
            </Button>
          </>
        )
      }
    >
      {confirmDelete && template ? (
        <div className='py-6 text-center'>
          <p className='type-label-lg text-fg'>‘{eventLabel(template.eventType)}’ 알림 템플릿을 삭제합니다.</p>
          <p className='mt-1 type-body-sm text-fg-secondary'>{template.subject}</p>
          <p className='mt-3 type-body-sm text-fg-muted'>
            이 문구로는 더 이상 메일이 나가지 않으며 되돌릴 수 없습니다. 지난 발송 이력은 남습니다.
          </p>
        </div>
      ) : (
        <div className='flex flex-col gap-4'>
          {/* 알림은 이름이 아니라 이 조건으로 나간다 — 조건이 없으면 보낼 계기가 없다 */}
          <Select
            label='알림 조건'
            disabled={busy}
            required
            value={draft.eventType}
            onChange={(e) => setDraft({ ...draft, eventType: e.target.value })}
          >
            {conditions.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          <Input
            label='제목'
            disabled={busy}
            required
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
            placeholder='[StudyClub] 회원가입을 환영합니다'
          />
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
                      disabled={busy}
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
                  <div role='tabpanel' aria-label='미리보기'>
                    <TemplatePreview subject={draft.subject} body={draft.body} />
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}
      {error && (
        <p role='alert' className='mt-3 type-body-sm text-danger-fg'>
          {error}
        </p>
      )}
    </Modal>
  );
}
