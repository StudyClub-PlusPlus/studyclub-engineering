import type { MetadataRoute } from 'next';

import { getEvents, getStudies } from '@/lib/content';
import { DEFAULT_LOCALE, LOCALES } from '@/lib/i18n';
import { SITE_URL } from '@/lib/seo';

/**
 * 사이트맵 — 크롤러가 스터디·이벤트 상세를 **발견할 유일한 경로**다.
 * 내부 링크만으로는 목록 페이지네이션 뒤나 필터 뒤의 항목이 안 닿는다.
 *
 * ⚠️ 로케일 접두가 없어야 하므로 `app/` 바로 아래에 둔다(`[locale]/` 안이 아니다).
 *    `src/middleware.ts` 의 matcher 도 확장자 있는 경로를 제외해 `/sitemap.xml` 을 통과시킨다.
 *
 * 로그인·내 정보(`/my`, `/login`)는 넣지 않는다 — 색인 대상이 아니다.
 */
const STATIC_PATHS: {
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
}[] = [
  { path: '', priority: 1, changeFrequency: 'daily' },
  { path: '/studies', priority: 0.9, changeFrequency: 'daily' },
  { path: '/events', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/notices', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/guide', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.5, changeFrequency: 'monthly' },
];

/** 한 경로를 전 로케일 URL + 서로를 가리키는 hreflang 으로 펼친다. */
function entry(path: string, opts: Partial<MetadataRoute.Sitemap[number]> = {}): MetadataRoute.Sitemap {
  const languages: Record<string, string> = Object.fromEntries(LOCALES.map((l) => [l, `${SITE_URL}/${l}${path}`]));
  // 페이지 <head> 의 hreflang 과 같은 집합이어야 한다. 사이트맵에만 x-default 가 빠지면
  // 구글이 두 신호를 대조하다 "hreflang 불일치"로 둘 다 약하게 본다.
  languages['x-default'] = `${SITE_URL}/${DEFAULT_LOCALE}${path}`;
  return LOCALES.map((locale) => ({
    url: `${SITE_URL}/${locale}${path}`,
    alternates: { languages },
    ...opts,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [studies, events] = await Promise.all([getStudies(), getEvents()]);

  return [
    ...STATIC_PATHS.flatMap((s) =>
      entry(s.path, { priority: s.priority, changeFrequency: s.changeFrequency, lastModified: new Date() }),
    ),
    ...studies.flatMap((s) =>
      entry(`/studies/${s.id}`, {
        priority: 0.8,
        changeFrequency: 'weekly',
        lastModified: s.startAt ? new Date(s.startAt) : s.date ? new Date(s.date) : new Date(),
      }),
    ),
    ...events.flatMap((e) =>
      entry(`/events/${e.id}`, { priority: 0.5, changeFrequency: 'monthly', lastModified: new Date(e.date) }),
    ),
  ];
}
