'use client';

import { NOTICE_TAGS, type Notice, type NoticeTag } from '@console/lib/notices';
import { MARKDOWN_HINT } from '@core/components/ApplicationFormUi';
import { Checkbox, Input, Textarea } from '@studyclub/ui';

/**
 * 공지 입력 폼 — **등록 팝업과 편집 팝업이 나눠 쓴다.** 스터디 폼(`StudyForm`)과 같은 규칙이다.
 *
 * 무엇을 쓰는지부터 받는다: 분류 → 제목 → 본문 → 고정. 공개·발행일은 폼에 없다 —
 * 스터디처럼 **등록은 늘 미공개로 끝나고, 목록에서 켠다.**
 */

export const NOTICE_TITLE_RECOMMENDED = 40;

export type NoticeFormValues = {
  tag: NoticeTag | '';
  title: string;
  body: string;
  pinned: boolean;
};

export const EMPTY_NOTICE: NoticeFormValues = { tag: '', title: '', body: '', pinned: false };

export function noticeToForm(n: Notice): NoticeFormValues {
  return { tag: n.tag, title: n.title, body: n.body, pinned: n.pinned };
}

export type NoticeFormErrors = Partial<Record<keyof NoticeFormValues, string>>;

export function validateNoticeForm(f: NoticeFormValues): NoticeFormErrors {
  const e: NoticeFormErrors = {};
  if (!f.tag) e.tag = '분류를 선택하세요.';
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
      {/* 분류는 사이트 목록의 꼬리표다. 스터디 카테고리와 같은 칩 — 하나는 늘 고른 상태 */}
      <div data-anno='notice:2-1' className='flex flex-col gap-1.5'>
        <span className='text-sm font-medium text-neutral-800'>
          분류
          <span className='ml-0.5 text-error-600'>*</span>
        </span>
        <div role='radiogroup' aria-label='분류' className='flex flex-wrap gap-1.5'>
          {NOTICE_TAGS.map((t) => {
            const on = value.tag === t.value;
            return (
              <button
                key={t.value}
                type='button'
                role='radio'
                aria-checked={on}
                onClick={() => set('tag', t.value)}
                className={`rounded-pill border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  on
                    ? 'border-brand bg-brand text-white'
                    : 'border-border-strong bg-bg text-fg-secondary hover:bg-surface-2'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        {errors.tag && <p className='text-xs text-error-700'>{errors.tag}</p>}
      </div>

      <div data-anno='notice:2-2'>
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

      <div data-anno='notice:2-3'>
        <Textarea
          label='본문'
          required
          rows={12}
          value={value.body}
          onChange={(ev) => set('body', ev.target.value)}
          error={errors.body}
          helper={MARKDOWN_HINT}
        />
      </div>

      <div data-anno='notice:2-4'>
        <Checkbox
          label='사이트 공지 목록 맨 위에 고정'
          checked={value.pinned}
          onChange={(ev) => set('pinned', ev.target.checked)}
        />
      </div>
    </div>
  );
}
