import { ImageResponse } from 'next/og';

import { getSite } from '@/features/community/server';
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

// 로고 마크 (public/logo-mark.png 와 같은 도형). next/og 는 상대 경로 이미지를 못 읽어 data URI 로 싣는다.
const LOGO_MARK = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDQuNzE4OCIgaGVpZ2h0PSI0Ni4xODUzIiB2aWV3Qm94PSIwIDAgNDQuNzE4OCA0Ni4xODUzIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8ZyBpZD0iR3JvdXAgMSI+CjxwYXRoIGlkPSJWZWN0b3IiIGQ9Ik0wIDE0LjQwNEMwIDEyLjcxNjUgMC44NDM3NSAxMS40NTA5IDIuNTMxMjUgMTAuNjA3MUwyNC40Njg4IDAuNDgyMTQzQzI3LjI4MTIgLTAuNjQyODU3IDI4LjY4NzUgMC4yMDA4OTMgMjguNjg3NSAzLjAxMzM5VjEwLjYwNzFDMjUuMzEyNSAxMC42MDcxIDIzLjYyNSAxMi41NzU5IDIzLjYyNSAxNi41MTM0VjM1LjkxOTZDMjMuNjI1IDM3LjYwNzEgMjIuNzgxMiAzOC43MzIxIDIxLjA5MzggMzkuMjk0NkwzLjM3NSA0Ni4wNDQ2QzEuMTI1IDQ2LjYwNzEgMCA0NS40ODIxIDAgNDIuNjY5NlYxNC40MDRaIiBmaWxsPSIjNTI2N0Q4Ii8+CjxwYXRoIGlkPSJWZWN0b3JfMiIgZD0iTTMxLjIxODcgMTMuOTgyMkMzMS4yMTg3IDEyLjI5NDcgMzIuMDYyNSAxMS43MzIyIDMzLjc1IDEyLjI5NDdMNDIuMTg3NSAxNi41MTM0QzQzLjg3NSAxNy4zNTcyIDQ0LjcxODcgMTguNzYzNCA0NC43MTg3IDIwLjczMjJWNDAuOTgyMkM0NC43MTg3IDQzLjIzMjIgNDMuNTkzNyA0My43OTQ3IDQxLjM0MzcgNDIuNjY5N0wzMi45MDYyIDM4LjQ1MDlDMzEuNzgxMiAzNy44ODg0IDMxLjIxODcgMzYuNzYzNCAzMS4yMTg3IDM1LjA3NTlWMTMuOTgyMloiIGZpbGw9IiNGRjgwNUMiLz4KPC9nPgo8L3N2Zz4K';

export default async function OpengraphImage({ params }: { params: Promise<{ locale: string }> }) {
  // Next 15+ 부터 params 는 Promise 다. await 안 하면 locale 이 항상 기본값으로 떨어진다.
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : 'ko';
  const site = await getSite();
  const headline =
    locale === 'ko'
      ? '함께 배우는 사람들이 모이는 곳\n미국 · 캐나다 · 한국 온라인 스터디'
      : 'Where people gather to learn\nacross the US, Canada & Korea';
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
        background: '#0B1529',
        color: 'white',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <img src={LOGO_MARK} width={58} height={60} alt='' />
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 800 }}>
          <span>Study</span>
          <span style={{ color: '#FF805C' }}>Club</span>
        </div>
      </div>
      <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.25, marginTop: 28, whiteSpace: 'pre-wrap' }}>
        {headline}
      </div>
      <div style={{ display: 'flex', gap: 20, marginTop: 44, fontSize: 30, color: '#cbd5e1' }}>
        <span>{members}</span>
        <span style={{ color: '#475569' }}>·</span>
        <span>studyclub.life</span>
      </div>
    </div>,
    size,
  );
}
