'use client';

import { Input, Textarea } from '@studyclub/ui';

import type { SiteNoticePayload } from '@/features/site-notices/types';

/** 공지 입력 폼 — 제목·본문. 등록 팝업과 편집 팝업이 나눠 쓴다. */

/** 화면 권장 길이. 서버 상한(200)과 다르다 — 넘어도 저장은 된다. */
export const NOTICE_TITLE_RECOMMENDED = 40;

export const EMPTY_NOTICE: SiteNoticePayload = { title: '', body: '' };

export type SiteNoticeFormErrors = Partial<Record<keyof SiteNoticePayload, string>>;

/** 서버 검증 메시지(`title: 제목은 200자까지입니다.`)를 칸 오류로 바꾼다. 못 바꾸면 null. */
export function serverErrorToNoticeField(message: string): SiteNoticeFormErrors | null {
  const m = /^(title|body):\s*(.+)$/.exec(message);
  if (!m) return null;
  return { [m[1]]: m[2] } as SiteNoticeFormErrors;
}

/** 권장 길이 대비 현재 글자수. 넘으면 주황 — 경고일 뿐 저장을 막지 않는다. */
function CharCount({ len, max }: { len: number; max: number }) {
  let tone = 'text-fg-placeholder';
  if (len > max) tone = 'text-warning-700';
  return (
    <span className={`tnum ${tone}`}>
      {len}/{max}
    </span>
  );
}

export function SiteNoticeForm({
  value,
  errors,
  onChange,
}: {
  value: SiteNoticePayload;
  errors: SiteNoticeFormErrors;
  onChange: (next: SiteNoticePayload) => void;
}) {
  const set = <K extends keyof SiteNoticePayload>(key: K, v: SiteNoticePayload[K]) => onChange({ ...value, [key]: v });

  return (
    <div className='flex flex-col gap-3'>
      <Input
        label='제목'
        required
        value={value.title}
        onChange={(ev) => set('title', ev.target.value)}
        placeholder='11월 스터디 모집 안내'
        error={errors.title}
        labelHint={<CharCount len={value.title.trim().length} max={NOTICE_TITLE_RECOMMENDED} />}
      />
      <Textarea
        label='본문'
        required
        rows={14}
        value={value.body}
        onChange={(ev) => set('body', ev.target.value)}
        error={errors.body}
        helper='서식 없이 줄바꿈만 그대로 보입니다'
      />
    </div>
  );
}
