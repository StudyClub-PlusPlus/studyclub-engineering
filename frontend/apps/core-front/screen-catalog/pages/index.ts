import type { PageDef } from '../types';

export const pages: PageDef[] = [
  { id: 'home', label: '홈', path: '/ko' },
  { id: 'study-list', label: '스터디 목록', path: '/ko/studies' },
  { id: 'study-detail', label: '스터디 상세', path: '/ko/studies/:id' },
  { id: 'event-list', label: '이벤트 목록', path: '/ko/events' },
  { id: 'event-detail', label: '이벤트 상세', path: '/ko/events/:id' },
  { id: 'login', label: '로그인', path: '/ko/login' },
  { id: 'my', label: '마이페이지', path: '/ko/my' },
  { id: 'my-studies', label: '내 스터디', path: '/ko/my/studies' },
  { id: 'about', label: '소개', path: '/ko/about' },
];
