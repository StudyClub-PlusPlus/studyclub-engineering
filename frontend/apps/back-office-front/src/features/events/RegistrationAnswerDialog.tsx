'use client';

import { Modal } from '@studyclub/ui';

import { useEventRegistration } from '@/features/events/queries';

/** 신청 당시 질문과 답변. 이후 질문을 고쳐도 바뀌지 않는 사본을 서버가 준다. */
export function RegistrationAnswerDialog({
  eventId,
  registrationId,
  onClose,
}: {
  eventId: number;
  registrationId: number | null;
  onClose: () => void;
}) {
  const { data, error, isPending } = useEventRegistration(eventId, registrationId);
  return (
    <Modal
      open={registrationId !== null}
      onClose={onClose}
      title={`${data?.nickname ?? (data?.accountDeleted ? '탈퇴한 회원' : '')} 신청서`.trim()}
    >
      {error && (
        <p role='alert' className='type-body-sm text-danger-fg'>
          {error.message}
        </p>
      )}
      {isPending && !error && <p className='type-body-sm text-fg-muted'>불러오는 중…</p>}
      {data && (
        <>
          <dl className='flex flex-col gap-5'>
            {data.questions.map((q) => (
              <div key={q.questionId}>
                <dt className='type-label-lg'>{q.label}</dt>
                <dd className='mt-2 whitespace-pre-wrap break-words type-body-sm text-fg-secondary'>
                  {q.answer.length ? q.answer.join(', ') : '답변 없음'}
                </dd>
              </div>
            ))}
          </dl>
          {data.questions.length === 0 && <p className='type-body-sm text-fg-muted'>추가 질문이 없는 신청서입니다.</p>}
        </>
      )}
    </Modal>
  );
}
