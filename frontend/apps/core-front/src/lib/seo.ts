// SEO 공통 — canonical·hreflang·OG 를 한 곳에서 만든다.
//
// 페이지마다 손으로 쓰면 반드시 어긋난다(로케일 하나 빠뜨리거나 canonical 에 절대경로를 박거나).
// 여기 함수만 쓰면 metadataBase 기준 상대경로로 일관되게 나온다.
import type { Metadata } from 'next';

import type { Locale } from './content';
import { DEFAULT_LOCALE, LOCALES } from './i18n';

/** 배포 도메인. 환경변수로 덮을 수 있게 둔다 — 프리뷰 배포에서 canonical 이 prod 를 가리키면 안 된다. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://studyclub-plusplus.com').replace(/\/+$/, '');
export const SITE_NAME = 'StudyClub++';

/** 로케일 접두를 뺀 경로('' | '/studies' | '/studies/foo')를 정규화. */
function normalize(path: string): string {
  if (!path || path === '/') return '';
  return path.startsWith('/') ? path : `/${path}`;
}

/** 로케일 접두 없는 경로를 받아 canonical + 전 로케일 hreflang 을 만든다. */
export function alternatesFor(locale: Locale, path = ''): Metadata['alternates'] {
  const p = normalize(path);
  const languages: Record<string, string> = {};
  for (const l of LOCALES) languages[l] = `/${l}${p}`;
  languages['x-default'] = `/${DEFAULT_LOCALE}${p}`;
  return { canonical: `/${locale}${p}`, languages };
}

type PageSeo = {
  locale: Locale;
  /** 로케일 접두 없는 경로. 홈이면 생략 */
  path?: string;
  title: string;
  description: string;
  /** OG 이미지 절대 URL 또는 metadataBase 기준 상대경로. 없으면 사이트 기본 OG 사용 */
  image?: string;
  /** 색인 대상이 아닌 페이지(로그인·내 정보 등) */
  noindex?: boolean;
  /** article/profile 등. 기본 website */
  ogType?: 'website' | 'article';
  /**
   * 루트 template(`%s · StudyClub++`)을 건너뛴다.
   * 홈처럼 제목 자체에 브랜드가 이미 들어간 경우 — 안 쓰면 `… · StudyClub++` 가 덧붙어
   * 60자를 넘겨 검색 결과에서 잘린다.
   */
  titleAbsolute?: boolean;
};

/** 페이지 metadata 한 벌. title 은 기본적으로 루트 template(`%s · StudyClub++`)이 감싼다. */
export function pageMetadata({
  locale,
  path = '',
  title,
  description,
  image,
  noindex,
  ogType,
  titleAbsolute,
}: PageSeo): Metadata {
  const alternates = alternatesFor(locale, path);
  const canonical = `${SITE_URL}/${locale}${normalize(path)}`;
  return {
    title: titleAbsolute ? { absolute: title } : title,
    description,
    alternates,
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      type: ogType ?? 'website',
      siteName: SITE_NAME,
      locale: locale === 'ko' ? 'ko_KR' : 'en_US',
      url: canonical,
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
