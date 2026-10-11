'use client';

import { Modal } from '@studyclub/ui';

import { PermissionTables } from '@/features/users/components/PermissionTables';
import { useRolePermissions } from '@/features/users/queries';

/** 역할별 기본 권한 모달. 열려 있는 동안만 권한표를 부른다(`enabled`). */
export function PermissionMatrixDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, error, isPending } = useRolePermissions(open);

  return (
    <Modal open={open} onClose={onClose} size='lg' title='역할별 기본 권한'>
      {error ? (
        <p className='text-sm text-red-600'>{error.message}</p>
      ) : isPending || !data ? (
        <p className='py-6 text-center text-sm text-fg-muted'>불러오는 중…</p>
      ) : (
        <PermissionTables groups={data.groups} />
      )}
    </Modal>
  );
}
