'use client';

import { useState } from 'react';

type Phase = 'loading' | 'refreshing' | 'retried' | 'failed';

export const IMAGE_FAILED_MESSAGE = '이미지를 불러오지 못했어요';

/**
 * 쿠키 인증이 필요한 이미지. `<img>` 는 401 을 알 수 없어서, 처음 실패하면 인증을 한 번 갱신하고 같은 주소를 다시 요청한다
 * (`http()` 의 401 처리와 같은 규칙). 그래도 안 되면 깨진 아이콘 대신 안내 문구를 보인다.
 */
export function RetryableImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [phase, setPhase] = useState<Phase>('loading');

  async function handleError() {
    if (phase === 'retried') {
      setPhase('failed');
      return;
    }
    if (phase !== 'loading') return;
    setPhase('refreshing');
    try {
      const refreshed = await fetch('/api/auth/refresh', { method: 'POST' });
      setPhase(refreshed.ok ? 'retried' : 'failed');
    } catch {
      setPhase('failed');
    }
  }

  if (phase === 'failed') {
    return (
      <span className={`flex items-center justify-center bg-surface-2 p-2 text-center text-xs text-fg-muted ${className ?? ''}`}>
        {IMAGE_FAILED_MESSAGE}
      </span>
    );
  }

  const retrySrc = `${src}${src.includes('?') ? '&' : '?'}retry=1`;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 쿠키 인증이 필요한 API 경로라 next/image 최적화를 거치지 않는다
    <img
      src={phase === 'retried' ? retrySrc : src}
      crossOrigin='use-credentials'
      alt={alt}
      className={className}
      onError={handleError}
    />
  );
}
