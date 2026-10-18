'use client';

import { useState } from 'react';

import { Card } from '@console/components/DashboardCharts';
import { TableCard } from '@console/components/ui';
import { TYPE_LABEL } from '@core/components/ApplicationFormUi';
import type { ApplicationQuestion, Crew, Study } from '@studyclub/mock';

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
  { value: 'summary', label: '질문별' },
  { value: 'individual', label: '응답자별' },
];

function isChoice(q: ApplicationQuestion) {
  return q.type === 'radio' || q.type === 'select' || q.type === 'checkbox';
}

function answerText(value: string | string[] | undefined): string {
  if (value === undefined) return '—';
  return Array.isArray(value) ? value.join(', ') : value;
}

/* ── 참여 가능한 요일 (기본 문항) — 프로토 더미 ─────────────────────────────
 * 신청 폼은 모든 신청서에 「참여 가능한 요일」을 받는다(`FORM_ANSWER.availableDays`). 그런데 콘솔 어디에도
 * 그 답을 보여 주는 자리가 없어서, 캡틴이 시간을 정할 근거를 볼 수 없다.
 * mock 크루에는 이 값이 없으므로 크루 id 로 고정된 더미를 만든다 — 새로고침해도 같다.
 * TODO(api): 신청 목록 응답의 availableDays
 */
const DAYS = [
  { key: 'mon', label: '월' },
  { key: 'tue', label: '화' },
  { key: 'wed', label: '수' },
  { key: 'thu', label: '목' },
  { key: 'fri', label: '금' },
  { key: 'sat', label: '토' },
  { key: 'sun', label: '일' },
] as const;

function seedOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** 크루마다 고정된 더미 요일 — 평일 저녁형·주말형이 섞이게 */
function dummyDays(c: Crew): string[] {
  const h = seedOf(c.id);
  // 8 중 몇의 확률로 그 요일이 되는지 — 한국은 주말·화목, 북미는 토·목이 많게
  const weights = c.region === 'NA' ? [2, 2, 1, 4, 1, 5, 3] : [2, 4, 2, 4, 1, 5, 6];
  const picked = DAYS.filter((_, i) => ((h >> i) & 7) < weights[i]).map((d) => d.key);
  return picked.length > 0 ? picked : [DAYS[h % 7].key];
}

const REGION_LABEL: Record<string, string> = { KR: '한국', NA: '북미', ETC: '기타' };

function daysText(days: string[]): string {
  return DAYS.filter((d) => days.includes(d.key))
    .map((d) => d.label)
    .join(' · ');
}

/** 요일별 몇 명이 되는지 — 지역(시간대)별로 나눠 쌓는다. 같은 「화」라도 서울과 북미는 다른 날 다른 시각이다 */
function AvailableDaysSummary({ crew }: { crew: Crew[] }) {
  const rows = DAYS.map((d) => {
    const who = crew.filter((c) => dummyDays(c).includes(d.key));
    return { ...d, kr: who.filter((c) => c.region !== 'NA').length, na: who.filter((c) => c.region === 'NA').length };
  });
  const max = Math.max(1, ...rows.map((r) => r.kr + r.na));
  const best = Math.max(...rows.map((r) => r.kr + r.na));
  return (
    <Card
      anno='results:5'
      title='참여 가능한 요일'
      action={
        <span className='whitespace-nowrap text-xs font-medium text-fg-muted'>
          기본 질문 · {crew.length}명 응답 · <span className='text-warning-700'>더미</span>
        </span>
      }
    >
      <ul className='flex flex-col gap-1'>
        {rows.map((r) => {
          const total = r.kr + r.na;
          return (
            <li key={r.key} className='flex items-center gap-3 px-1 py-1'>
              <span className={`w-8 shrink-0 text-sm ${total === best ? 'font-bold text-fg' : 'font-medium text-fg-secondary'}`}>
                {r.label}
              </span>
              <span className='flex h-2.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-surface-2'>
                <span className='block h-full bg-brand' style={{ width: `${(r.kr / max) * 100}%` }} />
                <span className='block h-full bg-warning-500' style={{ width: `${(r.na / max) * 100}%` }} />
              </span>
              <span className='tnum w-28 shrink-0 text-right text-sm text-fg-secondary'>
                <span className='font-bold text-fg'>{total}명</span> ({r.kr} · {r.na})
              </span>
            </li>
          );
        })}
      </ul>
      <p className='mt-3 flex items-center gap-3 text-xs text-fg-muted'>
        <span className='inline-flex items-center gap-1'>
          <span className='h-2 w-2 rounded-full bg-brand' /> 한국
        </span>
        <span className='inline-flex items-center gap-1'>
          <span className='h-2 w-2 rounded-full bg-warning-500' /> 북미
        </span>
        <span>· 요일만 받는다 — 몇 시에 되는지는 알 수 없다</span>
      </p>
    </Card>
  );
}

