'use client';

import { useRouter } from 'next/navigation';

import { Button, Modal } from '@studyclub/ui';

import { usePublishStudy } from '@/features/studies/queries';

export type PublishTarget = { studyId: number; title: string; next: boolean };

/**
 * 공개 · 비공개 전환 확인 팝업 (captain-publish-study 4). 목록 「스터디 공개」 칸과 상세 머리 스위치가 같이 쓴다.
 * 누르면 바로 바뀌지 않는다 — 공개는 모집 시작이라 실수로 눌러도 사이트에 나간다.
 * 성공하면 목록(서버 컴포넌트)을 다시 받고, 상세 캐시는 `usePublishStudy` 가 무효화한다.
 */
export function PublishConfirmDialog({ target, onClose }: { target: PublishTarget | null; onClose: () => void }) {
  const router = useRouter();
  const mutation = usePublishStudy();

  function close() {
    if (mutation.isPending) return;
    mutation.reset();
    onClose();
  }

  function apply() {
    if (!target || mutation.isPending) return;
    mutation.mutate(
      { studyId: target.studyId, publish: target.next },
      {
        onSuccess: () => {
          mutation.reset();
          onClose();
          // 목록은 서버 컴포넌트가 받는다 — 다시 받아야 공개 상태·스터디 상태·모집 시작일이 바뀐다
          router.refresh();
        },
      },
    );
  }

  return (
    <Modal
      open={target !== null}
      onClose={close}
      title={target?.next ? '스터디 공개' : '스터디 비공개'}
      footer={
        <>
          {/* 결정을 묻는 모달 — 안전한 쪽이 기본 포커스를 받는다. Enter 로 실행되면 안 된다 (POL-0008) */}
          <Button variant='secondary' data-autofocus disabled={mutation.isPending} onClick={close}>
            취소
          </Button>
          <Button loading={mutation.isPending} onClick={apply}>
            {target?.next ? '공개' : '비공개로 전환'}
          </Button>
        </>
      }
    >
      <div className='py-6 text-center'>
        <p className='type-label-lg text-fg'>
          ‘{target?.title}’ {target?.next ? '스터디를 공개하시겠습니까?' : '스터디를 비공개로 전환하시겠습니까?'}
        </p>
        <p className='mt-1.5 type-body-sm text-fg-muted'>
          {target?.next
            ? '공개하면 오늘이 모집 시작일이 되고, 스터디 상태가 「개설」이 되어 사용자 사이트에 노출됩니다.'
            : '사용자 사이트에서 내려가고 스터디 상태가 「작성 중」으로 돌아갑니다.'}
        </p>
        {mutation.error && (
          <p role='alert' className='mt-3 type-label-lg text-error-600'>
            {mutation.error.message}
          </p>
        )}
      </div>
    </Modal>
  );
}
