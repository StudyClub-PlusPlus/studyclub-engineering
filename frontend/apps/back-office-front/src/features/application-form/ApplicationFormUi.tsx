'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import type { ApplicationQuestion, ApplicationQuestionType } from '@studyclub/mock';
import { Checkbox, Input, Select, Textarea } from '@studyclub/ui';
import { Pencil, X } from 'lucide-react';

import { allowsOther } from './question';

const TEXT_ANSWER_MAX = 200;
const TEXTAREA_ANSWER_MAX = 2_000;
const OTHER_ANSWER_MAX = 100;

export function formCardClass(active?: boolean) {
  return active
    ? 'break-words rounded-xl border border-border border-l-4 border-l-brand bg-surface px-6 py-5 shadow-sm'
    : 'break-words rounded-xl border border-border bg-surface px-6 py-5';
}

const HEADER_CLASS: Record<number, string> = {
  1: 'text-lg font-bold',
  2: 'text-base font-bold',
  3: 'text-sm font-bold',
  4: 'text-sm font-semibold',
  5: 'text-sm font-semibold',
  6: 'text-xs font-semibold',
};

export const MARKDOWN_HINT =
  '마크다운을 쓸 수 있습니다: # 제목, **굵게**, *기울임*, ~~취소선~~, `코드`, [링크](url), 1. 순서 목록, - 목록';

function formatInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex =
    /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|~~([^~]+)~~|\*([^*]+)\*|_([^_]+)_/g;
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${i++}`;
    if (m[1] !== undefined) {
      if (/^https?:\/\//i.test(m[2])) {
        // eslint-disable-next-line @next/next/no-img-element
        nodes.push(<img key={key} src={m[2]} alt={m[1]} className='my-1 max-w-full rounded-control' />);
      } else {
        nodes.push(<span key={key}>{m[1]}</span>);
      }
    } else if (m[3] !== undefined) {
      nodes.push(
        <a
          key={key}
          href={/^https?:\/\//i.test(m[4]) ? m[4] : undefined}
          target='_blank'
          rel='noreferrer'
          className='text-brand underline underline-offset-2'
        >
          {m[3]}
        </a>,
      );
    } else if (m[5] !== undefined) {
      nodes.push(
        <code key={key} className='rounded-xs bg-surface-2 px-1 py-0.5 font-mono text-[0.85em]'>
          {m[5]}
        </code>,
      );
    } else if (m[6] !== undefined || m[7] !== undefined) {
      nodes.push(<strong key={key}>{m[6] ?? m[7]}</strong>);
    } else if (m[8] !== undefined) {
      nodes.push(<del key={key}>{m[8]}</del>);
    } else {
      nodes.push(<em key={key}>{m[9] ?? m[10]}</em>);
    }
    last = regex.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function MarkdownLite({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  let listBuffer: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let codeBuffer: string[] | null = null;

  const flushList = (key: string) => {
    if (!listBuffer.length || !listType) return;
    const Tag = listType;
    blocks.push(
      <Tag key={key} className={Tag === 'ul' ? 'list-disc space-y-0.5 pl-5' : 'list-decimal space-y-0.5 pl-5'}>
        {listBuffer.map((item, idx) => (
          <li key={idx}>{formatInline(item, `${key}-${idx}`)}</li>
        ))}
      </Tag>,
    );
    listBuffer = [];
    listType = null;
  };

  text.split('\n').forEach((line, idx) => {
    if (/^```/.test(line)) {
      if (codeBuffer === null) {
        flushList(`list-${idx}`);
        codeBuffer = [];
      } else {
        blocks.push(
          <pre key={`code-${idx}`} className='overflow-x-auto rounded-control bg-surface-2 px-3 py-2 text-xs'>
            <code className='font-mono'>{codeBuffer.join('\n')}</code>
          </pre>,
        );
        codeBuffer = null;
      }
      return;
    }
    if (codeBuffer !== null) {
      codeBuffer.push(line);
      return;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushList(`list-${idx}`);
      const level = heading[1].length;
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      blocks.push(
        <Tag key={`h-${idx}`} className={HEADER_CLASS[level]}>
          {formatInline(heading[2], `h-${idx}`)}
        </Tag>,
      );
      return;
    }

    const ordered = /^\d+\.\s+(.*)$/.exec(line);
    const bullet = /^[-*+]\s+(.*)$/.exec(line);
    if (ordered) {
      if (listType === 'ul') flushList(`list-${idx}`);
      listType = 'ol';
      listBuffer.push(ordered[1]);
      return;
    }
    if (bullet) {
      if (listType === 'ol') flushList(`list-${idx}`);
      listType = 'ul';
      listBuffer.push(bullet[1]);
      return;
    }

    flushList(`list-${idx}`);
    if (line.trim() === '') return;
    blocks.push(<p key={`p-${idx}`}>{formatInline(line, `p-${idx}`)}</p>);
  });
  if (codeBuffer !== null) {
    blocks.push(
      <pre key='code-end' className='overflow-x-auto'>
        <code>{(codeBuffer as string[]).join('\n')}</code>
      </pre>,
    );
  }
  flushList('list-end');
  return <div className={className}>{blocks}</div>;
}

