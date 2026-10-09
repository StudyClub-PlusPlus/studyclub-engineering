'use client';

import type { ReactNode } from 'react';

import type { ApplicationQuestion } from '@studyclub/mock';
import { Checkbox, Input, Select, Textarea } from '@studyclub/ui';

import { OTHER_ANSWER_MAX, TEXT_ANSWER_MAX, TEXTAREA_ANSWER_MAX } from '@/lib/apply-validation';

export function formCardClass() {
  return 'rounded-xl border border-border bg-surface px-6 py-5';
}

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
      // eslint-disable-next-line @next/next/no-img-element
      nodes.push(<img key={key} src={m[2]} alt={m[1]} className='my-1 max-w-full rounded-control' />);
    } else if (m[3] !== undefined) {
      const href = m[4].trim();
      const isSafe = /^https?:\/\//i.test(href) || href.startsWith('/');
      if (isSafe) {
        nodes.push(
          <a key={key} href={href} target='_blank' rel='noreferrer noopener' className='text-brand underline underline-offset-2'>
            {m[3]}
          </a>,
        );
      } else {
        nodes.push(<span key={key}>{m[3]}</span>);
      }
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
  const HEADER_CLASS: Record<number, string> = {
    1: 'text-lg font-bold',
    2: 'text-base font-bold',
    3: 'text-sm font-bold',
    4: 'text-sm font-semibold',
    5: 'text-sm font-semibold',
    6: 'text-xs font-semibold',
  };
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
  flushList('list-end');
  return <div className={className}>{blocks}</div>;
}

export function FormHeaderCard({ title, summary }: { title: string; summary?: string }) {
  return (
    <section className={`relative ${formCardClass()} border-t-4 border-t-brand`}>
      <h2 className='text-xl font-bold tracking-tight text-fg'>{title}</h2>
      {summary && <MarkdownLite text={summary} className='mt-2 text-sm leading-relaxed text-fg-secondary' />}
    </section>
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
  value,
  values,
  otherChecked,
  otherValue,
  invalid,
  onChange,
  onToggle,
  onOtherToggle,
  onOtherChange,
}: {
  q: ApplicationQuestion;
  value?: string;
  values?: string[];
  otherChecked?: boolean;
  otherValue?: string;
  invalid?: boolean;
  onChange?: (value: string) => void;
  onToggle?: (option: string) => void;
  onOtherToggle?: (checked: boolean) => void;
  onOtherChange?: (value: string) => void;
}) {
  const label = q.label.trim() || '(질문을 입력하세요)';
  const options = (q.options ?? []).filter(Boolean);

  if (q.type === 'textarea') {
    return (
      <div className='flex flex-col gap-1.5'>
        <QuestionLabel label={label} required={q.required} description={q.description} />
        <Textarea
          required={q.required}
          aria-label={label}
          aria-invalid={invalid ? 'true' : undefined}
          rows={3}
          maxLength={TEXTAREA_ANSWER_MAX}
          value={value}
          onChange={(ev) => onChange?.(ev.target.value)}
          placeholder={q.placeholder ?? '내 답변'}
        />
      </div>
    );
  }

  if (q.type === 'select') {
    return (
      <div className='flex flex-col gap-1.5'>
        <QuestionLabel label={label} required={q.required} description={q.description} />
        <Select
          required={q.required}
          aria-label={label}
          aria-invalid={invalid ? 'true' : undefined}
          value={value ?? ''}
          onChange={(ev) => onChange?.(ev.target.value)}
        >
          <option value=''>선택하세요</option>
          {options.map((o, i) => (
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
        <QuestionLabel label={label} required={q.required} description={q.description} />
        <div className='flex flex-col gap-2'>
          {options.map((o, i) => (
            <label key={`${o}-${i}`} className='inline-flex cursor-pointer items-center gap-2'>
              <input
                type='radio'
                name={q.id}
                aria-invalid={invalid ? 'true' : undefined}
                checked={!otherChecked && value === o}
                onChange={() => {
                  onOtherToggle?.(false);
                  onChange?.(o);
                }}
                className='h-4 w-4 shrink-0 border-border-strong accent-(--color-brand)'
              />
              <span className='text-sm text-neutral-800'>{o}</span>
            </label>
          ))}
          {q.allowOther && (
            <div className='inline-flex items-center gap-2'>
              <label className='inline-flex cursor-pointer items-center gap-2'>
                <input
                  type='radio'
                  name={q.id}
                  aria-invalid={invalid ? 'true' : undefined}
                  checked={Boolean(otherChecked)}
                  onChange={() => {
                    onOtherToggle?.(true);
                  }}
                  className='h-4 w-4 shrink-0 border-border-strong accent-(--color-brand)'
                />
                <span className='text-sm text-neutral-800'>기타:</span>
              </label>
              <input
                maxLength={OTHER_ANSWER_MAX}
                value={otherValue ?? ''}
                aria-invalid={invalid && otherChecked ? 'true' : undefined}
                placeholder='내용을 입력해 주세요'
                onChange={(ev) => {
                  onOtherToggle?.(true);
                  onOtherChange?.(ev.target.value);
                }}
                className='h-8 min-w-0 flex-1 border-0 border-b border-border bg-transparent px-1 text-sm focus:border-brand focus:outline-none'
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (q.type === 'checkbox') {
    return (
      <div className='flex flex-col gap-1.5'>
        <QuestionLabel label={label} required={q.required} description={q.description} />
        <div className='flex flex-col gap-2'>
          {options.map((o, i) => (
            <Checkbox
              key={`${o}-${i}`}
              label={o}
              checked={(values ?? []).includes(o)}
              onChange={() => onToggle?.(o)}
            />
          ))}
          {q.allowOther && (
            <div className='flex items-center gap-2'>
              <Checkbox
                label='기타:'
                checked={Boolean(otherChecked)}
                onChange={(e) => onOtherToggle?.(e.target.checked)}
              />
              <input
                maxLength={OTHER_ANSWER_MAX}
                value={otherValue ?? ''}
                aria-invalid={invalid && otherChecked ? 'true' : undefined}
                placeholder='내용을 입력해 주세요'
                disabled={!otherChecked}
                onChange={(ev) => onOtherChange?.(ev.target.value)}
                className={`h-8 min-w-0 flex-1 border-0 border-b border-border bg-transparent px-1 text-sm focus:border-brand focus:outline-none ${!otherChecked ? 'cursor-not-allowed opacity-40' : ''}`}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-1.5'>
      <QuestionLabel label={label} required={q.required} description={q.description} />
      <Input
        required={q.required}
        aria-label={label}
        aria-invalid={invalid ? 'true' : undefined}
        maxLength={TEXT_ANSWER_MAX}
        value={value ?? ''}
        onChange={(ev) => onChange?.(ev.target.value)}
        placeholder={q.placeholder ?? '내 답변'}
      />
    </div>
  );
}
