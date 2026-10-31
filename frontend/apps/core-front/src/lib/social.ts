import type { L10n } from '@/lib/content';
import { IS_INDEXABLE } from '@/lib/seo';

/**
 * 소식 채널 — 행사 열림·스터디 모집 같은 소식을 받아 보고 싶은 사람이 팔로우하는 곳.
 * 합류(스터디 참여)는 디스코드가 맡고, 여기는 **소식 받기**다.
 * href 가 비어 있으면 운영에서는 나오지 않는다. stage·로컬에서는 자리를 확인할 수 있게 「주소 준비 중」으로 보인다.
 * 계정을 열면 주소만 채운다.
 */
export type SocialId = 'youtube' | 'instagram' | 'x' | 'kakao' | 'linkedin';

export const SOCIAL_CHANNELS: { id: SocialId; label: L10n; href: string }[] = [
  // TODO(운영진): 링크드인은 계정을 열면 주소만 채운다
  { id: 'youtube', label: { ko: '유튜브', en: 'YouTube' }, href: 'https://www.youtube.com/@studyclub_life' },
  { id: 'instagram', label: { ko: '인스타그램', en: 'Instagram' }, href: 'https://www.instagram.com/studyclub.life/' },
  { id: 'x', label: { ko: 'X', en: 'X' }, href: 'https://x.com/studyclub_life' },
  { id: 'kakao', label: { ko: '카카오톡 채널', en: 'KakaoTalk channel' }, href: 'https://pf.kakao.com/_CjiSX' },
  { id: 'linkedin', label: { ko: '링크드인', en: 'LinkedIn' }, href: '' },
];

export const activeSocialChannels = () => (IS_INDEXABLE ? SOCIAL_CHANNELS.filter((c) => c.href) : SOCIAL_CHANNELS);
