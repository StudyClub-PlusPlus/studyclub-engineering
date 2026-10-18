import type { L10n } from '@/lib/content';

/**
 * 소식 채널 — 행사 열림·스터디 모집 같은 소식을 받아 보고 싶은 사람이 팔로우하는 곳.
 * 합류(스터디 참여)는 디스코드가 맡고, 여기는 **소식 받기**다.
 * href 가 비어 있으면 화면에 나오지 않는다. 계정을 열면 주소만 채운다.
 */
export type SocialId = 'instagram' | 'x' | 'kakao' | 'linkedin';

export const SOCIAL_CHANNELS: { id: SocialId; label: L10n; href: string }[] = [
  // TODO(운영진): 계정 주소
  { id: 'instagram', label: { ko: '인스타그램', en: 'Instagram' }, href: '' },
  { id: 'x', label: { ko: 'X', en: 'X' }, href: '' },
  { id: 'kakao', label: { ko: '카카오톡 채널', en: 'KakaoTalk channel' }, href: '' },
  { id: 'linkedin', label: { ko: '링크드인', en: 'LinkedIn' }, href: '' },
];

export const activeSocialChannels = () => SOCIAL_CHANNELS.filter((c) => c.href);
