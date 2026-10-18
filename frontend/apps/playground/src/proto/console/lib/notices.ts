/**
 * 사이트 공지 (콘솔 프로토 mock).
 *
 * 사용자 사이트 공지(`announcements`)와 **같은 데이터**다. 콘솔은 쓰고 켜는 쪽, 사이트는 읽는 쪽.
 * 사이트 mock 에는 공개된 것만 있으므로, 콘솔 행은 공개 여부·마지막 수정을 더해 만든다.
 *
 * TODO(api): GET·POST /api/admin/notices · PATCH /api/admin/notices/{id} · 공개 전환
 */
import { tx } from '@console/lib/l10n';
import { announcements, type Announcement } from '@studyclub/mock';


export type NoticeTag = NonNullable<Announcement['tag']>;

export const NOTICE_TAGS: { value: NoticeTag; label: string }[] = [
  { value: 'notice', label: '공지' },
  { value: 'update', label: '업데이트' },
  { value: 'recruit', label: '모집' },
  { value: 'event', label: '행사' },
];

export const NOTICE_TAG_LABEL: Record<string, string> = Object.fromEntries(NOTICE_TAGS.map((t) => [t.value, t.label]));

export type Notice = {
  id: string;
  tag: NoticeTag;
  title: string;
  /** 마크다운 — 스터디 상세 설명과 같은 규칙 */
  body: string;
  /** 사이트 목록 맨 위 */
  pinned: boolean;
  /** 공개된 날. 비어 있으면 미공개 — 등록은 늘 미공개로 끝난다 */
  publishedAt?: string;
  /** 등록한 날이 곧 첫 수정일이다 */
  updatedAt: string;
};

export const seedNotices: Notice[] = announcements.map((a) => ({
  id: a.id,
  tag: a.tag ?? 'notice',
  title: tx(a.title),
  body: tx(a.body),
  pinned: Boolean(a.pinned),
  publishedAt: a.date,
  updatedAt: a.date,
}));
