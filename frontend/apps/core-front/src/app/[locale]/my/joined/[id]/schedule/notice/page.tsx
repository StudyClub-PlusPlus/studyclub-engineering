'use client';

import { useManage } from '@/features/schedule/StudyManageShell';
import { NoticeTab } from '@/features/study-notices/components/NoticeTab';

export default function StudyManageNoticePage() {
  const { study, groupId, canEdit } = useManage();

  return <NoticeTab studyId={Number(study.id)} groupId={groupId} canEdit={canEdit} />;
}
