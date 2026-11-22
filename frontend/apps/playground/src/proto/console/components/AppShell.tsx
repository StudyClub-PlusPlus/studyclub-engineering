'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';

import { Sidebar } from '@console/components/Sidebar';
import { getConsoleTimeZone, setConsoleTimeZone, subscribeConsoleTimeZone } from '@console/lib/display-timezone';
import { TimeZonePicker } from '@core/components/TimeZonePicker';
import { DisplayTimeZoneContext } from '@core/lib/use-display-timezone';

import { MemberTimeZonesContext, useMemberTimeZones } from '@/proto/lib/use-member-timezones';


// 로그인 전(/login)에는 사이드바·헤더 없이 children 만 렌더. 그 외에는 운영 콘솔 셸.
export function AppShell({ children }: { children: ReactNode }) {
  const memberZones = useMemberTimeZones();
  const pathname = usePathname() || '/';
  const savedZone = useSyncExternalStore(subscribeConsoleTimeZone, getConsoleTimeZone, () => 'Asia/Seoul');
  const [locked, setLocked] = useState<{ ids: Set<string>; zone: string }>({ ids: new Set(), zone: 'Asia/Seoul' });
  const lock = useCallback((id: string, blocked: boolean, currentZone: string) => {
    setLocked((current) => {
      if (current.ids.has(id) === blocked) return current;
      const next = new Set(current.ids);
      if (blocked) next.add(id);
      else next.delete(id);
      return { ids: next, zone: current.ids.size ? current.zone : currentZone };
    });
  }, []);
  // 다른 탭에서 설정을 바꿔도 입력 중인 화면은 저장·취소까지 기존 기준을 유지한다.
  const zone = locked.ids.size ? locked.zone : savedZone;
  const context = useMemo(() => ({ zone, lock }), [zone, lock]);

  if (pathname === '/login') {
    return <main className='min-h-screen'>{children}</main>;
  }

  return (
    <DisplayTimeZoneContext.Provider value={context}>
      <MemberTimeZonesContext.Provider value={memberZones}>
      <div className='flex min-h-screen'>
        <Sidebar />
        <div className='flex min-w-0 flex-1 flex-col'>
          <header className='sticky top-0 z-20 flex h-16 items-center justify-between border-b border-(--color-border) bg-[color-mix(in_srgb,var(--color-bg)_82%,transparent)] px-6 backdrop-blur-md'>
            <div className='type-label-lg'>StudyClub Back Office</div>
            <div className='flex min-w-0 items-center gap-3'>
              <div className='w-60 max-w-[45vw]' title={locked.ids.size ? '편집 중인 날짜와 시간을 저장하거나 취소한 뒤 변경해 주세요.' : undefined}>
                <TimeZonePicker label='백오피스 시간대' locale='ko' value={zone} onChange={setConsoleTimeZone}
                  allowedZones={memberZones} allowWorldwide disabled={locked.ids.size > 0} hideLabel compact prioritizeCountries annotation={false} />
              </div>
              <span className='shrink-0 rounded-full bg-(--color-surface-subtle) px-2.5 py-1 type-label-sm text-(--color-fg-muted)'>
                운영자 콘솔
              </span>
            </div>
          </header>
          <main className='mx-auto w-full max-w-5xl flex-1 px-6 py-8'>{children}</main>
        </div>
      </div>
    </MemberTimeZonesContext.Provider>
    </DisplayTimeZoneContext.Provider>
  );
}
