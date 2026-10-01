// SEO 공통 — canonical·hreflang·OG 를 한 곳에서 만든다.
//
// 페이지마다 손으로 쓰면 반드시 어긋난다(로케일 하나 빠뜨리거나 canonical 에 절대경로를 박거나).
// 여기 함수만 쓰면 metadataBase 기준 상대경로로 일관되게 나온다.
import type { Metadata } from 'next';

import type { Locale } from './content';
import { DEFAULT_LOCALE, LOCALES } from './i18n';

/** 색인해도 되는 유일한 호스트. 여기 말고 다른 곳에 뜬 우리 사이트는 전부 색인 금지다. */
export const CANONICAL_ORIGIN = 'https://studyclub-plusplus.com';

/** 배포 도메인. 환경변수로 덮을 수 있게 둔다 — 프리뷰 배포에서 canonical 이 prod 를 가리키면 안 된다. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? CANONICAL_ORIGIN).replace(/\/+$/, '');
export const SITE_NAME = 'StudyClub++';

/**
 * **이 빌드가 색인되어도 되는가.**
 *
 * ⚠️ stage(`stage.studyclub-plusplus.com`)가 색인되면 prod 와 **같은 콘텐츠로 경쟁한다** —
 * 하필 우리가 이기려는 그 키워드로. 구글이 둘 중 하나를 골라 버리는데 고르는 쪽이 stage 일 수도 있다.
 * robots.txt 로 `Allow: /` 를 내보내는 순간 "와서 가져가라"고 초대하는 꼴이라
 * 호스트별로 반드시 갈라야 한다.
 *
 * 판정은 `NEXT_PUBLIC_SITE_URL` 하나로 한다 — 배포 파이프라인이 주입하는 값이라
 * 코드가 자기 환경을 짐작하지 않는다. 안 넘어오면 prod 로 본다(기본값이 prod 도메인이므로).
 */
export const IS_INDEXABLE = SITE_URL === CANONICAL_ORIGIN;

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
    // 색인 불가 호스트(stage·프리뷰)면 페이지 성격과 무관하게 전부 막는다.
    ...(noindex || !IS_INDEXABLE ? { robots: { index: false, follow: false } } : {}),
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
