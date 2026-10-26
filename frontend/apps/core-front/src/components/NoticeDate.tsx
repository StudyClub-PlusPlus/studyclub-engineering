'use client';

import { useEffect, useState } from 'react';

import { noticeDate } from '@/lib/site-notice';

/**
 * 게시일 `YYYY-MM-DD` 를 보는 사람의 시간대로. 시간대는 브라우저만 알아서 서버가 그린 화면은 UTC 날짜이고,
 * 마운트 뒤에 바꾼다 — 첫 화면이 서버와 같아야 하이드레이션이 어긋나지 않는다.
 */
export function NoticeDate({ iso, className }: { iso: string; className?: string }) {
  const [text, setText] = useState(() => noticeDate(iso, 'UTC'));

  useEffect(() => {
    setText(noticeDate(iso, Intl.DateTimeFormat().resolvedOptions().timeZone));
  }, [iso]);

  return (
    <time dateTime={iso} className={className}>
      {text}
    </time>
  );
}
