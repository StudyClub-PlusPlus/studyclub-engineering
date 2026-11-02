import type { MetadataRoute } from 'next';

// 홈 화면에 설치하면 주소창 없이 앱처럼 열린다. iOS 는 이렇게 설치해야만 웹 푸시를 받는다 (specs/web-push/spec.md).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'StudyClub',
    short_name: 'StudyClub',
    description: '함께 배우고 함께 자라는 스터디 클럽',
    start_url: '/',
    display: 'standalone',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
