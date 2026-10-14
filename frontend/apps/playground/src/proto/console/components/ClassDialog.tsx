'use client';

import { useEffect, useState } from 'react';

import { CLASS_TITLE_MAX, type StudyClass } from '@console/lib/classes';
import { EMPTY_RULE } from '@console/lib/schedule';
import { Button, Modal } from '@studyclub/ui';

/**
 * 반 만들기 · 수정 — 제목 하나만 받는다.
 *
 * 반을 나누는 일과 일정을 정하는 일은 따로 한다. 신청자를 보며 반을 나눌 때는 몇 시에 모일지 아직
 * 모를 수 있고, 일정은 회차·출석부와 함께 보는 일정 탭이 자리다. 그래서 여기서는 회차를 만들지 않는다.
 */
export function ClassDialog({
  open,
  edit,
  onClose,
  onSave,
}: {
  open: boolean;
  /** 있으면 그 반의 이름을 바꾼다. */
  edit?: StudyClass;
  onClose: () => void;
  onSave: (cls: StudyClass) => void;
}) {
  const [title, setTitle] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(edit?.title ?? '');
    setTouched(false);
  }, [open, edit]);

  const empty = title.trim() === '';

  function save() {
    setTouched(true);
    if (empty) return;
    onSave(edit ? { ...edit, title: title.trim() } : { id: `c${Date.now()}`, title: title.trim(), rule: EMPTY_RULE });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={edit ? '반 수정' : '반 만들기'}
      footer={
        /* 입력·설정 모달 — 취소 없이 X 로 닫는다 (POL-0008) */
        <Button onClick={save}>{edit ? '저장' : '만들기'}</Button>
      }
    >
      <form
        data-anno='class:1-4'
        className='flex flex-col gap-2 py-2'
        onSubmit={(ev) => {
          ev.preventDefault();
          save();
        }}
      >
        <label htmlFor='class-title' className='text-sm font-medium text-neutral-800'>
          반 제목
        </label>
        <input
          id='class-title'
          value={title}
          maxLength={CLASS_TITLE_MAX}
          placeholder='예: A반 · 미국 금요일반'
          aria-invalid={touched && empty}
          aria-describedby='class-title-help'
          onChange={(ev) => setTitle(ev.target.value)}
          className='h-10 rounded-control border border-border-strong bg-bg px-3 text-sm text-neutral-900 outline-none focus:border-brand focus:shadow-[var(--ring)]'
        />
        <p id='class-title-help' className='text-xs'>
          {touched && empty ? (
            <span role='alert' className='font-medium text-error-600'>
              반 제목을 입력해 주세요.
            </span>
          ) : edit ? (
            <span className='text-fg-muted'>일정은 그대로 둡니다.</span>
          ) : (
            <span className='text-fg-muted'>요일·시각·기간은 일정 탭에서 이 반에 정합니다. 그때 회차가 만들어집니다.</span>
          )}
        </p>
      </form>
    </Modal>
  );
}
