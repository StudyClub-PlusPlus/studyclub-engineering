'use client';

import { useRef } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Modal } from '@studyclub/ui';
import { useForm } from 'react-hook-form';

import { discordLinkSchema, type DiscordLinkValues } from '@/features/studies/discord-link-schema';
import { useLinkStudyDiscord } from '@/features/studies/queries';

export function StudyDiscordLinkDialog({
  studyId,
  title,
  onClose,
}: {
  studyId: number;
  title: string;
  onClose: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DiscordLinkValues>({
    resolver: zodResolver(discordLinkSchema),
    defaultValues: { name: title },
  });
  const link = useLinkStudyDiscord(studyId);
  const submitting = useRef(false);
  const submit = handleSubmit(({ name }) => {
    // 비동기 입력 검증 뒤의 콜백이 겹쳐도 isPending 재렌더 전에 두 번째 요청을 막는다.
    if (submitting.current || link.isPending) return;
    submitting.current = true;
    link.mutate(name, {
      onSettled: () => {
        submitting.current = false;
      },
    });
  });
  const close = () => {
    if (!submitting.current && !link.isPending) onClose();
  };

  return (
    <Modal
      open
      title='디스코드 다시 연결'
      onClose={close}
      footer={
        <>
          <Button variant='secondary' disabled={link.isPending} onClick={close}>
            취소
          </Button>
          <Button loading={link.isPending} disabled={link.isPending} onClick={submit}>
            연결하기
          </Button>
        </>
      }
    >
      <form className='flex flex-col gap-4 py-2' onSubmit={submit}>
        <p className='type-body-sm text-fg-muted'>
          디스코드에 만들 카테고리와 역할의 이름입니다. 스터디 제목은 바뀌지 않습니다.
        </p>
        <Input
          label='디스코드 이름'
          data-autofocus
          disabled={link.isPending}
          error={errors.name?.message}
          {...register('name', { onChange: () => link.reset() })}
        />
        <p className='type-body-sm text-fg-muted'>
          같은 이름이 이미 있다면 다른 이름을 입력해 주세요. 이전 요청이 시간 초과됐거나 응답을 받지 못했다면,
          디스코드에 이미 생성됐는지 먼저 확인해 주세요. 이름을 바꿔 연결하면 추가로 생성될 수 있습니다.
        </p>
        {link.error && (
          <p role='alert' className='type-body-sm text-error-600'>
            {link.error.message}
          </p>
        )}
      </form>
    </Modal>
  );
}
