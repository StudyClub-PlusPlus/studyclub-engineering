import { useState } from 'react';

import { Badge, Button } from '@studyclub/ui';

import { GroupEditor } from './GroupEditor';
import { useDeleteGroup } from './queries';
import type { ParticipantsResponse } from './types';
import { ApiError } from '@/lib/http';

export function GroupsSection({
  studyId,
  data,
  disabled,
}: {
  studyId: number;
  data: ParticipantsResponse;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const deletion = useDeleteGroup(studyId);
  const busy = disabled || deletion.isPending;
  return (
    <section aria-label='반 편성' className='space-y-3'>
      <div className='flex items-center justify-between'>
        <h2 className='font-bold'>반 {data.groups.length}개</h2>
        <Button size='sm' disabled={busy || editing !== null} onClick={() => setEditing('new')}>
          반 추가
        </Button>
      </div>
      {data.groups.map((group, index) => (
        <div key={group.groupId} className='card p-4'>
          {editing === group.groupId ? (
            <GroupEditor studyId={studyId} group={group} onClose={() => setEditing(null)} />
          ) : (
            <div className='flex items-center gap-3'>
              <span className='font-semibold'>{group.name}</span>
              {index === 0 && <Badge>기본</Badge>}
              <span className='text-sm text-fg-muted'>
                {
                  data.participants.filter(
                    (p) => p.groupId === group.groupId && (p.status === 'ACTIVE' || p.status === 'PAUSED'),
                  ).length
                }
                명
              </span>
              <div className='ml-auto flex gap-2'>
                <Button
                  size='sm'
                  variant='ghost'
                  disabled={busy || editing !== null}
                  aria-label={`${group.name} 수정`}
                  onClick={() => setEditing(group.groupId)}
                >
                  수정
                </Button>
                <Button
                  size='sm'
                  variant='danger'
                  disabled={busy || editing !== null || !group.canDelete}
                  aria-label={`${group.name} 삭제`}
                  title={!group.canDelete ? '기본반이거나 크루·출석 기록이 있는 반은 지울 수 없습니다.' : undefined}
                  onClick={() => deletion.mutate(group.groupId)}
                >
                  삭제
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
      {editing === 'new' && (
        <div className='card p-4'>
          <GroupEditor studyId={studyId} onClose={() => setEditing(null)} />
        </div>
      )}
      {data.groups.length === 0 && (
        <p className='text-sm text-fg-muted'>아직 반이 없습니다. 「반 추가」로 반을 만들고 크루를 나눠 주세요.</p>
      )}
      {deletion.error && (
        <p role='alert' className='text-sm text-error-600'>
          {deletion.error instanceof ApiError
            ? deletion.error.message
            : '반을 삭제하지 못했습니다. 다시 시도해 주세요.'}
        </p>
      )}
    </section>
  );
}
