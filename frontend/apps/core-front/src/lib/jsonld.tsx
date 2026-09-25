// JSON-LD 구조화 데이터.
//
// 두 가지를 동시에 노린다:
// 1. 검색 리치 결과 (Course·Event 카드)
// 2. GEO — AI 검색(ChatGPT·Perplexity·AI Overview)이 인용할 **사실 근거**.
//    사람이 읽는 본문은 문장이라 인용이 흔들리지만 JSON-LD 는 값이라 그대로 인용된다.
import type { Locale, Site, Study, StudyclubEvent } from './content';
import { t } from './i18n';
import { SITE_NAME, SITE_URL } from './seo';

type Json = Record<string, unknown>;

/** 스크립트 태그 하나. Next 는 body 안의 ld+json 도 그대로 크롤러에 노출한다. */
export function JsonLd({ data }: { data: Json | Json[] }) {
  return (
    <script
      type='application/ld+json'
      // JSON.stringify 결과만 넣는다. `<` 는 이스케이프해 script 조기 종료를 막는다.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

export function organizationJsonLd(locale: Locale, site: Site): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: locale === 'ko' ? '스터디클럽++' : 'StudyClub Plus Plus',
    url: `${SITE_URL}/${locale}`,
    logo: `${SITE_URL}/icon.svg`,
    description:
      locale === 'ko'
        ? '미국·캐나다·한국의 개발자 2,000여 명이 함께하는 글로벌 스터디 커뮤니티. 이력서·인터뷰·시스템 디자인부터 AI까지 현직자와 함께 준비합니다.'
        : 'A global study community of 2,000+ engineers across the US, Canada, and Korea — resumes, interviews, system design, and AI, prepared together with working engineers.',
    sameAs: [site.discord_invite].filter(Boolean),
    areaServed: t(site.community.region, locale),
  };
}

/** 사이트 검색 상자 없이 사이트 자체를 선언. Organization 과 짝으로 둔다. */
export function webSiteJsonLd(locale: Locale): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: `${SITE_URL}/${locale}`,
    inLanguage: locale === 'ko' ? 'ko-KR' : 'en-US',
    publisher: { '@id': `${SITE_URL}/#organization` },
  };
}

const FORMAT_MODE: Record<string, string> = {
  online: 'Online',
  offline: 'Offline',
  hybrid: 'Blended',
};

/**
 * 스터디 = `Course`.
 *
 * ⚠️ Google 의 Course 리치 결과는 `provider` + `name` + `description` 이 필수다.
 * `hasCourseInstance` 가 없으면 Course carousel 대상이 안 된다 — 일정이 없어도 최소 한 개는 넣는다.
 */
export function courseJsonLd(study: Study, locale: Locale, url: string): Json {
  const rec = study.recruitment;
  const start = study.startAt ?? study.date;
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    '@id': `${url}#course`,
    url,
    name: t(study.title, locale),
    description: t(study.description ?? study.summary, locale),
    inLanguage: locale === 'ko' ? 'ko-KR' : 'en-US',
    ...(study.category ? { about: study.category } : {}),
    ...(study.audience ? { audience: { '@type': 'Audience', audienceType: t(study.audience, locale) } } : {}),
    ...(study.image ? { image: study.image } : {}),
    provider: { '@id': `${SITE_URL}/#organization` },
    // 무료 커뮤니티 스터디 — 값을 안 적으면 "가격 불명"으로 남아 AI 가 추측한다. 0 을 명시한다.
    offers: [
      {
        '@type': 'Offer',
        price: 0,
        priceCurrency: 'KRW',
        category: 'Free',
        availability: recruitAvailability(rec?.status),
      },
    ],
    hasCourseInstance: [
      {
        '@type': 'CourseInstance',
        courseMode: FORMAT_MODE[study.format] ?? 'Online',
        ...(start ? { startDate: start } : {}),
        ...(study.schedule ? { courseSchedule: t(study.schedule, locale) } : {}),
        ...(study.lead ? { instructor: { '@type': 'Person', name: study.lead } } : {}),
      },
    ],
  };
}

function recruitAvailability(status?: string): string {
  return status === 'closed' ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock';
}

export function eventJsonLd(ev: StudyclubEvent, locale: Locale, url: string): Json {
  const online = ev.type === 'online' || !ev.location;
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    '@id': `${url}#event`,
    url,
    name: t(ev.title, locale),
    description: t(ev.summary, locale),
    startDate: ev.date,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: online
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    location: online
      ? { '@type': 'VirtualLocation', url: ev.link ?? `${SITE_URL}/${locale}/events/${ev.id}` }
      : { '@type': 'Place', name: t(ev.location!, locale), address: t(ev.location!, locale) },
    ...(ev.image ? { image: ev.image } : {}),
    organizer: { '@id': `${SITE_URL}/#organization` },
    offers: { '@type': 'Offer', price: 0, priceCurrency: 'KRW', availability: 'https://schema.org/InStock', url },
  };
}

/** 빵부스러기 — 검색 결과에 경로가 뜨고, AI 가 사이트 구조를 이해한다. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  };
}
