import { Button, Modal } from '@studyclub/ui';

export function DiscardGroupChangesDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title='변경을 취소하고 이동'
      footer={
        <>
          <Button variant='secondary' onClick={onClose}>
            계속 편집
          </Button>
          <Button variant='danger' onClick={onConfirm}>
            변경 취소 후 이동
          </Button>
        </>
      }
    >
      <p>저장하지 않은 반 변경이 있습니다. 변경을 취소하고 이동하시겠습니까?</p>
    </Modal>
  );
}
