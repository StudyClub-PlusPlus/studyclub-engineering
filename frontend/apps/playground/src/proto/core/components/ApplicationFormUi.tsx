'use client';

import { useEffect, useRef } from 'react';

import type { ApplicationQuestion, ApplicationQuestionType } from '@studyclub/mock';
import { Checkbox, FieldShell, Input, Select, Textarea } from '@studyclub/ui';
import { X } from 'lucide-react';

export const QUESTION_TYPES: ApplicationQuestionType[] = ['text', 'textarea', 'radio', 'checkbox', 'select'];

export const TYPE_LABEL: Record<ApplicationQuestionType, string> = {
  text: '단답형',
  textarea: '장문형',
  radio: '객관식',
  checkbox: '체크박스',
  select: '드롭다운',
};

export function needsOptions(type: ApplicationQuestionType) {
  return type === 'radio' || type === 'checkbox' || type === 'select';
}

export function allowsOther(type: ApplicationQuestionType) {
  return type === 'radio' || type === 'checkbox';
}

export function seedOptions(existing?: string[]) {
  return existing?.length ? existing : ['옵션 1'];
}

export function formCardClass(active?: boolean) {
  return active
    ? 'rounded-xl border border-border border-l-4 border-l-brand bg-bg px-6 py-5 shadow-sm'
    : 'rounded-xl border border-border bg-bg px-6 py-5';
}

export function FormHeaderCard({
  title,
  summary,
  account,
}: {
  title: string;
  summary?: string;
  account: { name: string; email: string };
}) {
  return (
    <section className={`${formCardClass()} border-t-4 border-t-brand`}>
      <h2 className='text-xl font-bold tracking-tight text-fg'>{title}</h2>
      {summary && <p className='mt-2 text-sm leading-relaxed text-fg-secondary'>{summary}</p>}
      <p className='mt-4 text-sm text-fg'>
        <span className='font-medium'>{account.name}</span>
        <span className='text-fg-muted'> · {account.email}</span>
      </p>
    </section>
  );
}

export function OptionMarker({ type, index }: { type: ApplicationQuestionType; index?: number }) {
  if (type === 'select') {
    return <span className='w-5 shrink-0 text-center text-xs tabular-nums text-fg-muted'>{(index ?? 0) + 1}.</span>;
  }
  if (type === 'checkbox') {
    return <span className='h-4 w-4 shrink-0 rounded-xs border border-border-strong' aria-hidden />;
  }
  return <span className='h-4 w-4 shrink-0 rounded-full border border-border-strong' aria-hidden />;
}