export function ResultsTab({ study, crew }: { study: Study; crew: Crew[] }) {
  const [view, setView] = useState<ViewMode>('summary');
  const questions = study.applicationForm ?? [];
  const respondents = crew.filter((c) => c.answers);

  if (questions.length === 0) {
    return (
      <div className='flex flex-col gap-4'>
        {crew.length > 0 && <AvailableDaysSummary crew={crew} />}
        <p
        data-anno='results:2'
        className='rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-fg-muted'
      >
        이 스터디는 신청 폼에 추가 질문이 없습니다. 「신청 폼」 탭에서 질문을 추가하면 여기서 답을 모아볼 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-5'>
      <div data-anno='results:2' className='flex items-center justify-between gap-3'>
        <p className='text-sm text-fg-muted'>
          응답자 <span className='tnum font-bold text-fg'>{respondents.length}</span>명
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
          <AvailableDaysSummary crew={respondents} />
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
                <th className='whitespace-nowrap'>지역</th>
                <th className='whitespace-nowrap'>참여 가능한 요일</th>
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
                  <td className='whitespace-nowrap text-fg-secondary'>{REGION_LABEL[c.region] ?? c.region}</td>
                  <td className='whitespace-nowrap text-fg-secondary'>{daysText(dummyDays(c))}</td>
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
 * 질문별 보기에서는 몇 명인지만 보여 주고, 누가 답했는지는 응답자별 표에서 본다.
 */
function ChoiceTally({ q, respondents }: { q: ApplicationQuestion; respondents: Crew[] }) {
  const options = q.options ?? [];
  const tallies = options.map((option) => ({
    option,
    count: respondents.filter((c) => {
      const v = c.answers?.[q.id];
      return Array.isArray(v) ? v.includes(option) : v === option;
    }).length,
  }));
  const max = Math.max(1, ...tallies.map((t) => t.count));

  return (
    <ul className='flex flex-col gap-1'>
      {tallies.map(({ option, count }) => (
        <li key={option} className='flex items-center gap-3 px-1 py-1'>
          <span className='w-32 shrink-0 truncate text-[13px] font-medium text-fg-secondary' title={option}>
            {option}
          </span>
          <span className='h-2.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-surface-2'>
            <span className='block h-full rounded-pill bg-brand' style={{ width: `${(count / max) * 100}%` }} />
          </span>
          <span className='tnum w-10 shrink-0 text-right text-[13px] font-bold text-fg'>{count}명</span>
        </li>
      ))}
    </ul>
  );
}

/** 단답형·장문형 — 옵션이 없어 집계할 수 없다. 답만 나열하고 누가 썼는지는 붙이지 않는다. */
function TextAnswerList({ q, respondents }: { q: ApplicationQuestion; respondents: Crew[] }) {
  if (respondents.length === 0) {
    return <p className='text-sm text-fg-muted'>아직 답이 없습니다.</p>;
  }
  return (
    <ol className='flex list-decimal flex-col gap-2 pl-5 marker:text-fg-muted'>
      {respondents.map((c) => (
        <li key={c.id} className='whitespace-pre-wrap text-sm text-fg-secondary'>
          {answerText(c.answers?.[q.id])}
        </li>
      ))}
    </ol>
  );
}
