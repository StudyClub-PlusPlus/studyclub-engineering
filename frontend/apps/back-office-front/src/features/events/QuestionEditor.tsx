'use client';

import { Button, Checkbox, Input, Select } from '@studyclub/ui';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';

import { hasChoices, newQuestion, type EventFormErrors, type QuestionDraft } from '@/features/events/form-schema';
import { EVENT_LIMITS, type QuestionType } from '@/features/events/types';

export function QuestionEditor({
  questions,
  readOnly,
  errors,
  onChange,
}: {
  questions: QuestionDraft[];
  readOnly: boolean;
  errors: EventFormErrors;
  onChange: (questions: QuestionDraft[]) => void;
}) {
  const update = (index: number, patch: Partial<QuestionDraft>) =>
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  const move = (index: number, step: number) => {
    const next = [...questions];
    [next[index], next[index + step]] = [next[index + step]!, next[index]!];
    onChange(next);
  };
  const addOption = (index: number) => {
    const question = questions[index]!;
    if (question.options.length >= EVENT_LIMITS.maxOptions) return;
    update(index, { options: [...question.options, ''] });
    window.setTimeout(() => document.getElementById(`question-${question.key}-option-${question.options.length}`)?.focus(), 0);
  };
  const changeType = (index: number, type: QuestionType) => {
    const question = questions[index]!;
    let options: string[] = [];
    if (hasChoices(type)) options = question.options.length ? question.options : ['', ''];
    update(index, { type, options });
  };

  return (
    <section className='flex flex-col gap-4' aria-labelledby='event-questions-title'>
      <div>
        <h2 id='event-questions-title' className='type-title-md'>
          신청 질문
        </h2>
        {!readOnly && <p className='mt-1 type-body-sm text-fg-muted'>변경한 질문은 이후 신청부터 적용됩니다.</p>}
      </div>
      {errors.questions && (
        <p role='alert' className='type-body-sm text-danger-fg'>
          {errors.questions}
        </p>
      )}
      {questions.length === 0 && (
        <p className='rounded-card border border-dashed border-border p-5 type-body-sm text-fg-muted'>
          {readOnly ? '추가 신청 질문이 없습니다.' : '추가 질문 없이 기본 정보만으로 신청받습니다.'}
        </p>
      )}
      {questions.map((question, index) => (
        <fieldset key={question.key} className='flex flex-col gap-3 rounded-card border border-border p-4'>
          <legend className='px-1 type-label-lg'>질문 {index + 1}</legend>
          <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]'>
            <Input
              label='질문 제목'
              required
              maxLength={EVENT_LIMITS.questionLabel}
              value={question.label}
              error={errors[`questions.${index}.label`]}
              onChange={(e) => update(index, { label: e.target.value })}
              placeholder='이번 행사에서 어떤 이야기를 나누고 싶나요?'
            />
            <Select
              label='답변 형식'
              value={hasChoices(question.type) ? 'RADIO' : question.type}
              onChange={(e) => changeType(index, e.target.value as QuestionType)}
            >
              <option value='TEXT'>단답형</option>
              <option value='TEXTAREA'>장문형</option>
              <option value='RADIO'>객관식</option>
            </Select>
          </div>
          {hasChoices(question.type) && (
            <div className='flex flex-col gap-2'>
              <p className='type-label-lg text-ink'>선택지</p>
              {question.options.map((option, optionIndex) => (
                <div key={optionIndex} className='flex items-center gap-2'>
                  <span aria-hidden='true' className='w-5 shrink-0 text-center type-body-lg text-fg-muted'>
                    {question.type === 'CHECKBOX' ? '□' : '○'}
                  </span>
                  <div className='min-w-0 flex-1'>
                    <Input
                      id={`question-${question.key}-option-${optionIndex}`}
                      aria-label={`질문 ${index + 1} 선택지 ${optionIndex + 1}`}
                      value={option}
                      maxLength={EVENT_LIMITS.optionLabel}
                      placeholder={`선택지 ${optionIndex + 1}`}
                      onChange={(e) =>
                        update(index, { options: question.options.map((o, i) => (i === optionIndex ? e.target.value : o)) })
                      }
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        addOption(index);
                      }}
                    />
                  </div>
                  {!readOnly && (
                    <Button
                      type='button'
                      variant='tertiary'
                      size='sm'
                      aria-label={`질문 ${index + 1} 선택지 ${optionIndex + 1} 삭제`}
                      disabled={question.options.length <= EVENT_LIMITS.minOptions}
                      onClick={() => update(index, { options: question.options.filter((_, i) => i !== optionIndex) })}
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              ))}
              {errors[`questions.${index}.options`] && (
                <p role='alert' className='type-body-sm text-danger-fg'>
                  {errors[`questions.${index}.options`]}
                </p>
              )}
              {!readOnly && (
                <Button
                  type='button'
                  variant='tertiary'
                  size='sm'
                  className='self-start'
                  leadingIcon={<Plus size={15} />}
                  disabled={question.options.length >= EVENT_LIMITS.maxOptions}
                  onClick={() => addOption(index)}
                >
                  선택지 추가
                </Button>
              )}
              <Checkbox
                label='복수 응답 허용'
                checked={question.type === 'CHECKBOX'}
                onChange={(e) => update(index, { type: e.target.checked ? 'CHECKBOX' : 'RADIO' })}
              />
            </div>
          )}
          <div className='flex flex-wrap items-center gap-2'>
            <Checkbox
              label='필수 답변'
              checked={question.required}
              onChange={(e) => update(index, { required: e.target.checked })}
            />
            {!readOnly && (
              <div className='ml-auto flex gap-1'>
                <Button type='button' variant='tertiary' size='sm' aria-label={`질문 ${index + 1} 위로`} disabled={index === 0} onClick={() => move(index, -1)}>
                  <ArrowUp size={16} />
                </Button>
                <Button
                  type='button'
                  variant='tertiary'
                  size='sm'
                  aria-label={`질문 ${index + 1} 아래로`}
                  disabled={index === questions.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown size={16} />
                </Button>
                <Button type='button' variant='tertiary' size='sm' aria-label={`질문 ${index + 1} 삭제`} onClick={() => onChange(questions.filter((_, i) => i !== index))}>
                  <Trash2 size={16} />
                </Button>
              </div>
            )}
          </div>
        </fieldset>
      ))}
      {!readOnly && (
        <Button
          type='button'
          variant='secondary'
          size='sm'
          className='self-start'
          disabled={questions.length >= EVENT_LIMITS.questions}
          leadingIcon={<Plus size={16} />}
          onClick={() => onChange([...questions, newQuestion()])}
        >
          질문 추가
        </Button>
      )}
    </section>
  );
}
