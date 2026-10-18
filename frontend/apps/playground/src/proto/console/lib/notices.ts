/**
 * 사이트 공지 (콘솔 프로토 mock).
 *
 * 사용자 사이트 공지(`announcements`)와 **같은 데이터**다. 콘솔은 쓰는 쪽, 사이트는 읽는 쪽.
 * **공개 단계가 없다** — 등록하면 곧 사이트에 올라간다. 분류·상단 고정도 두지 않는다 — 제목과 본문뿐.
 * 작성자는 콘솔에만 보인다. 삭제는 소프트 삭제 — 사이트와 콘솔 목록에서 빠지고 행은 남는다(`DELETED_AT`).
 *
 * TODO(api): GET·POST /api/admin/notices · PATCH·DELETE /api/admin/notices/{id}
 */
import { tx } from '@console/lib/l10n';
import { announcements } from '@studyclub/mock';

export type Notice = {
  id: string;
  title: string;
  /** 서식 없는 글 — 줄바꿈만 그대로 살린다 */
  body: string;
  /** 등록한 캡틴. **콘솔에만 보인다** — 사이트에는 내보내지 않는다 */
  author: string;
  /** 등록한 날 = 사이트에 올라간 날 */
  postedAt: string;
  /** 등록한 날이 곧 첫 수정일이다 */
  updatedAt: string;
};

export const seedNotices: Notice[] = announcements.map((a) => ({
  id: a.id,
  title: tx(a.title),
  body: tx(a.body),
  author: 'Alex',
  postedAt: a.date,
  updatedAt: a.date,
}));
