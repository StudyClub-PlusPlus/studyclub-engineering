'use client';

import { useState } from 'react';

import { Card } from '@console/components/DashboardCharts';
import { TableCard } from '@console/components/ui';
import { TYPE_LABEL } from '@core/components/ApplicationFormUi';
import type { ApplicationQuestion, Crew, Study } from '@studyclub/mock';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * 신청 결과 탭 — 캡틴이 설계한 신청 폼 추가 질문에 지원자들이 남긴 답을 모아본다.
 *
 * 기본 질문(디스코드 서버 별명)은 모든 신청서에 항상 있어 「결과」로 모아볼 의미가 적다 —
 * 여기서는 캡틴이 직접 만든 추가 질문(`study.applicationForm`)의 답만 모은다.
 * 승인 대기 처리는 신청자 탭 소관이라 여기서는 버튼을 두지 않는다.
 *
 * TODO(api): GET /api/studies/{studyId}/cohorts/{cohortId}/applications
 */

type ViewMode = 'summary' | 'individual';

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'summary', label: '질문별 요약' },
  { value: 'individual', label: '응답자별' },
];

function isChoice(q: ApplicationQuestion) {
  return q.type === 'radio' || q.type === 'select' || q.type === 'checkbox';
}

function answerText(value: string | string[] | undefined): string {
  if (value === undefined) return '—';
  return Array.isArray(value) ? value.join(', ') : value;
}

export function ResultsTab({ study, crew }: { study: Study; crew: Crew[] }) {
  const [view, setView] = useState<ViewMode>('summary');
  const questions = study.applicationForm ?? [];
  const respondents = crew.filter((c) => c.status !== 'rejected' && c.answers);

  if (questions.length === 0) {
    return (
      <p
        data-anno='results:2'
        className='rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-fg-muted'
      >
        이 스터디는 신청 폼에 추가 질문이 없습니다. 「신청 폼」 탭에서 질문을 추가하면 여기서 답을 모아볼 수 있습니다.
      </p>
    );
  }

  return (
    <div className='flex flex-col gap-5'>
      <div data-anno='results:2' className='flex items-center justify-between gap-3'>
        <p className='text-sm text-fg-muted'>
          <span className='tnum font-bold text-fg'>{respondents.length}</span>명이 답했습니다.
        </p>
        <nav data-anno='results:2-1' className='inline-flex rounded-pill bg-surface-2 p-1'>
          {VIEW_OPTIONS.map((o) => {
            const on = view === o.value;
            return (
              <button
                key={o.value}
                type='button'
                onClick={() => setView(o.value)}
                className={`rounded-pill px-3 py-1.5 text-sm font-semibold transition-colors ${
                  on ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg'
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </nav>
      </div>

      {respondents.length === 0 ? (
        <p className='rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-fg-muted'>
          아직 들어온 신청이 없습니다.
        </p>
      ) : view === 'summary' ? (
        <div data-anno='results:3' className='flex flex-col gap-4'>
          {questions.map((q, qi) => (
            <QuestionSummary key={q.id} q={q} index={qi} respondents={respondents} />
          ))}
        </div>
      ) : (
        <div data-anno='results:4'>
          <TableCard>
            <thead>
              <tr>
                <th className='whitespace-nowrap'>디스코드 별명</th>
                <th>이메일</th>
                {questions.map((q) => (
                  <th key={q.id} className='min-w-[10rem]'>
                    {q.label || '(제목 없음)'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {respondents.map((c) => (
                <tr key={c.id}>
                  <td className='whitespace-nowrap font-semibold'>{c.discordNickname}</td>
                  <td className='whitespace-nowrap text-fg-secondary'>{c.email}</td>
                  {questions.map((q) => (
                    <td key={q.id} className='text-fg-secondary'>
                      {answerText(c.answers?.[q.id])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </TableCard>
        </div>
      )}
    </div>
  );
}

function QuestionSummary({
  q,
  index,
  respondents,
}: {
  q: ApplicationQuestion;
  index: number;
  respondents: Crew[];
}) {
  const answered = respondents.filter((c) => c.answers?.[q.id] !== undefined);
  return (
    <Card
      title={`${index + 1}. ${q.label || '(제목 없음)'}`}
      action={
        <span className='whitespace-nowrap text-xs font-medium text-fg-muted'>
          {TYPE_LABEL[q.type]} · {answered.length}명 응답
        </span>
      }
    >
      {isChoice(q) ? <ChoiceTally q={q} respondents={answered} /> : <TextAnswerList q={q} respondents={answered} />}
    </Card>
  );
}

/**
 * 객관식·체크박스·드롭다운 — 옵션별 응답 수를 가로 막대로.
 *
 * 막대만으로는 "몇 명"만 보이고 "누가"는 알 수 없다. 옵션을 누르면 그 옵션을 고른
 * 응답자 이름이 막대 아래 펼쳐진다 — 한 번에 다 펼쳐 두면 옵션이 많은 질문에서 화면이
 * 너무 길어지니 누른 옵션만 연다.
 */
function ChoiceTally({ q, respondents }: { q: ApplicationQuestion; respondents: Crew[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const options = q.options ?? [];
  const tallies = options.map((option) => ({
    option,
    picked: respondents.filter((c) => {
      const v = c.answers?.[q.id];
      return Array.isArray(v) ? v.includes(option) : v === option;
    }),
  }));
  const max = Math.max(1, ...tallies.map((t) => t.picked.length));

  function toggle(option: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(option)) next.delete(option);
      else next.add(option);
      return next;
    });
  }

  return (
    <ul className='flex flex-col gap-1'>
      {tallies.map(({ option, picked }) => {
        const open = expanded.has(option);
        return (
          <li key={option}>
            <button
              type='button'
              onClick={() => toggle(option)}
              disabled={picked.length === 0}
              aria-expanded={open}
              className='flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left transition-colors hover:enabled:bg-surface-2 disabled:cursor-default'
            >
              <span className='w-32 shrink-0 truncate text-[13px] font-medium text-fg-secondary' title={option}>
                {option}
              </span>
              <span className='h-2.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-surface-2'>
                <span
                  className='block h-full rounded-pill bg-brand'
                  style={{ width: `${(picked.length / max) * 100}%` }}
                />
              </span>
              <span className='tnum w-10 shrink-0 text-right text-[13px] font-bold text-fg'>{picked.length}명</span>
              <span className='w-3.5 shrink-0 text-fg-muted'>
                {picked.length > 0 && (open ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
              </span>
            </button>
            {open && picked.length > 0 && (
              <ol className='ml-[8.75rem] mb-2 flex list-decimal flex-col gap-1 pl-4 text-xs text-fg-secondary marker:text-fg-muted'>
                {picked.map((c) => (
                  <li key={c.id}>{c.discordNickname}</li>
                ))}
              </ol>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** 단답형·장문형 — 옵션이 없어 집계할 수 없다. 응답을 그대로 나열한다. */
function TextAnswerList({ q, respondents }: { q: ApplicationQuestion; respondents: Crew[] }) {
  if (respondents.length === 0) {
    return <p className='text-sm text-fg-muted'>아직 답이 없습니다.</p>;
  }
  return (
    <ol className='flex list-decimal flex-col gap-2 pl-5 marker:text-fg-muted'>
      {respondents.map((c) => (
        <li key={c.id} className='text-sm'>
          <span className='font-semibold text-fg'>{c.discordNickname}</span>
          <p className='mt-0.5 whitespace-pre-wrap text-fg-secondary'>{answerText(c.answers?.[q.id])}</p>
        </li>
      ))}
    </ol>
  );
}
