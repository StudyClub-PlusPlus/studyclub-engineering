'use client';

import { useEffect, useState } from 'react';

import { MEMBER_REGIONS, type MemberRegion } from '@studyclub/mock';
import { Button, Input, Modal } from '@studyclub/ui';

import type { Locale } from '@/lib/content';
import { t } from '@/lib/i18n';

/**
 * 내 정보 수정.
 *
 * 고칠 수 있는 것은 **이름과 거주 지역** 둘뿐이다. 이메일은 로그인 계정 그 자체라 여기서 바꾸면
 * 로그인이 깨진다 — 보여주기만 한다.
 *
 * TODO(api): PATCH /api/me — 지금은 브라우저에만 저장한다.
 */
export function ProfileDialog({
  open,
  onClose,
  locale,
  email,
  name,
  region,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  email: string;
  name: string;
  region: MemberRegion;
  onSave: (next: { name: string; region: MemberRegion }) => void;
}) {
  const [draft, setDraft] = useState(name);
  const [draftRegion, setDraftRegion] = useState(region);
  const [error, setError] = useState<string | null>(null);

  // 열 때마다 현재 값에서 다시 시작한다. 취소하고 다시 열면 이전 편집이 남아 있으면 안 된다.
  useEffect(() => {
    if (!open) return;
    setDraft(name);
    setDraftRegion(region);
    setError(null);
  }, [open, name, region]);

  function submit() {
    if (!draft.trim()) {
      setError('이름을 입력하세요.');
      return;
    }
    onSave({ name: draft.trim(), region: draftRegion });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title='내 정보 수정'
      footer={
        <>
          <Button variant='secondary' onClick={onClose}>
            취소
          </Button>
          <Button onClick={submit}>저장</Button>
        </>
      }
    >
      <div className='flex flex-col gap-5'>
        <Input
          label='이름'
          required
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          error={error ?? undefined}
        />

        <div>
          <p className='text-sm font-medium text-neutral-800'>이메일</p>
          <p className='mt-1.5 text-sm text-fg-secondary'>{email}</p>
        </div>

        <div>
          <p className='text-sm font-medium text-neutral-800'>거주 지역</p>
          <div className='mt-2 flex flex-wrap gap-1.5'>
            {MEMBER_REGIONS.map((r) => (
              <button
                key={r.key}
                type='button'
                onClick={() => setDraftRegion(r.key)}
                aria-pressed={draftRegion === r.key}
                className={`rounded-pill px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                  draftRegion === r.key ? 'bg-brand text-on-brand' : 'bg-surface-2 text-fg-secondary hover:bg-surface-3'
                }`}
              >
                {t(r.label, locale)}
                <span className='ml-1.5 text-[11px] opacity-70'>{r.tzLabel}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
