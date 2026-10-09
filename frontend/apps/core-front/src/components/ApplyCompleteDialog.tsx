'use client';

import { useRouter } from 'next/navigation';

import { Button, Modal } from '@studyclub/ui';
import { X } from 'lucide-react';

import type { Locale } from '@/lib/content';
import { t } from '@/lib/i18n';

export function ApplyCompleteDialog({
  studyId,
  locale,
  open,
  onClose,
}: {
  studyId?: string;
  locale: Locale;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  function goMyStudies() {
    onClose();
    const target = studyId ? `/${locale}/my?open=${encodeURIComponent(studyId)}` : `/${locale}/my`;
    router.push(target);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t({ ko: '스터디 신청 완료', en: 'Application submitted' }, locale)}
      headerEnd={
        <button
          type='button'
          aria-label={t({ ko: '닫기', en: 'Close' }, locale)}
          onClick={onClose}
          className='rounded-control p-1.5 text-fg-muted transition-colors hover:bg-surface-1 hover:text-fg'
        >
          <X size={18} />
        </button>
      }
      footer={
        <div className='flex w-full items-center justify-end gap-2'>
          <Button variant='secondary' onClick={onClose}>
            {t({ ko: '닫기', en: 'Close' }, locale)}
          </Button>
          <Button onClick={goMyStudies}>
            {t({ ko: '내 스터디 보러 가기', en: 'Go to My studies' }, locale)}
          </Button>
        </div>
      }
    >
      <div className='flex flex-col gap-2 py-4 text-sm leading-relaxed'>
        <p className='text-fg'>
          {t({ ko: '스터디 신청이 완료되었습니다. 내 스터디로 이동할까요?', en: 'Your application is in. Go to My studies?' }, locale)}
        </p>
        <p className='text-fg-secondary'>
          {t({ ko: '제출한 내용은 수정할 수 없습니다.', en: 'Submitted answers cannot be edited.' }, locale)}
        </p>
      </div>
    </Modal>
  );
}
