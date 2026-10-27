'use client';

import { useEffect, useRef, useState } from 'react';

import type { Locale } from '@core/lib/content';
import { getDiscordOutcome } from '@core/lib/discord-preview';
import { setDiscord } from '@core/lib/me';

/** Shared, cancellable OAuth simulation. No external account is modified. */
export function useDiscordLink(locale: Locale) {
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function connect(onLinked: () => void) {
    if (timer.current) return;
    setLinking(true);
    setError(null);
    // TODO(api): POST /api/me/discord/link — callback 성공 후 내 정보 재조회.
    timer.current = setTimeout(() => {
      timer.current = null;
      setLinking(false);
      const outcome = getDiscordOutcome();
      if (outcome !== 'success') {
        setError(locale === 'ko'
          ? outcome === 'cancelled' ? '디스코드 연결을 취소했어요. 다시 연결할 수 있어요.' : '디스코드에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'
          : outcome === 'cancelled' ? 'Discord connection was cancelled. You can try again.' : 'Could not connect Discord. Please try again.');
        return;
      }
      setDiscord('jiwon_dev');
      onLinked();
    }, 600);
  }

  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setLinking(false);
    setError(null);
  }

  return { linking, error, connect, cancel };
}
