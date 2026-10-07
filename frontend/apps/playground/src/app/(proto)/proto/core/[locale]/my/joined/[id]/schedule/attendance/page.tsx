'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { AttendanceTab } from '@console/components/AttendanceTab';
import { ruleFromMeetings } from '@console/lib/schedule';
import { useManage } from '@core/components/StudyManageShell';
import { getMyAttendance, meetingsOf } from '@core/lib/attendance';
import { bookFromSchedule } from '@core/lib/meetings';
import { getGroupAttendance, saveGroupAttendance, type AttendanceBook } from '@core/lib/navigator-attendance';
import { ME_ID, participantsOf, withdrawParticipant } from '@core/lib/schedule-board';
import { Button, Modal } from '@studyclub/ui';
import { ExternalLink } from 'lucide-react';

import { ATTENDANCE_SPEC, MANAGE_SPEC } from '../spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

/**
 * 출석부 — 백오피스 출석부와 같은 격자. 다른 점은 범위뿐이다: 여기는 **내 분반의 참여자만**.
 * 스터디 전체 참여자는 백오피스 출석부에서 본다 — 캡틴에게는 그리로 가는 버튼을 둔다.
 *
 * 구글 시트처럼 출석과 발표를 한 격자에 보인다. 발표는 일정의 발표자1·2에서 가져온다.
 * 크루는 분반 전원의 기록을 보기만 한다. 킥오프 열은 출석률에 넣지 않는다.
 *
 * 캡틴·네비게이터는 크루 줄 끝 버튼으로 참여를 중단시킨다. 확인 창을 한 번 거친다. 되돌리기는 없다.
 * 하차·제명을 가르지 않는다 — 사유는 묻지도 남기지도 않는다.
 */
export default function StudyManageAttendancePage() {
  const router = useRouter();
  const { study, group, locale, captain, canEdit, setDirty } = useManage();
  const [book, setBook] = useState<AttendanceBook | null>(null);
  /** 참여 중단 확인 창 대상. */
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  /** 중단·재개 뒤 다시 그려 명단을 새로 읽는다 — 프로토는 브라우저 저장소에서 읽는다. */
  const [, rerender] = useState(0);
  const [announce, setAnnounce] = useState('');

  // 프로토의 「나」는 분반 명부 밖에 있다 — 내 출석 기록(내 스터디 카드와 같은 값)을 내 줄에 채운다.
  useEffect(() => {
    const group = getGroupAttendance(study);
    setBook(group[ME_ID] ? group : { ...group, [ME_ID]: { ...getMyAttendance(study.id) } });
  }, [study]);

  const meetings = meetingsOf(study);
  // 중단한 사람은 맨 아래로. 하차·제명을 가르지 않고 누구에게나 「참여 중단」.
  // 나 · 캡틴 · 네비게이터 줄에는 중단 버튼이 없다 — 운영진의 역할은 백오피스에서 캡틴이 바꾼다.
  const crew = participantsOf(study)
    .map((p) => ({ ...p, left: p.left && { label: '참여 중단', at: p.left.at }, manageable: !p.me && !p.role }))
    .sort((a, b) => Number(Boolean(a.left)) - Number(Boolean(b.left)));

  function ask(id: string) {
    const p = crew.find((c) => c.id === id);
    if (p && !p.left) setTarget({ id: p.id, name: p.name });
  }

  function confirm() {
    if (!target) return;
    // TODO(api): POST /api/studies/{studyId}/participants/{participantId}/withdraw
    withdrawParticipant(study.id, target.id);
    setAnnounce(`${target.name} 님의 참여를 중단했습니다. 맨 아래 줄로 옮겼습니다.`);
    setTarget(null);
    rerender((v) => v + 1);
  }
  const { presentersOf, notCounted, headOf } = bookFromSchedule(meetings);
  const schedulePath = `/proto/core/${locale}/my/joined/${study.study_id}/schedule`;

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

      {captain && (
        <div className='mb-4 flex justify-end'>
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
        </div>
      )}

      {meetings.length === 0 ? (
        <div data-anno='book:4' className='card px-6 py-10 text-center'>
          <p className='text-sm font-semibold text-fg'>아직 회차가 없습니다.</p>
          <p className='mt-1.5 text-sm text-fg-muted'>
            {canEdit ? '일정 탭에서 회차를 만들면 이 반의 출석부가 만들어집니다.' : '회차가 생기면 출석부가 보입니다.'}
          </p>
          {canEdit && (
            <Button size='sm' className='mt-4' onClick={() => router.push(schedulePath)}>
              일정으로 가기
            </Button>
          )}
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
            readOnly={!canEdit}
            presentersOf={presentersOf}
            notCounted={notCounted}
            headOf={headOf}
            onWithdraw={ask}
            startAt={group.startAt}
          />
        </div>
      ) : null}

      <p className='sr-only' aria-live='polite'>
        {announce}
      </p>

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={`${target?.name ?? ''} 님의 참여를 중단할까요?`}
        footer={
          <>
            <Button variant='secondary' onClick={() => setTarget(null)}>
              취소
            </Button>
            <span data-anno='book:5'>
              <Button variant='destructive' onClick={confirm}>
                참여 중단
              </Button>
            </span>
          </>
        }
      >
        <ul className='list-disc space-y-1 pl-5 text-sm text-fg-secondary'>
          <li>지금까지의 출석 기록은 그대로 남습니다.</li>
          <li>지금 뒤에 시작하는 회차는 「—」로 비고 출석률에서 빠집니다.</li>
          <li>더는 스터디 디스코드 채널 · 드라이브 링크를 볼 수 없고, 발표자로 고를 수 없습니다.</li>
          <li>중단한 뒤에는 다시 참여시킬 수 없습니다.</li>
        </ul>
      </Modal>
    </>
  );
}
