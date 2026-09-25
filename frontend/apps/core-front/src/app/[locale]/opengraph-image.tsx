import { ImageResponse } from 'next/og';

import { getSite } from '@/lib/content';
import { isLocale } from '@/lib/i18n';
import { SITE_NAME } from '@/lib/seo';

/**
 * 공유 카드 이미지.
 *
 * 디자인 자산 없이 코드로 그린다 — 디자이너 손을 기다리면 그동안 공유 링크가 계속 민짜로 나간다.
 * 정식 이미지가 나오면 이 파일을 지우고 `opengraph-image.png` 를 같은 자리에 두면 된다.
 *
 * ⚠️ next/og 는 Tailwind 클래스를 모른다. 인라인 style 로만 쓴다.
 */
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = SITE_NAME;

export default async function OpengraphImage({ params }: { params: Promise<{ locale: string }> }) {
  // Next 15+ 부터 params 는 Promise 다. await 안 하면 locale 이 항상 기본값으로 떨어진다.
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : 'ko';
  const site = await getSite();
  const headline =
    locale === 'ko'
      ? '미국 · 캐나다 · 한국 개발자들의\n무료 스터디 커뮤니티'
      : 'Free study groups for engineers\nacross the US, Canada & Korea';
  const members =
    locale === 'ko'
      ? `개발자 ${site.community.member_count.toLocaleString()}명+`
      : `${site.community.member_count.toLocaleString()}+ engineers`;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)',
        color: '#ffffff',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ fontSize: 34, letterSpacing: 6, color: '#7dd3fc', fontWeight: 700 }}>STUDYCLUB++</div>
      <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.25, marginTop: 28, whiteSpace: 'pre-wrap' }}>
        {headline}
      </div>
      <div style={{ display: 'flex', gap: 20, marginTop: 44, fontSize: 30, color: '#cbd5e1' }}>
        <span>{members}</span>
        <span style={{ color: '#475569' }}>·</span>
        <span>studyclub-plusplus.com</span>
      </div>
    </div>,
    size,
  );
}
