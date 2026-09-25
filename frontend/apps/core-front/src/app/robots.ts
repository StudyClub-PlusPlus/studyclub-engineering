import type { MetadataRoute } from 'next';

import { IS_INDEXABLE, SITE_URL } from '@/lib/seo';

/**
 * AI 크롤러를 **명시적으로 허용**한다.
 *
 * 기본값(규칙 없음)으로도 통과하긴 하지만, 명시하면 두 가지가 생긴다:
 * 1. 나중에 누가 `Disallow: /` 를 실수로 넣어도 이 블록이 남아 의도가 보인다
 * 2. GEO 는 우리 목표다 — 차단 안 함이 아니라 **환영함**이 문서로 남아야 판단이 안 뒤집힌다
 */
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'ClaudeBot',
  'Claude-Web',
  'Google-Extended',
];

export default function robots(): MetadataRoute.Robots {
  // stage·프리뷰는 전면 차단. sitemap 도 안 알린다 — 알리면 거기부터 긁어간다.
  if (!IS_INDEXABLE) return { rules: [{ userAgent: '*', disallow: '/' }] };

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // 개인 영역·인증 엔드포인트는 색인 가치가 0 이고 크롤 예산만 먹는다.
        disallow: ['/api/', '/ko/my', '/en/my', '/ko/login', '/en/login'],
      },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: '/', disallow: ['/api/', '/ko/my', '/en/my'] })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
