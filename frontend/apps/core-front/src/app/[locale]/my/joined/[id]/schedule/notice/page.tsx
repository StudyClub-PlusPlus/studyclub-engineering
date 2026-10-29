'use client';

import { Button } from '@studyclub/ui';

import { useManage } from '@/components/StudyManageShell';
import { NoticeComposer } from '@/features/study-notices/components/NoticeComposer';
import { NoticeHistory } from '@/features/study-notices/components/NoticeHistory';
import { composeView } from '@/features/study-notices/model';
import { useNoticeCompose } from '@/features/study-notices/queries';
import { ApiError } from '@/lib/http';
import { FORM } from '@/lib/layout';

/**
 * 공지 탭: 네비게이터(캡틴)가 자기 반 팀원 중 고른 사람에게 메일·디스코드로 공지를 보낸다 (ST-016, POL-0010).
 * 반 멤버가 읽는 공지 목록은 없다. 크루가 주소로 들어오면 보낼 수 없다고 알린다.
 */
export default function StudyManageNoticePage() {
  const { study, groupId, canEdit } = useManage();
  const studyId = Number(study.id);
  const compose = useNoticeCompose(studyId, groupId);

  if (!canEdit) {
    return <Message title='공지는 네비게이터와 캡틴만 보낼 수 있습니다.' body='보낸 공지는 메일과 디스코드로 받습니다.' />;
  }
  const view = composeView({
    hasData: compose.data !== undefined,
    isError: compose.isError,
    errorStatus: compose.error instanceof ApiError ? compose.error.status : null,
  });
  if (view.kind === 'loading') {
    return <p className='py-16 text-center text-sm text-fg-secondary'>불러오는 중…</p>;
  }
  if (view.kind === 'forbidden') {
    return <Message title='공지는 네비게이터와 캡틴만 보낼 수 있습니다.' body='보낸 공지는 메일과 디스코드로 받습니다.' />;
  }
  if (view.kind === 'error' || !compose.data) {
    return (
      <Message title='보내기 화면을 불러오지 못했습니다.' body='잠시 뒤에 다시 시도해 주세요.'>
        <Button className='mt-4' size='sm' variant='secondary' onClick={() => compose.refetch()}>
          다시 시도
        </Button>
      </Message>
    );
  }

  return (
    <div className={`${FORM} space-y-6`}>
      {view.staleError && (
        <div role='alert' className='card flex items-center justify-between gap-3 px-4 py-3 text-sm text-fg-secondary'>
          <span>최신 상태를 불러오지 못했습니다. 쓰던 내용은 그대로 있습니다.</span>
          <Button size='sm' variant='secondary' onClick={() => compose.refetch()}>
            다시 시도
          </Button>
        </div>
      )}
      <NoticeComposer studyId={studyId} groupId={groupId} compose={compose.data} />
      <NoticeHistory studyId={studyId} groupId={groupId} />
    </div>
  );
}

function Message({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className='card px-6 py-10 text-center'>
      <p className='text-sm font-semibold text-fg'>{title}</p>
      <p className='mt-1.5 text-sm text-fg-muted'>{body}</p>
      {children}
    </div>
  );
}
