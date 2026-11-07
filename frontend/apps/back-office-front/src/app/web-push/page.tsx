'use client';

// 푸시 보내기 — 캡틴이 쓴 제목·본문을 구독한 기기에 웹 푸시로 보낸다 (specs/web-push/spec.md).
// 처음엔 「나에게」로 받아 보고, 문구를 확인한 뒤 「구독자 전체」로 보낸다.
import { useState } from 'react';

import { Button, Input, Segmented, StatCard, Textarea } from '@studyclub/ui';

import { PageHeader } from '@/components/ui';
import { NotificationTabs } from '@/features/notifications/components/NotificationTabs';
import {
  BODY_MAX,
  type PushAudience,
  TITLE_MAX,
  useSendPush,
  useWebPushStatus,
} from '@/features/web-push/api';

const AUDIENCE_OPTIONS: { value: PushAudience; label: string }[] = [
  { value: 'SELF', label: '나에게 (테스트)' },
  { value: 'ALL', label: '구독자 전체' },
];

export default function WebPushPage() {
  const status = useWebPushStatus();
  const send = useSendPush();
  const [audience, setAudience] = useState<PushAudience>('SELF');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');

  const urlError = url.trim() && !/^\/(?!\/)/.test(url.trim()) ? '/ 로 시작하는 사이트 안 경로만 넣을 수 있습니다' : undefined;
  const s = status.data;
  const targets = audience === 'SELF' ? (s?.mySubscriptions ?? 0) : (s?.subscriptions ?? 0);
  const blocked =
    !s?.enabled ||
    targets === 0 ||
    !title.trim() ||
    !body.trim() ||
    title.length > TITLE_MAX ||
    body.length > BODY_MAX ||
    Boolean(urlError);

  function submit() {
    if (audience === 'ALL' && !window.confirm(`구독한 기기 ${targets}대에 보냅니다. 보낸 뒤에는 취소할 수 없습니다.`)) return;
    send.mutate(
      { audience, title: title.trim(), body: body.trim(), url },
      {
        onSuccess: () => {
          if (audience === 'ALL') {
            setTitle('');
            setBody('');
            setUrl('');
          }
        },
      },
    );
  }

  return (
    <div>
      <PageHeader title='알림' subtitle='사이트에서 알림을 켠 회원의 기기로 웹 푸시를 보냅니다.' />
      <NotificationTabs />

      {s && !s.enabled && (
        <p className='mb-4 rounded-control bg-surface-2 px-4 py-3 type-body-sm text-fg-secondary'>
          웹 푸시가 꺼져 있습니다. 서버에 VAPID 키가 설정되지 않았습니다.
        </p>
      )}

      <div className='mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3'>
        <StatCard label='구독 기기' value={s?.subscriptions ?? '-'} />
        <StatCard label='구독 회원' value={s?.accounts ?? '-'} />
        <StatCard label='내 기기' value={s?.mySubscriptions ?? '-'} sub='사이트 마이페이지에서 알림을 켜면 늘어납니다' />
      </div>

      <section className='card max-w-2xl space-y-4 p-6'>
        <Segmented options={AUDIENCE_OPTIONS} value={audience} onChange={setAudience} />
        <Input
          label='제목'
          required
          labelHint={`${title.length}/${TITLE_MAX}`}
          error={title.length > TITLE_MAX ? `${TITLE_MAX}자까지 쓸 수 있습니다` : undefined}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder='이번 주 모임 안내'
        />
        <Textarea
          label='본문'
          required
          labelHint={`${body.length}/${BODY_MAX}`}
          error={body.length > BODY_MAX ? `${BODY_MAX}자까지 쓸 수 있습니다` : undefined}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder='목요일 저녁 8시에 온라인으로 모여요.'
        />
        <Input
          label='누르면 열 페이지'
          helper='비우면 첫 화면이 열립니다. 예: /studies'
          error={urlError}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder='/studies'
        />
        <div className='flex items-center justify-end gap-3'>
          <span className='type-body-sm text-fg-secondary'>받을 기기 {targets}대</span>
          <Button onClick={submit} disabled={blocked} loading={send.isPending}>
            보내기
          </Button>
        </div>
      </section>
    </div>
  );
}
