'use client';

import { useEffect, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import type { ApplicationQuestion, ApplicationQuestionType } from '@studyclub/mock';
import { Button, Checkbox, Input, Select, Textarea } from '@studyclub/ui';
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';

import {
  formCardClass,
  FormHeaderCard,
  MARKDOWN_HINT,
  OptionEditor,
  QuestionFillView,
} from './ApplicationFormUi';
import { allowsOther, needsOptions, QUESTION_TYPES, TYPE_LABEL } from './question';
import { applicationFormSchema, type ApplicationFormValues } from './schema';

const HEADER_ID = '__form-header__';
const DISCORD_QUESTION: ApplicationQuestion = {
  id: 'discord',
  label: '[스터디 클럽++] 디스코드 서버 별명',
  type: 'text',
  required: true,
  placeholder: '홍길동/SWE/산호세/시스템디자인',
};

export function ApplicationFormEditor({
  initialValues,
  title,
  summary,
  readOnly,
  saving,
  saved,
  message,
  onSave,
}: {
  initialValues: ApplicationFormValues;
  title: string;
  summary: string;
  readOnly: boolean;
  saving: boolean;
  saved: boolean;
  message?: string;
  onSave: (values: ApplicationFormValues) => Promise<void>;
}) {
  const {
    control,
    watch,
    setValue,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ApplicationFormValues>({
    defaultValues: initialValues,
    resolver: zodResolver(applicationFormSchema),
  });
  const { fields, append, remove, move } = useFieldArray({ control, name: 'questions', keyName: 'fieldKey' });
  const values = watch();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [focusOption, setFocusOption] = useState<{ id: string; index: number } | null>(null);
  const cards = useRef<Record<string, HTMLElement | null>>({});
  const disabled = readOnly || saving;

  useEffect(() => {
    if (!selectedId || saving) return;
    const close = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('button[type="submit"]')) return;
      if (!cards.current[selectedId]?.contains(event.target as Node)) setSelectedId(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [selectedId, saving]);

  function update(index: number, patch: Partial<ApplicationQuestion>) {
    const question = values.questions[index];
    setValue(`questions.${index}`, { ...question, ...patch }, { shouldDirty: true });
  }

  function reorder(from: number, to: number) {
    if (disabled || selectedId || to < 0 || to >= fields.length) return;
    move(from, to);
  }

  const submit = handleSubmit(
    async (data) => {
      if (disabled) return;
      await onSave(data);
      reset(data);
    },
    (issues) => {
      const index = values.questions.findIndex((_, i) => issues.questions?.[i]);
      const id = index >= 0 ? values.questions[index].id : HEADER_ID;
      setSelectedId(id);
      requestAnimationFrame(() => {
        cards.current[id]?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
        cards.current[id]?.querySelector<HTMLInputElement>('input')?.focus();
      });
    },
  );

  return (
    <form
      className='mx-auto flex w-full max-w-2xl flex-col gap-3'
      onSubmit={(event) => {
        void submit(event).catch(() => {});
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !saving) setSelectedId(null);
        if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault();
      }}
      noValidate
      aria-label='신청 폼 설계'
      aria-busy={saving}
    >
      <fieldset disabled={disabled} className='flex min-w-0 flex-col gap-3'>
        <FormHeaderCard
          cardRef={(element) => {
            cards.current[HEADER_ID] = element;
          }}
          editable={!disabled}
          selected={!disabled && selectedId === HEADER_ID}
          onSelect={() => setSelectedId(HEADER_ID)}
          title={selectedId === HEADER_ID ? values.title : values.title.trim() || title}
          summary={selectedId === HEADER_ID ? values.description : values.description || summary}
          onTitleChange={(value) => setValue('title', value, { shouldDirty: true })}
          onSummaryChange={(value) => setValue('description', value, { shouldDirty: true })}
          account={{ name: '홍길동', email: 'applicant@example.com' }}
        />
        {(errors.title || errors.description) && (
          <p role='alert' className='text-sm text-error-700'>
            {errors.title?.message ?? errors.description?.message}
          </p>
        )}
        <section className={formCardClass()}>
          <QuestionFillView q={DISCORD_QUESTION} disabled />
        </section>
        {!readOnly && (
          <div className='flex justify-end'>
            <Button
              type='button'
              size='sm'
              variant='secondary'
              leadingIcon={<Plus size={15} />}
              onClick={() => {
                const id = crypto.randomUUID();
                append({ id, label: '', type: 'text', required: true });
                setSelectedId(id);
              }}
            >
              질문 추가
            </Button>
          </div>
        )}
        {fields.map((field, index) => {
          const question = values.questions[index];
          const selected = !disabled && selectedId === question.id;
          const issue = errors.questions?.[index];
          return (
            <section
              key={field.fieldKey}
              ref={(element) => {
                cards.current[question.id] = element;
              }}
              aria-label={`질문 ${index + 1}`}
              className={`${formCardClass(selected)} ${dragId === question.id ? 'opacity-40' : ''}`}
              onClick={() => {
                if (!disabled) setSelectedId(question.id);
              }}
              draggable={!disabled && !selectedId}
              onDragStart={() => setDragId(question.id)}
              onDragOver={(event) => {
                if (!disabled && !selectedId) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const from = values.questions.findIndex((item) => item.id === dragId);
                if (from >= 0) reorder(from, index);
                setDragId(null);
              }}
              onDragEnd={() => setDragId(null)}
            >
              {selected ? (
                <div className='flex flex-col gap-3'>
                  <div className='grid gap-2 sm:grid-cols-[1fr_9rem]'>
                    <Input
                      autoFocus
                      aria-label='질문 제목'
                      placeholder={`질문 ${index + 1}`}
                      maxLength={200}
                      value={question.label}
                      error={issue?.label?.message}
                      onChange={(event) => update(index, { label: event.target.value })}
                    />
                    <Select
                      aria-label='질문 타입'
                      value={question.type}
                      onChange={(event) => {
                        const type = event.target.value as ApplicationQuestionType;
                        update(index, {
                          type,
                          options: needsOptions(type)
                            ? question.options?.length
                              ? question.options
                              : ['옵션 1']
                            : undefined,
                          allowOther: allowsOther(type) ? question.allowOther : undefined,
                          placeholder: needsOptions(type) ? undefined : question.placeholder,
                        });
                      }}
                    >
                      {QUESTION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {TYPE_LABEL[type]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Textarea
                    aria-label='질문 설명'
                    placeholder='설명 (선택)'
                    maxLength={5000}
                    rows={3}
                    helper={MARKDOWN_HINT}
                    value={question.description ?? ''}
                    onChange={(event) => update(index, { description: event.target.value })}
                  />
                  {needsOptions(question.type) ? (
                    <OptionEditor
                      type={question.type}
                      options={question.options ?? []}
                      allowOther={Boolean(question.allowOther)}
                      focusIndex={focusOption?.id === question.id ? focusOption.index : undefined}
                      onChange={(optionIndex, value) =>
                        update(index, {
                          options: question.options?.map((option, i) => (i === optionIndex ? value : option)),
                        })
                      }
                      onAdd={() => {
                        const options = [...(question.options ?? []), `옵션 ${(question.options?.length ?? 0) + 1}`];
                        update(index, { options });
                        setFocusOption({ id: question.id, index: options.length - 1 });
                      }}
                      onAddAfter={(optionIndex) => {
                        const options = [...(question.options ?? [])];
                        options.splice(optionIndex + 1, 0, `옵션 ${options.length + 1}`);
                        update(index, { options });
                        setFocusOption({ id: question.id, index: optionIndex + 1 });
                      }}
                      onRemove={(optionIndex) =>
                        update(index, { options: question.options?.filter((_, i) => i !== optionIndex) })
                      }
                      onToggleOther={(allowOther) => update(index, { allowOther })}
                    />
                  ) : (
                    <QuestionFillView q={question} ghost />
                  )}
                  {issue?.options && (
                    <p role='alert' className='text-sm text-error-700'>
                      {issue.options.message ?? issue.options.root?.message ?? '선택지를 하나 이상 넣어 주세요.'}
                    </p>
                  )}
                  <div className='flex items-center justify-between border-t border-border pt-3'>
                    <Checkbox
                      label='필수 응답'
                      checked={question.required}
                      onChange={(event) => update(index, { required: event.target.checked })}
                    />
                    <Button
                      type='button'
                      size='sm'
                      variant='ghost'
                      leadingIcon={<Trash2 size={13} />}
                      onClick={(event) => {
                        event.stopPropagation();
                        remove(index);
                        setSelectedId(null);
                      }}
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              ) : (
                <div className='flex items-start gap-2'>
                  {!readOnly && <GripVertical size={15} className='mt-1 shrink-0 text-fg-muted' aria-hidden />}
                  <div className='pointer-events-none min-w-0 flex-1'>
                    <QuestionFillView q={question} disabled />
                  </div>
                  {!readOnly && (
                    <div className='flex shrink-0 flex-col gap-1'>
                      <button
                        type='button'
                        aria-label={`질문 ${index + 1} 수정`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedId(question.id);
                        }}
                        className='p-1 text-fg-muted'
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type='button'
                        aria-label={`질문 ${index + 1} 위로`}
                        disabled={disabled || Boolean(selectedId) || index === 0}
                        onClick={(event) => {
                          event.stopPropagation();
                          reorder(index, index - 1);
                        }}
                        className='p-1 text-fg-muted disabled:opacity-30'
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type='button'
                        aria-label={`질문 ${index + 1} 아래로`}
                        disabled={disabled || Boolean(selectedId) || index === fields.length - 1}
                        onClick={(event) => {
                          event.stopPropagation();
                          reorder(index, index + 1);
                        }}
                        className='p-1 text-fg-muted disabled:opacity-30'
                      >
                        <ArrowDown size={15} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </fieldset>
      <div className='flex items-center gap-3 pt-1'>
        {message && (
          <p role='alert' className='text-sm text-error-700'>
            {message}
          </p>
        )}
        {saved && !isDirty && (
          <p role='status' className='text-sm font-medium text-success-700'>
            저장되었습니다.
          </p>
        )}
        {!readOnly && (
          <Button type='submit' className='ml-auto' loading={saving}>
            {message ? '다시 시도' : '저장'}
          </Button>
        )}
      </div>
    </form>
  );
}
