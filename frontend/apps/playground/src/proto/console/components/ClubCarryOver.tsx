'use client';

import { useEffect, useState } from 'react';

import { SelectAll } from '@console/components/AttendanceTab';
import {
  clubRate,
  daysIn,
  isoDay,
  shortDate,
  type ClubBook,
  type ClubConfig,
  type ClubMember,
  type Month,
} from '@console/lib/clubs';
import { Badge, Button, Checkbox, SelectionCount, TableActionBar } from '@studyclub/ui';

/**
 * 이어서 참여 — 이번 달을 끝까지 마친 멤버는 다음 달에도 멤버로 남는다 (POL-0012). 다음 기수로 옮겨 적지 않는다.
 *
 * 달이 끝나는 시점(다음 달 1일 0시)에 그 달 결과를 확정한다. 그 전에 참여 중단된 사람은 이미 나갔다.
 * 캡틴은 「이번 달까지만 하겠다」고 알린 사람처럼 넘기지 않을 사람을 기수 시작 전까지 뺄 수 있다.
 * 뺀 사람은 이번 달이 끝나면 나간다. 다음 기수 모집에 신청하면 「계속」으로 돌아간다.
 * TODO(api): PUT /api/admin/studies/{nextStudyId}/carry-over — body: { excludedParticipantIds[] }
 */
export function ClubCarryOver({
  club,
  current,
  members,
  book,
  excluded,
  onSave,
  onDirtyChange,
}: {
  club: ClubConfig;
  current: Month;
  members: ClubMember[];
  book: ClubBook;
  /** 저장된 「뺀 사람」 */
  excluded: string[];
  onSave: (excluded: string[]) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const curEnd = isoDay(current, daysIn(current));
  const [draft, setDraft] = useState<Set<string>>(() => new Set(excluded));
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const dirty = draft.size !== excluded.length || excluded.some((id) => !draft.has(id));
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  const eligible = members.filter((m) => !m.leftOn);
  const carry = eligible.filter((m) => !draft.has(m.id));
  const out = eligible.filter((m) => draft.has(m.id));
  const left = members.filter((m) => m.leftOn);
  const selected = eligible.filter((m) => picked.has(m.id));

  function mark(exclude: boolean) {
    setDraft((prev) => {
      const n = new Set(prev);
      for (const m of selected) {
        if (exclude) n.add(m.id);
        else n.delete(m.id);
      }
      return n;
    });
    setPicked(new Set());
  }

  // 계속할 사람이 위, 뺀 사람, 중단한 사람 순
  const order = (m: ClubMember) => (m.leftOn ? 2 : draft.has(m.id) ? 1 : 0);
  const rows = [...members].sort((a, b) => order(a) - order(b));

  return (
    <section className='mt-8'>
      <div data-anno='carry:1' className='mb-3 flex flex-wrap items-end justify-between gap-3'>
        <div>
          <h2 className='type-title-md text-fg'>이어서 참여</h2>
          <p className='mt-0.5 type-body-sm text-fg-muted'>
            {shortDate(curEnd)}까지 참여한 사람은 다음 달에도 계속합니다.
          </p>
        </div>
        <p data-anno='carry:1-1' className='tnum type-label-lg text-fg'>
          계속할 사람 {carry.length}명
          <span className='text-fg-muted'>
            {' '}
            · 뺀 사람 {out.length}명 · 참여 중단 {left.length}명
          </span>
        </p>
      </div>

      <div className='card overflow-clip'>
        <TableActionBar
          position='top'
          data-anno='carry:3'
          className='top-[var(--table-action-bar-top,4rem)] bottom-auto border-b border-border bg-surface-raised px-4'
          selection={
            <>
              <SelectionCount count={selected.length} total={eligible.length} unit='명' />
              <Button
                data-anno='carry:3-1'
                size='sm'
                variant='secondary'
                disabled={selected.length === 0}
                onClick={() => mark(true)}
              >
                다음 달에서 빼기
              </Button>
              <Button
                data-anno='carry:3-2'
                size='sm'
                variant='tertiary'
                disabled={selected.every((m) => !draft.has(m.id))}
                onClick={() => mark(false)}
              >
                다시 넣기
              </Button>
            </>
          }
          save={
            <span data-anno='carry:3-3' className='flex items-center gap-2'>
              {dirty && (
                <Button variant='tertiary' size='sm' onClick={() => setDraft(new Set(excluded))} disabled={saving}>
                  변경 취소
                </Button>
              )}
              <Button
                size='sm'
                loading={saving}
                disabled={!dirty}
                onClick={async () => {
                  setSaving(true);
                  await onSave([...draft]);
                  setSaving(false);
                }}
              >
                저장
              </Button>
            </span>
          }
        />
        <table data-anno='carry:2' className='w-full border-separate border-spacing-0 type-body-sm'>
          <thead>
            <tr className='bg-surface-1 text-left type-label-sm text-fg-muted'>
              <th className='w-10 px-3 py-2'>
                <SelectAll
                  checked={eligible.length > 0 && selected.length === eligible.length}
                  partial={selected.length > 0 && selected.length < eligible.length}
                  onChange={() =>
                    setPicked(selected.length === eligible.length ? new Set() : new Set(eligible.map((m) => m.id)))
                  }
                />
              </th>
              <th data-anno='carry:2-1' className='px-2 py-2'>
                디스코드 별명
              </th>
              {club.rosterQuestion && (
                <th data-anno='carry:2-2' className='px-2 py-2'>
                  {club.rosterQuestion.label}
                </th>
              )}
              <th data-anno='carry:2-3' className='px-2 py-2 text-right'>
                이번 기수 출석률
              </th>
              <th data-anno='carry:2-4' className='px-2 py-2'>
                다음 달
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const rate = clubRate(book[m.id]);
              const isOut = draft.has(m.id);
              return (
                <tr key={m.id} className={m.leftOn ? 'text-fg-muted' : undefined}>
                  <td className='border-t border-border px-3 py-2'>
                    {!m.leftOn && (
                      <Checkbox
                        label={`${m.name} 선택`}
                        hideLabel
                        checked={picked.has(m.id)}
                        onChange={() =>
                          setPicked((p) => {
                            const n = new Set(p);
                            if (n.has(m.id)) n.delete(m.id);
                            else n.add(m.id);
                            return n;
                          })
                        }
                      />
                    )}
                  </td>
                  <td className='border-t border-border px-2 py-2 type-label-lg'>{m.name}</td>
                  {club.rosterQuestion && <td className='tnum border-t border-border px-2 py-2'>{m.extra}</td>}
                  <td className='tnum border-t border-border px-2 py-2 text-right'>
                    {rate === undefined ? '-' : `${rate}%`}
                  </td>
                  <td className='border-t border-border px-2 py-2'>
                    {m.leftOn ? (
                      <span className='type-label-sm'>{shortDate(m.leftOn)} 참여 중단</span>
                    ) : isOut ? (
                      <Badge tone='closed'>뺌</Badge>
                    ) : (
                      <Badge tone='present'>계속</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
