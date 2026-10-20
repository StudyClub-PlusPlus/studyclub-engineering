'use client';

import { Button, Modal } from '@studyclub/ui';

/**
 * 거른 실패 건 전체 재발송 확인 창. **결정을 묻는 창**이라 닫기(X) · 취소 · 재발송이 있고, 취소에 먼저 선다(POL-0008).
 * 건수를 적는다 — 세 건을 보내려다 삼백 건을 보내는 일이 생긴다.
 */
export function ResendAllDialog({
  open,
  count,
  onClose,
  onConfirm,
}: {
  open: boolean;
  count: number;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title='실패 건 전체 재발송'
      footer={
        <div className='flex justify-end gap-2'>
          <Button variant='secondary' onClick={onClose} data-autofocus>
            취소
          </Button>
          <Button onClick={onConfirm}>재발송</Button>
        </div>
      }
    >
      <p className='text-sm text-fg'>
        거른 실패 건 <strong className='tnum'>{count.toLocaleString()}건</strong>을 모두 다시 보냅니다.
      </p>
      <p className='mt-2 text-sm text-fg-muted'>
        보고 있는 페이지뿐 아니라 이 조건에 걸린 실패 건 전체입니다. 같은 주소로 다시 나갑니다.
      </p>
      <p className='mt-2 text-sm text-fg-muted'>탈퇴한 회원의 건처럼 다시 보낼 수 없는 건은 제외됩니다.</p>
    </Modal>
  );
}