export function FormHeaderCard({
  title,
  summary,
  account,
  editable,
  selected,
  onSelect,
  onTitleChange,
  onSummaryChange,
  cardRef,
}: {
  title: string;
  summary?: string;
  account?: { name: string; email: string };
  editable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onTitleChange?: (value: string) => void;
  onSummaryChange?: (value: string) => void;
  cardRef?: (el: HTMLElement | null) => void;
}) {
  const editing = Boolean(editable && selected);
  return (
    <section
      ref={cardRef}
      onClick={editable && !selected ? onSelect : undefined}
      className={`relative ${formCardClass(selected)} border-t-4 border-t-brand ${editable && !selected ? 'cursor-pointer' : ''}`}
    >
      {editable && !selected && (
        <button
          type='button'
          aria-label='설문지 제목·설명 수정'
          onClick={(ev) => {
            ev.stopPropagation();
            onSelect?.();
          }}
          className='absolute right-4 top-4 text-fg-muted transition-colors hover:text-fg'
        >
          <Pencil size={15} />
        </button>
      )}

      {editing ? (
        <div className='flex flex-col gap-3 pr-1'>
          <Input
            autoFocus
            aria-label='설문 제목'
            maxLength={200}
            value={title}
            onChange={(ev) => onTitleChange?.(ev.target.value)}
            onClick={(ev) => ev.stopPropagation()}
            placeholder='설문지 제목'
            className='font-semibold'
          />
          <Textarea
            aria-label='설문 설명'
            maxLength={5000}
            value={summary ?? ''}
            onChange={(ev) => onSummaryChange?.(ev.target.value)}
            onClick={(ev) => ev.stopPropagation()}
            placeholder='설문지 설명 (선택)'
            helper={MARKDOWN_HINT}
            rows={3}
          />
        </div>
      ) : (
        <>
          <h2 className='whitespace-pre-wrap break-words pr-6 text-xl font-bold tracking-tight text-fg'>{title}</h2>
          {summary && <MarkdownLite text={summary} className='mt-2 text-sm leading-relaxed text-fg-secondary' />}
        </>
      )}

      {account && (
        <p className='mt-4 text-sm text-fg'>
          <span className='font-medium'>{account.name}</span>
          <span className='text-fg-muted'> · {account.email}</span>
        </p>
      )}
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
            aria-label={`선택지 ${i + 1}`}
            maxLength={200}
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
            <button
              type='button'
              onClick={() => onToggleOther(true)}
              className='text-sm font-medium text-brand hover:underline'
            >
              「기타」 추가
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function QuestionLabel({ label, required, description }: { label: string; required?: boolean; description?: string }) {
  return (
    <div className='flex flex-col gap-0.5'>
      <p className='text-sm font-medium text-neutral-800'>
        {label}
        {required && (
          <span className='ml-0.5 text-error-600' aria-hidden='true'>
            *
          </span>
        )}
      </p>
      {description && <MarkdownLite text={description} className='text-xs leading-relaxed text-fg-muted' />}
    </div>
  );
}

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
      <div className='flex flex-col gap-1.5'>
        {!ghost && <QuestionLabel label={label} required={q.required} description={q.description} />}
        <Textarea
          required={!ghost && q.required}
          disabled={locked}
          rows={3}
          maxLength={TEXTAREA_ANSWER_MAX}
          value={ghost ? '' : value}
          onChange={ghost ? undefined : (ev) => onChange?.(ev.target.value)}
          placeholder={ghost ? '장문형 텍스트' : (q.placeholder ?? '내 답변')}
        />
      </div>
    );
  }

  if (q.type === 'select') {
    return (
      <div className='flex flex-col gap-1.5'>
        {!ghost && <QuestionLabel label={label} required={q.required} description={q.description} />}
        <Select
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
      </div>
    );
  }

  if (q.type === 'radio') {
    return (
      <div className='flex flex-col gap-1.5'>
        {!ghost && <QuestionLabel label={label} required={q.required} description={q.description} />}
        <div className='flex flex-col gap-2'>
          {fallback.map((o, i) => (
            <label
              key={`${o}-${i}`}
              className={`inline-flex items-center gap-2 ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
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
              <input
                type='radio'
                name={q.id}
                disabled={locked}
                className='h-4 w-4 shrink-0 border-border-strong accent-(--color-brand)'
              />
              <span className='text-sm text-neutral-800'>기타:</span>
              <input
                disabled={locked}
                maxLength={OTHER_ANSWER_MAX}
                className='h-8 min-w-0 flex-1 border-0 border-b border-border bg-transparent px-1 text-sm'
              />
            </label>
          )}
        </div>
      </div>
    );
  }

  if (q.type === 'checkbox') {
    return (
      <div className='flex flex-col gap-1.5'>
        {!ghost && <QuestionLabel label={label} required={q.required} description={q.description} />}
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
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-1.5'>
      {!ghost && <QuestionLabel label={label} required={q.required} description={q.description} />}
      <Input
        required={!ghost && q.required}
        disabled={locked}
        maxLength={TEXT_ANSWER_MAX}
        value={ghost ? '' : (value ?? '')}
        onChange={ghost ? undefined : (ev) => onChange?.(ev.target.value)}
        placeholder={ghost ? '단답형 텍스트' : (q.placeholder ?? '내 답변')}
      />
    </div>
  );
}
