import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input } from '@studyclub/ui';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useEditGroup } from './queries';
import { ApiError } from '@/lib/http';

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '반 제목을 입력해 주세요.')
    .refine((name) => [...name].length <= 20, '반 제목은 20자까지 입력할 수 있습니다.'),
});

export function GroupEditor({
  studyId,
  group,
  onClose,
}: {
  studyId: number;
  group?: { groupId: number; name: string };
  onClose: () => void;
}) {
  const mutation = useEditGroup(studyId);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: group?.name ?? '' },
  });
  return (
    <form
      onSubmit={handleSubmit(({ name }) => mutation.mutate({ groupId: group?.groupId, name }, { onSuccess: onClose }))}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !mutation.isPending) onClose();
      }}
    >
      <fieldset disabled={mutation.isPending} className='flex items-start gap-3'>
        <div className='w-1/2'>
          <Input
            aria-label='반 제목'
            autoFocus
            placeholder='예: A반 · 미국 금요일반'
            {...register('name')}
            error={
              errors.name?.message ??
              (mutation.error
                ? mutation.error instanceof ApiError
                  ? mutation.error.message
                  : '반을 저장하지 못했습니다. 다시 시도해 주세요.'
                : undefined)
            }
          />
        </div>
        <div className='ml-auto flex gap-2'>
          <Button type='button' variant='tertiary' onClick={onClose}>
            취소
          </Button>
          <Button type='submit'>저장</Button>
        </div>
      </fieldset>
    </form>
  );
}
