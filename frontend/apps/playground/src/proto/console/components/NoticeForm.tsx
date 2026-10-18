'use client';

import type { Notice } from '@console/lib/notices';
import { MARKDOWN_HINT } from '@core/components/ApplicationFormUi';
import { Input, Textarea } from '@studyclub/ui';

/**
 * 공지 입력 폼 — **등록 팝업과 편집 팝업이 나눠 쓴다.** 스터디 폼(`StudyForm`)과 같은 규칙이다.
 *
 * 제목과 본문뿐이다. **공개 단계가 없다** — 등록하면 곧 사이트에 올라간다. 분류·상단 고정은 두지 않는다.
 * 작성자는 받지 않는다 — 로그인한 캡틴으로 정해진다.
 */

export const NOTICE_TITLE_RECOMMENDED = 40;

export type NoticeFormValues = { title: string; body: string };

export const EMPTY_NOTICE: NoticeFormValues = { title: '', body: '' };

export function noticeToForm(n: Notice): NoticeFormValues {
  return { title: n.title, body: n.body };
}

export type NoticeFormErrors = Partial<Record<keyof NoticeFormValues, string>>;

export function validateNoticeForm(f: NoticeFormValues): NoticeFormErrors {
  const e: NoticeFormErrors = {};
  if (!f.title.trim()) e.title = '제목을 입력하세요.';
  if (!f.body.trim()) e.body = '본문을 입력하세요.';
  return e;
}

/** 권장 길이 대비 현재 글자수. 넘으면 주황 — 경고일 뿐 저장을 막지 않는다 (스터디 폼과 같다). */
function CharCount({ len, max }: { len: number; max: number }) {
  return <span className={`tnum ${len > max ? 'text-warning-700' : 'text-fg-placeholder'}`}>{len}/{max}</span>;
}

export function NoticeForm({
  value,
  errors,
  onChange,
}: {
  value: NoticeFormValues;
  errors: NoticeFormErrors;
  onChange: (next: NoticeFormValues) => void;
}) {
  const set = <K extends keyof NoticeFormValues>(key: K, v: NoticeFormValues[K]) => onChange({ ...value, [key]: v });

  return (
    <div className='flex flex-col gap-3'>
      <div data-anno='notice:2-1'>
        <Input
          label='제목'
          required
          value={value.title}
          onChange={(ev) => set('title', ev.target.value)}
          placeholder='11월 스터디 모집 안내'
          error={errors.title}
          labelHint={<CharCount len={value.title.trim().length} max={NOTICE_TITLE_RECOMMENDED} />}
        />
      </div>

      <div data-anno='notice:2-2'>
        <Textarea
          label='본문'
          required
          rows={14}
          value={value.body}
          onChange={(ev) => set('body', ev.target.value)}
          error={errors.body}
          helper={MARKDOWN_HINT}
        />
      </div>
    </div>
  );
}
