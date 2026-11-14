'use client';

import type { EventQuestion } from '@studyclub/types';
import { Button, Checkbox, Input, Select } from '@studyclub/ui';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';

export function EventQuestionEditor({
  questions,
  onChange,
}: {
  questions: EventQuestion[];
  onChange: (questions: EventQuestion[]) => void;
}) {
  const update = (index: number, patch: Partial<EventQuestion>) =>
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  const move = (index: number, step: number) => {
    const next = [...questions];
    [next[index], next[index + step]] = [next[index + step]!, next[index]!];
    onChange(next);
  };
  const addOption = (questionIndex: number, focusIndex?: number) => {
    const question = questions[questionIndex]!;
    update(questionIndex, { options: [...question.options, ''] });
    if (focusIndex !== undefined)
      window.setTimeout(() => document.getElementById(`question-${question.id}-option-${focusIndex}`)?.focus(), 0);
  };
  return (
    <section data-anno='event-manage:4' className='space-y-4'>
      <div>
        <h2 className='type-title-md'>신청 질문</h2>
        <p className='mt-1 type-body-sm text-fg-muted'>
          변경한 질문은 이후 신청부터 적용됩니다.
        </p>
      </div>
      {questions.length === 0 && (
        <p className='rounded-card border border-dashed border-border p-5 type-body-sm text-fg-muted'>
          추가 질문 없이 기본 정보만으로 신청받습니다.
        </p>
      )}
      {questions.map((question, index) => (
        <fieldset key={question.id} className='space-y-3 rounded-card border border-border p-4'>
          <legend className='px-1 type-label-lg'>질문 {index + 1}</legend>
          <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]'>
            <Input
              label='질문 제목'
              required
              maxLength={200}
              value={question.label}
              onChange={(e) => update(index, { label: e.target.value })}
              placeholder='이번 행사에서 어떤 이야기를 나누고 싶나요?'
            />
            <Select
              label='답변 형식'
              value={['RADIO', 'CHECKBOX', 'SELECT'].includes(question.type) ? 'RADIO' : question.type}
              onChange={(e) =>
                update(index, {
                  type: e.target.value as EventQuestion['type'],
                  options: e.target.value === 'RADIO'
                    ? question.options.length
                      ? question.options
                      : ['선택지 1', '선택지 2']
                    : [],
                })
              }
            >
              <option value='TEXT'>단답형</option>
              <option value='TEXTAREA'>장문형</option>
              <option value='RADIO'>객관식</option>
            </Select>
          </div>
          {['RADIO', 'CHECKBOX', 'SELECT'].includes(question.type) && (
            <div className='space-y-3'>
              <div>
                <p className='type-label-lg text-ink'>선택지</p>
                <div className='mt-2 space-y-2'>
                  {question.options.map((option, optionIndex) => (
                    <div key={optionIndex} className='flex items-center gap-2'>
                      <span aria-hidden='true' className='w-5 shrink-0 text-center type-body-lg text-fg-muted'>
                        {question.type === 'CHECKBOX' ? '□' : '○'}
                      </span>
                      <div className='min-w-0 flex-1'>
                        <Input
                          id={`question-${question.id}-option-${optionIndex}`}
                          aria-label={`질문 ${index + 1} 선택지 ${optionIndex + 1}`}
                          value={option}
                          placeholder={`선택지 ${optionIndex + 1}`}
                          onChange={(e) =>
                            update(index, {
                              options: question.options.map((item, i) =>
                                i === optionIndex ? e.target.value : item,
                              ),
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            addOption(index, question.options.length);
                          }}
                        />
                      </div>
                      <Button
                        type='button'
                        variant='tertiary'
                        size='sm'
                        aria-label={`질문 ${index + 1} 선택지 ${optionIndex + 1} 삭제`}
                        disabled={question.options.length <= 2}
                        onClick={() =>
                          update(index, { options: question.options.filter((_, i) => i !== optionIndex) })
                        }
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type='button'
                  variant='tertiary'
                  size='sm'
                  className='mt-2'
                  leadingIcon={<Plus size={15} />}
                  onClick={() => addOption(index, question.options.length)}
                >
                  선택지 추가
                </Button>
              </div>
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
            <div className='ml-auto flex gap-1'>
              <Button
                type='button'
                variant='tertiary'
                size='sm'
                aria-label={`질문 ${index + 1} 위로`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
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
              <Button
                type='button'
                variant='tertiary'
                size='sm'
                aria-label={`질문 ${index + 1} 삭제`}
                onClick={() => onChange(questions.filter((_, i) => i !== index))}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        </fieldset>
      ))}
      <Button
        type='button'
        variant='secondary'
        size='sm'
        disabled={questions.length >= 10}
        leadingIcon={<Plus size={16} />}
        onClick={() =>
          onChange([...questions, { id: crypto.randomUUID(), label: '', type: 'TEXT', required: false, options: [] }])
        }
      >
        질문 추가
      </Button>
    </section>
  );
}
