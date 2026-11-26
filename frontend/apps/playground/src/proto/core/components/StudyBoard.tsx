'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { StudyInfoCard } from '@core/components/StudyInfoCard';
import { meetingsOf } from '@core/lib/attendance';
import { canOpenDiscord, canOpenDrive, discordUrl, driveUrl } from '@core/lib/joined';
import { dowOf, isKickoff, type NavigatorGroup, type ScheduleRole } from '@core/lib/meetings';
import { regularScheduleDisplay } from '@core/lib/regular-schedule';
import { navigatorNameOf } from '@core/lib/schedule-board';
import { useDisplayTimeZone } from '@core/lib/use-display-timezone';
import { getStudyCrew } from '@studyclub/mock';
import { type Study } from '@studyclub/types';
import { Button, HelpPopover } from '@studyclub/ui';
import { ExternalLink, Info } from 'lucide-react';

import { kindRules } from '@/proto/lib/study-kind';

/**
 * 사용자 사이트 스터디 정보 카드 — 내 분반의 시간 · 네비게이터 · 바로가기 · 규칙.
 * 스터디 일정의 탭 위에 두어 일정·출석부 어느 탭에서도 보인다.
 *
 * 캡틴에게는 바로가기 줄 맨 앞(「디스코드」 왼쪽)에 「백오피스 출석부」 버튼을 둔다 — 다른 반 출석은 백오피스에서 반 칩으로 골라 본다.
 */
export function StudyBoard({
  study,
  group,
  role,
  canEdit,
  onDirtyChange,
}: {
  study: Study;
  group: NavigatorGroup;
  role: ScheduleRole;
  canEdit: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const router = useRouter();
  const viewerZone = useDisplayTimeZone();
  const [, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((n) => n + 1);
    window.addEventListener('storage', refresh);
    window.addEventListener('sc:meetings-change', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('sc:meetings-change', refresh);
    };
  }, []);
  // mock에는 분반 요일이 없어 최초 원본 회차에서 읽는다. 개별 회차를 옮겨도 정규 요일은 바꾸지 않는다.
  const firstRegular = getStudyCrew(study).meetings.find((m) => !isKickoff(m));
  const regularGroup = {
    ...group,
    weekdays: group.weekdays ?? (firstRegular ? [dowOf(firstRegular.date)] : []),
  };
  const time = regularScheduleDisplay(regularGroup, meetingsOf(study), viewerZone);
  // 클럽은 모임 시각 · 네비게이터가 없다 — 그 칸을 두지 않는다. 바로가기 · 규칙은 같다
  const meets = kindRules(study).meetings;

  return (
    <StudyInfoCard
      anno='manage:3'
      time={meets ? <RegularTime summary={time} /> : undefined}
      navigator={meets ? navigatorNameOf(study, role) : undefined}
      leadingAction={
        role === 'captain' ? (
          <span data-anno='book:2'>
            <Button
              size='sm'
              variant='secondary'
              trailingIcon={<ExternalLink size={14} />}
              onClick={() =>
                router.push(meets ? `/proto/console/studies/${study.study_id}?tab=attendance` : '/proto/console/clubs')
              }
            >
              백오피스 출석부
            </Button>
          </span>
        ) : undefined
      }
      // 참여를 중단한 사람에게는 바로가기를 닫는다 — 완주한 사람의 디스코드는 클럽 로비
      discordHref={canOpenDiscord(study) ? discordUrl(study) : undefined}
      driveHref={canOpenDrive(study) ? driveUrl(study) : undefined}
      rulesKey={study.id}
      canEdit={canEdit}
      onDirtyChange={onDirtyChange}
    />
  );
}

function RegularTime({ summary }: { summary: ReturnType<typeof regularScheduleDisplay> }) {
  return (
    <span className='inline-block'>
      {summary.label}{' '}
      <HelpPopover label='스터디 시간 기준 안내' icon={<Info />}>
        <span className='block font-semibold text-fg'>반 기준: {summary.original}</span>
        <span className='mt-1 block'>서머타임에 따라 내 지역의 시간이 달라질 수 있어요.</span>
      </HelpPopover>
    </span>
  );
}
