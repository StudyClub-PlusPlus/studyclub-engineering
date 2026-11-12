'use client';

import { useId, useState } from 'react';

import { cx } from '@studyclub/ui';

import { useApplicationForm } from '@/features/application-form/queries';
import { PublishConfirmDialog, type PublishTarget } from '@/features/studies/PublishConfirmDialog';
import type { ApiStudyDetail } from '@/features/studies/types';

/**
 * 상세 머리의 「사이트 공개」 스위치 — 목록 「스터디 공개」 칸과 같은 규칙, 같은 확인 팝업 (captain-publish-study 1 · 1-1 · 4).
 *
 * - 신청 폼에 질문이 없으면 공개하지 못한다. 상세 응답에 폼 여부가 없어 신청 폼 조회로 판단한다(서버 공개 조건과 같은 「질문 1개 이상」)
 * - 서버는 작성 중(DRAFT)만 공개하고, 개설(OPEN)만 비공개로 돌린다. 진행 중·종료는 바꿀 수 없다
 * - 막힌 이유는 스위치 아래 글로 바로 보인다 — 말풍선을 찾아 짚지 않아도 되게
 */
export function PublishSwitch({ detail }: { detail: ApiStudyDetail }) {
  const form = useApplicationForm(detail.id);
  const [confirm, setConfirm] = useState<PublishTarget | null>(null);
  const reasonId = useId();

  const live = detail.status !== 'DRAFT';
  const hasForm = (form.data?.questions.length ?? 0) > 0;
  const reason = live
    ? detail.status === 'OPEN'
      ? undefined
      : '진행 중이거나 종료된 스터디는 비공개로 돌릴 수 없습니다.'
    : form.isPending
      ? undefined
      : hasForm
        ? undefined
        : '신청 폼을 먼저 연결하세요.';
  // 폼을 아직 못 받았으면 공개 가능 여부를 모른다 — 이유 없이 잠깐 막아 둔다
  const blocked = reason !== undefined || (!live && form.isPending);

  return (
    <div className='flex flex-col items-end gap-1'>
      <button
        type='button'
        role='switch'
        aria-checked={live}
        aria-disabled={blocked || undefined}
        aria-describedby={reason ? reasonId : undefined}
        onClick={() => !blocked && setConfirm({ studyId: detail.id, title: detail.title, next: !live })}
        className={cx(
          'inline-flex items-center gap-2 rounded-control px-1 py-0.5 type-label-lg text-fg-secondary outline-none focus-visible:shadow-[var(--ring)]',
          blocked && 'opacity-60',
        )}
      >
        사이트 공개
        <span
          className={cx(
            'relative h-5 w-9 rounded-full transition-colors duration-300 ease-in-out',
            live ? 'bg-success-600' : 'bg-surface-3',
          )}
        >
          <span
            className={cx(
              'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
              live && 'translate-x-4 shadow',
            )}
          />
        </span>
      </button>
      {reason && (
        <p id={reasonId} className='type-label-sm text-fg-muted'>
          {reason}
        </p>
      )}
      <PublishConfirmDialog target={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
