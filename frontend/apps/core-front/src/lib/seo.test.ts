import { describe, expect, it } from 'vitest';

import { alternatesFor, pageMetadata } from './seo';

// canonical/hreflang 은 틀려도 화면에 아무 표시가 안 난다 — 검색 순위로만 드러나고
// 그때는 이미 몇 주가 지난 뒤다. 그래서 값 자체를 테스트로 묶어 둔다.
describe('alternatesFor', () => {
  it('canonical 은 현재 로케일, hreflang 은 전 로케일 + x-default 를 갖는다', () => {
    expect(alternatesFor('en', '/studies')).toEqual({
      canonical: '/en/studies',
      languages: { ko: '/ko/studies', en: '/en/studies', 'x-default': '/ko/studies' },
    });
  });

  it('홈은 경로가 비어도 트레일링 슬래시를 만들지 않는다', () => {
    expect(alternatesFor('ko')).toMatchObject({ canonical: '/ko' });
    expect(alternatesFor('ko', '/')).toMatchObject({ canonical: '/ko' });
  });

  it('슬래시 없는 경로도 받아준다', () => {
    expect(alternatesFor('ko', 'studies')).toMatchObject({ canonical: '/ko/studies' });
  });
});

describe('pageMetadata', () => {
  it('기본은 루트 template 에 감싸지도록 문자열 title 을 낸다', () => {
    const md = pageMetadata({ locale: 'ko', path: '/studies', title: '스터디', description: '설명' });
    expect(md.title).toBe('스터디');
  });

  it('titleAbsolute 면 template 을 건너뛴다', () => {
    const md = pageMetadata({ locale: 'ko', title: '스터디클럽', description: '설명', titleAbsolute: true });
    expect(md.title).toEqual({ absolute: '스터디클럽' });
  });

  it('noindex 페이지는 robots 를 끈다', () => {
    const md = pageMetadata({ locale: 'ko', path: '/my', title: '내 정보', description: '', noindex: true });
    expect(md.robots).toEqual({ index: false, follow: false });
  });

  it('og:url 은 절대 URL 이다 (상대경로면 크롤러가 해석 못 한다)', () => {
    const md = pageMetadata({ locale: 'en', path: '/studies/foo', title: 'Foo', description: 'bar' });
    expect(md.openGraph?.url).toBe('https://studyclub-plusplus.com/en/studies/foo');
  });
});
