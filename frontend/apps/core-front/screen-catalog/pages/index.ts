import type { PageDef } from '../types';

export const pages: PageDef[] = [
  { id: 'home', label: '홈', path: '/ko' },
  { id: 'study-list', label: '스터디 목록', path: '/ko/studies' },
  { id: 'study-detail', label: '스터디 상세', path: '/ko/studies/:id' },
  { id: 'event-list', label: '이벤트 목록', path: '/ko/events' },
  { id: 'event-detail', label: '이벤트 상세', path: '/ko/events/:id' },
  { id: 'login', label: '로그인', path: '/ko/login' },
  { id: 'my', label: '마이페이지', path: '/ko/my' },
  { id: 'my-joined', label: '내 스터디', path: '/ko/my/joined' },
  { id: 'my-joined-schedule', label: '내 스터디 일정', path: '/ko/my/joined/:id/schedule' },
  { id: 'my-joined-attendance', label: '내 스터디 출석', path: '/ko/my/joined/:id/schedule/attendance' },
  { id: 'my-joined-notice', label: '내 스터디 공지', path: '/ko/my/joined/:id/schedule/notice' },
  { id: 'my-saved', label: '찜한 스터디', path: '/ko/my/saved' },
  { id: 'my-leave', label: '회원 탈퇴', path: '/ko/my/leave' },
  { id: 'about', label: '소개', path: '/ko/about' },
  { id: 'guide', label: '이용 가이드', path: '/ko/guide' },
  { id: 'notice-list', label: '공지 목록', path: '/ko/notices' },
  { id: 'notice-detail', label: '공지 상세', path: '/ko/notices/:id' },
  { id: 'terms', label: '이용약관', path: '/ko/terms' },
  { id: 'privacy', label: '개인정보 처리방침', path: '/ko/privacy' },
  { id: 'onboarding', label: '온보딩', path: '/ko/onboarding' },
];
