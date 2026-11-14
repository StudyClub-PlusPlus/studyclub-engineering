'use client';

import type { EventQuestion } from '@studyclub/types';
import { Button, Checkbox, Input, Select, Textarea } from '@studyclub/ui';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';

export function EventQuestionEditor({
  questions,
  onChange,
  locked,
}: {
  questions: EventQuestion[];
  onChange: (questions: EventQuestion[]) => void;
  locked: boolean;
}) {
  const update = (index: number, patch: Partial<EventQuestion>) =>
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  const move = (index: number, step: number) => {
    const next = [...questions];
    [next[index], next[index + step]] = [next[index + step]!, next[index]!];
    onChange(next);
  };
  return (
    <section data-anno='event-manage:4' className='space-y-4'>
      <div>
        <h2 className='type-title-md'>신청 질문</h2>
        <p className='mt-1 type-body-sm text-fg-muted'>
          이름·이메일·참여 방식은 기본으로 받습니다. 추가로 궁금한 내용만 질문해 주세요.
        </p>
      </div>
      {locked && (
        <p className='rounded-control bg-warning-bg p-3 type-body-sm text-warning-fg'>
          공개된 행사 또는 신청 이력이 있는 행사의 질문은 수정할 수 없습니다.
        </p>
      )}
      {questions.length === 0 && (
        <p className='rounded-card border border-dashed border-border p-5 type-body-sm text-fg-muted'>
          추가 질문 없이 기본 정보만으로 신청받습니다.
        </p>
      )}
      {questions.map((question, index) => (
        <fieldset key={question.id} disabled={locked} className='space-y-3 rounded-card border border-border p-4'>
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
              value={question.type}
              onChange={(e) =>
                update(index, {
                  type: e.target.value as EventQuestion['type'],
                  options: ['RADIO', 'CHECKBOX', 'SELECT'].includes(e.target.value)
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
              <option value='CHECKBOX'>복수 선택</option>
              <option value='SELECT'>드롭다운</option>
            </Select>
          </div>
          {['RADIO', 'CHECKBOX', 'SELECT'].includes(question.type) && (
            <Textarea
              label='선택지'
              helper='한 줄에 하나씩, 2개 이상 입력해 주세요.'
              rows={3}
              value={question.options.join('\n')}
              onChange={(e) => update(index, { options: e.target.value.split('\n') })}
            />
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
                disabled={locked || index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={16} />
              </Button>
              <Button
                type='button'
                variant='tertiary'
                size='sm'
                aria-label={`질문 ${index + 1} 아래로`}
                disabled={locked || index === questions.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={16} />
              </Button>
              <Button
                type='button'
                variant='tertiary'
                size='sm'
                aria-label={`질문 ${index + 1} 삭제`}
                disabled={locked}
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
        disabled={locked || questions.length >= 10}
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
