'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AttendanceTab } from '@console/components/AttendanceTab';
import { ruleFromMeetings } from '@console/lib/schedule';
import { useManage } from '@core/components/StudyManageShell';
import { meetingsOf } from '@core/lib/attendance';
import {
  getGroupAttendance,
  myGroupCrew,
  saveGroupAttendance,
  type AttendanceBook,
} from '@core/lib/navigator-attendance';
import { Button } from '@studyclub/ui';
import { ExternalLink } from 'lucide-react';

import { ATTENDANCE_SPEC, MANAGE_SPEC } from '../spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

/**
 * 출석부 — 백오피스 출석부와 같은 격자. 다른 점은 범위뿐이다: 여기는 **맡은 분반의 참여자만**.
 * 스터디 전체 참여자는 백오피스 출석부에서 본다 — 캡틴에게는 그리로 가는 버튼을 둔다.
 */
export default function StudyManageAttendancePage() {
  const router = useRouter();
  const { study, group, locale, captain, setDirty } = useManage();
  const [book, setBook] = useState<AttendanceBook | null>(null);

  useEffect(() => setBook(getGroupAttendance(study)), [study]);

  const meetings = meetingsOf(study);
  const crew = myGroupCrew(study);
  const schedulePath = `/proto/core/${locale}/my/joined/${study.study_id}/manage/schedule`;

  async function save(next: AttendanceBook) {
    // TODO(api): POST /api/studies/{id}/groups/{groupId}/attendances — 바뀐 칸만 updates[] 로 한 번에.
    await new Promise((r) => setTimeout(r, 400));
    saveGroupAttendance(study, next);
    setBook(next);
  }

  return (
    <>
      <ScreenSpecRegistrar spec={MANAGE_SPEC} />
      <ScreenSpecRegistrar spec={ATTENDANCE_SPEC} />

      <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
        <p data-anno='book:1' className='text-sm text-fg-secondary'>
          <b className='font-semibold text-fg'>{group.name}</b> 참여자만 보입니다. 스터디 전체 참여자는 백오피스 출석부에서 봅니다.
        </p>
        {captain && (
          <span data-anno='book:2'>
            <Button
              size='sm'
              variant='secondary'
              trailingIcon={<ExternalLink size={14} />}
              onClick={() => router.push(`/proto/console/studies/${study.study_id}?tab=attendance`)}
            >
              백오피스 출석부 (전체 참여자)
            </Button>
          </span>
        )}
      </div>

      {meetings.length === 0 ? (
        <div data-anno='book:4' className='card px-6 py-10 text-center'>
          <p className='text-sm font-semibold text-fg'>아직 회차가 없습니다.</p>
          <p className='mt-1.5 text-sm text-fg-muted'>일정 탭에서 회차를 만들면 이 반의 출석부가 만들어집니다.</p>
          <Button size='sm' className='mt-4' onClick={() => router.push(schedulePath)}>
            일정으로 가기
          </Button>
        </div>
      ) : book ? (
        <div data-anno='book:3'>
          <AttendanceTab
            study={study}
            crew={crew}
            meetings={meetings}
            attendance={book}
            classes={[{ id: group.id, rule: ruleFromMeetings(study, meetings) }]}
            classId={group.id}
            onClass={() => {}}
            onSave={save}
            onGoCrew={() => router.push(schedulePath)}
            onDirtyChange={setDirty}
            onAddMeeting={() => router.push(schedulePath)}
          />
        </div>
      ) : null}
    </>
  );
}
