'use client';

import { useRouter } from 'next/navigation';

import { StudyInfoCard } from '@core/components/StudyInfoCard';
import { meetingsOf } from '@core/lib/attendance';
import { canOpenDiscord, canOpenDrive, discordUrl, driveUrl } from '@core/lib/joined';
import { DOW_LABEL, dowOf, isKickoff, zoneLabel, type NavigatorGroup, type ScheduleRole } from '@core/lib/meetings';
import { navigatorNameOf } from '@core/lib/schedule-board';
import type { Study } from '@studyclub/mock';
import { Button } from '@studyclub/ui';
import { ExternalLink } from 'lucide-react';

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
  // 시트의 「스터디 시간 : 목요일 7PM PDT」 — 요일은 첫 정규 회차에서, 시각·시간대는 분반에서.
  const firstRegular = meetingsOf(study).find((m) => !isKickoff(m));
  const time = firstRegular
    ? `매주 ${DOW_LABEL[dowOf(firstRegular.date)]}요일 ${group.startAt} ${zoneLabel(group.timeZone)}`
    : `${group.startAt} ${zoneLabel(group.timeZone)}`;

  return (
    <StudyInfoCard
      anno='manage:3'
      time={time}
      navigator={navigatorNameOf(study, role)}
      leadingAction={
        role === 'captain' ? (
          <span data-anno='book:2'>
            <Button
              size='sm'
              variant='secondary'
              trailingIcon={<ExternalLink size={14} />}
              onClick={() => router.push(`/proto/console/studies/${study.study_id}?tab=attendance`)}
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
