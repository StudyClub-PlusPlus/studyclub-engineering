'use client';

// 마이페이지 「이 기기에서 알림 받기」 카드 (specs/web-push/spec.md).
// 상태마다 할 수 있는 일이 다르다 — 켜기·끄기, 홈 화면에 설치 안내, 차단 풀기 안내.
import { useEffect, useState } from 'react';

import { Button, toast } from '@studyclub/ui';

import { type PushState, readPushState, turnOff, turnOn } from './push';

const DESCRIPTION: Record<PushState, string> = {
  unsupported: '이 브라우저는 알림을 받을 수 없어요. 크롬이나 사파리로 열어 주세요.',
  'needs-install':
    'iPhone 은 홈 화면에 추가한 StudyClub 에서만 알림을 받을 수 있어요. 사파리 아래쪽 공유 버튼을 누르고 「홈 화면에 추가」를 고른 뒤, 홈 화면의 StudyClub 으로 다시 열어 주세요.',
  off: '지금은 알림을 보내지 않고 있어요.',
  denied: '알림이 차단되어 있어요. 브라우저 설정에서 이 사이트의 알림을 허용해 주세요.',
  ready: '스터디 소식을 이 기기로 바로 알려 드려요. 기기마다 따로 켜야 해요.',
  on: '이 기기에서 알림을 받고 있어요.',
};

export function PushCard() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    readPushState()
      .then(setState)
      .catch(() => setState('off'));
  }, []);

  if (state === null) return null;

  async function toggle(next: () => Promise<PushState>) {
    setBusy(true);
    try {
      setState(await next());
    } catch {
      toast.error('알림 설정을 바꾸지 못했어요. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className='card mt-5 px-6 py-5'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <h2 className='type-title-md'>이 기기에서 알림 받기</h2>
          <p className='mt-1 type-body-sm text-fg-secondary'>{DESCRIPTION[state]}</p>
        </div>
        {state === 'ready' && (
          <Button size='sm' onClick={() => toggle(turnOn)} loading={busy}>
            알림 켜기
          </Button>
        )}
        {state === 'on' && (
          <Button size='sm' variant='tertiary' onClick={() => toggle(turnOff)} loading={busy}>
            끄기
          </Button>
        )}
      </div>
    </section>
  );
}
