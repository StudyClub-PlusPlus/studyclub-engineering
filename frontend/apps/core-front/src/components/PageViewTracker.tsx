'use client';

import { usePathname, useParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { track, identifyUser, type PageName } from '@/lib/analytics';
import { analyticsAllowed } from '@/lib/analytics-privacy-state';
import { useAnalyticsAllowed } from '@/lib/use-analytics-allowed';

/** 경로 → page_name. 다른 화면으로 곧장 넘기는 경로(`/my/joined/{id}` 등)는 null — 도착한 화면에서 센다. */
export function pathToPageName(path: string): PageName | null {
  if (path === '') return 'landing';
  if (path === '/studies') return 'studies_list';
  if (/^\/studies\/\d+/.test(path)) return 'study_detail';
  if (path === '/events') return 'events_list';
  if (/^\/events\//.test(path)) return 'event_detail';
  if (path === '/notices') return 'notices_list';
  if (/^\/notices\//.test(path)) return 'notice_detail';
  if (path === '/about') return 'about';
  if (path === '/guide') return 'guide';
  if (path === '/terms') return 'terms';
  if (path === '/privacy') return 'privacy';
  if (path === '/login') return 'login';
  if (path === '/onboarding') return 'onboarding';
  if (path === '/my') return 'my_page';
  if (path === '/my/joined') return 'my_studies';
  if (path === '/my/saved') return 'saved_studies';
  if (path === '/my/leave') return 'account_leave';
  if (/^\/my\/joined\/\d+\/schedule\/attendance$/.test(path)) return 'study_room_attendance';
  if (/^\/my\/joined\/\d+\/schedule\/notice$/.test(path)) return 'study_room_notice';
  if (/^\/my\/joined\/\d+\/schedule$/.test(path)) return 'study_room_schedule';
  return null;
}

export function PageViewTracker() {
  const allowed = useAnalyticsAllowed();
  const pathname = usePathname();
  const params = useParams();
  const locale = (params?.locale as string) ?? 'ko';
  const identifiedLocale = useRef<string | null>(null);
  const pageViewed = useRef(false);

  // 수집이 잠시 중단돼도 같은 방문의 전송 여부는 유지한다. 실제 경로 이동 때만 초기화한다.
  useEffect(() => {
    pageViewed.current = false;
  }, [pathname, locale]);

  useEffect(() => {
    if (!allowed) return;
    if (identifiedLocale.current !== locale) {
      identifiedLocale.current = locale;
      identifyUser({ user_locale: locale as 'ko' | 'en' });
    }
    if (pageViewed.current) return;
    const path = pathname.startsWith(`/${locale}`) ? pathname.slice(`/${locale}`.length) : pathname;
    const page_name = pathToPageName(path);
    if (!page_name) return;

    const extra: { next_path?: string; referrer?: string; study_id?: string; current_category?: string } = {};
    if (page_name === 'login') {
      const qs = new URLSearchParams(window.location.search);
      const next = qs.get('next');
      if (next) extra.next_path = next;
      if (document.referrer) extra.referrer = document.referrer;
    }
    if (page_name === 'study_detail' || page_name.startsWith('study_room_')) {
      const match = path.match(/^\/(?:studies|my\/joined)\/(\d+)/);
      if (match) extra.study_id = match[1];
    }
    if (page_name === 'studies_list') {
      const category = new URLSearchParams(window.location.search).get('category');
      if (category) extra.current_category = category;
    }

    // Next.js App Router updates document.title asynchronously after route change.
    // Wait for the <title> element to update before firing so Amplitude captures the correct Page Title.
    let fired = false;
    const fire = () => {
      if (fired || pageViewed.current || !analyticsAllowed()) return;
      fired = true;
      pageViewed.current = true;
      observer.disconnect();
      clearTimeout(fallback);
      track({ name: 'Page Viewed', props: { page_name, locale, ...extra } });
    };

    const observer = new MutationObserver(fire);
    const titleEl = document.querySelector('title');
    if (titleEl) {
      observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
    // Fallback: fire after 500ms if title element never mutates (e.g. same title across pages)
    const fallback = setTimeout(fire, 500);

    return () => {
      fired = true;
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, [pathname, locale, allowed]);

  return null;
}
