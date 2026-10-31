import type { PageDef } from '../types';

export const pages: PageDef[] = [
  { id: 'login', label: '로그인', path: '/login' },
  { id: 'dashboard', label: '대시보드', path: '/' },
  { id: 'study-list', label: '스터디 목록', path: '/studies' },
  { id: 'study-detail', label: '스터디 상세 (크루 관리)', path: '/studies/:id' },
  { id: 'event-list', label: '이벤트 목록', path: '/events' },
  { id: 'user-list', label: '회원 목록', path: '/users' },
  { id: 'notifications', label: '알림 발송 이력', path: '/notifications' },
  { id: 'notification-templates', label: '알림 템플릿', path: '/notification-templates' },
  { id: 'notices', label: '공지 관리', path: '/notices' },
];