export function OptionEditor({
  type,
  options,
  allowOther,
  focusIndex,
  onChange,
  onAdd,
  onAddAfter,
  onRemove,
  onToggleOther,
}: {
  type: ApplicationQuestionType;
  options: string[];
  allowOther: boolean;
  focusIndex?: number;
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onAddAfter: (index: number) => void;
  onRemove: (index: number) => void;
  onToggleOther: (on: boolean) => void;
}) {
  const showOther = allowsOther(type);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (focusIndex == null) return;
    inputRefs.current[focusIndex]?.focus();
  }, [focusIndex, options.length]);

  return (
    <div className='flex flex-col gap-1.5'>
      {options.map((opt, i) => (
        <div key={i} className='flex items-center gap-2'>
          <OptionMarker type={type} index={i} />
          <input
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            value={opt}
            onChange={(ev) => onChange(i, ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key !== 'Enter') return;
              ev.preventDefault();
              ev.stopPropagation();
              onAddAfter(i);
            }}
            placeholder={`옵션 ${i + 1}`}
            className='h-9 min-w-0 flex-1 border-0 border-b border-transparent bg-transparent px-1 text-sm text-neutral-900 placeholder:text-fg-placeholder transition-[border-color] hover:border-border focus:border-brand focus:outline-none'
          />
          <button
            type='button'
            aria-label={`${opt || `옵션 ${i + 1}`} 삭제`}
            onClick={() => onRemove(i)}
            disabled={options.length <= 1}
            className='text-fg-muted transition-colors hover:text-fg disabled:opacity-30'
          >
            <X size={15} />
          </button>
        </div>
      ))}

      {allowOther && showOther && (
        <div className='flex items-center gap-2'>
          <OptionMarker type={type} />
          <span className='h-9 flex-1 px-1 text-sm text-fg-muted'>기타…</span>
          <button
            type='button'
            aria-label='기타 삭제'
            onClick={() => onToggleOther(false)}
            className='text-fg-muted transition-colors hover:text-fg'
          >
            <X size={15} />
          </button>
        </div>
      )}

      <div className='flex items-center gap-2 pt-0.5'>
        <OptionMarker type={type} index={options.length} />
        <button type='button' onClick={onAdd} className='text-sm font-medium text-brand hover:underline'>
          옵션 추가
        </button>
        {showOther && !allowOther && (
          <>
            <span className='text-xs text-fg-muted'>또는</span>
            <button type='button' onClick={() => onToggleOther(true)} className='text-sm font-medium text-brand hover:underline'>
              「기타」 추가
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** 작성 화면과 같은 답변 UI. 편집 카드에서도 그대로 쓴다. */
export function QuestionFillView({
  q,
  ghost,
  disabled,
  value,
  values,
  onChange,
  onToggle,
}: {
  q: ApplicationQuestion;
  /** 편집 중 — 제목은 위에 두고 답변 칸만 보여 준다 */
  ghost?: boolean;
  disabled?: boolean;
  value?: string;
  values?: string[];
  onChange?: (value: string) => void;
  onToggle?: (option: string) => void;
}) {
  const label = q.label.trim() || '(질문을 입력하세요)';
  const options = (q.options ?? []).filter(Boolean);
  const fallback = options.length ? options : ghost ? ['옵션 1'] : ['(선택지를 입력하세요)'];
  const locked = Boolean(ghost || disabled);

  if (q.type === 'textarea') {
    return (
      <Textarea
        label={ghost ? undefined : label}
        required={!ghost && q.required}
        disabled={locked}
        rows={3}
        value={ghost ? '' : value}
        onChange={ghost ? undefined : (ev) => onChange?.(ev.target.value)}
        placeholder={ghost ? '장문형 텍스트' : (q.placeholder ?? '내 답변')}
      />
    );
  }

  if (q.type === 'select') {
    return (
      <Select
        label={ghost ? undefined : label}
        required={!ghost && q.required}
        disabled={locked}
        value={ghost ? '' : (value ?? '')}
        onChange={ghost ? undefined : (ev) => onChange?.(ev.target.value)}
      >
        <option value=''>선택하세요</option>
        {fallback.map((o, i) => (
          <option key={`${o}-${i}`} value={o}>
            {o}
          </option>
        ))}
      </Select>
    );
  }

  if (q.type === 'radio') {
    return (
      <FieldShell label={ghost ? undefined : label} required={!ghost && q.required}>
        <div className='flex flex-col gap-2'>
          {fallback.map((o, i) => (
            <label key={`${o}-${i}`} className={`inline-flex items-center gap-2 ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              <input
                type='radio'
                name={q.id}
                disabled={locked}
                checked={!ghost && value === o}
                onChange={() => onChange?.(o)}
                className='h-4 w-4 shrink-0 border-border-strong accent-(--color-brand)'
              />
              <span className='text-sm text-neutral-800'>{o}</span>
            </label>
          ))}
          {q.allowOther && (
            <label className={`inline-flex items-center gap-2 ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              <input type='radio' name={q.id} disabled={locked} className='h-4 w-4 shrink-0 border-border-strong accent-(--color-brand)' />
              <span className='text-sm text-neutral-800'>기타:</span>
              <input
                disabled={locked}
                className='h-8 min-w-0 flex-1 border-0 border-b border-border bg-transparent px-1 text-sm'
              />
            </label>
          )}
        </div>
      </FieldShell>
    );
  }

  if (q.type === 'checkbox') {
    return (
      <FieldShell label={ghost ? undefined : label} required={!ghost && q.required}>
        <div className='flex flex-col gap-2'>
          {fallback.map((o, i) => (
            <Checkbox
              key={`${o}-${i}`}
              label={o}
              disabled={locked}
              checked={!ghost && (values ?? []).includes(o)}
              onChange={() => onToggle?.(o)}
            />
          ))}
          {q.allowOther && <Checkbox label='기타' disabled={locked} />}
        </div>
      </FieldShell>
    );
  }

  return (
    <Input
      label={ghost ? undefined : label}
      required={!ghost && q.required}
      disabled={locked}
      value={ghost ? '' : (value ?? '')}
      onChange={ghost ? undefined : (ev) => onChange?.(ev.target.value)}
      placeholder={ghost ? '단답형 텍스트' : (q.placeholder ?? '내 답변')}
    />
  );
}
