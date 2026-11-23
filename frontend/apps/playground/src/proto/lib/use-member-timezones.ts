'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';

import { memberTimeZones } from '@core/lib/time-zones';

import { readMemberTimeZones, seedMemberTimeZones } from './member-timezone-store';

export const MemberTimeZonesContext = createContext<string[] | null>(null);

/** 현재 화면에서는 목록을 고정하고, 화면 재진입·새로고침에 최신 회원 설정을 집계한다. */
export function useMemberTimeZones() {
  const inherited = useContext(MemberTimeZonesContext);
  const pathname = usePathname();
  const [zones, setZones] = useState(() => memberTimeZones('', 'ko', Object.values(seedMemberTimeZones)));
  useEffect(() => {
    setZones(memberTimeZones('', 'ko', Object.values(readMemberTimeZones())));
  }, [pathname]);
  return inherited ?? zones;
}
