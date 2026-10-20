'use client';

import { usePathname, useParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { track, identifyUser, type PageName } from '@/lib/analytics';

function pathToPageName(path: string): PageName | null {
  if (path === '') return 'landing';
  if (path === '/studies') return 'studies_list';
  if (/^\/studies\/\d+/.test(path)) return 'study_detail';
  if (path === '/events') return 'events_list';
  if (/^\/events\//.test(path)) return 'event_detail';
  if (path === '/login') return 'login';
  if (path === '/onboarding') return 'onboarding';
  if (path === '/my') return 'my_page';
  return null;
}

export function PageViewTracker() {
  const pathname = usePathname();
  const params = useParams();
  const locale = (params?.locale as string) ?? 'ko';
  const identifiedLocale = useRef<string | null>(null);

  useEffect(() => {
    if (identifiedLocale.current !== locale) {
      identifiedLocale.current = locale;
      identifyUser({ user_locale: locale as 'ko' | 'en' });
    }
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
    if (page_name === 'study_detail') {
      const match = path.match(/^\/studies\/(\d+)/);
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
      if (fired) return;
      fired = true;
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
  }, [pathname, locale]);

  return null;
}
