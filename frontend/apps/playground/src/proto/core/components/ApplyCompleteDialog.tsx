'use client';

import { useRouter } from 'next/navigation';


import type { Locale } from '@core/lib/content';
import { t } from '@core/lib/i18n';
import { Button, Modal } from '@studyclub/ui';
import { X } from 'lucide-react';

/**
 * 스터디 신청 완료 팝업.
 *
 * 장바구니에 담은 뒤 「장바구니로 갈까요?」를 묻는 것과 같다.
 * X 는 지금 화면(목록·상세)에 머물고, 버튼은 내 스터디로 바로 간다.
 * 제출한 폼은 여기서 고치지 않는다.
 */
export function ApplyCompleteDialog({
  locale,
  open,
  onClose,
}: {
  locale: Locale;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  function goMyStudies() {
    onClose();
    router.push(`/proto/core/${locale}/my/joined`);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t({ ko: '스터디 신청 완료', en: 'Application submitted' }, locale)}
      headerEnd={
        <button
          type='button'
          data-anno='complete:2'
          aria-label={t({ ko: '닫기', en: 'Close' }, locale)}
          onClick={onClose}
          className='rounded-control p-1.5 text-fg-muted transition-colors hover:bg-surface-1 hover:text-fg'
        >
          <X size={18} />
        </button>
      }
      footer={
        <Button data-anno='complete:3' className='w-full' onClick={goMyStudies}>
          {t({ ko: '내 스터디로 이동하기', en: 'Go to My studies' }, locale)}
        </Button>
      }
    >
      <div data-anno='complete:1' className='flex flex-col gap-2 py-4 text-sm leading-relaxed'>
        <p className='text-fg'>
          {t(
            { ko: '스터디 신청이 완료되었습니다. 내 스터디로 이동할까요?', en: 'Your application is in. Go to My studies?' },
            locale,
          )}
        </p>
        <p className='text-fg-secondary'>
          {t(
            { ko: '제출한 내용은 수정할 수 없습니다.', en: 'Submitted answers cannot be edited.' },
            locale,
          )}
        </p>
      </div>
    </Modal>
  );
}
