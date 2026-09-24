'use client';

import { tx } from '@console/lib/l10n';
import { STUDY_CATEGORIES, categoriesOf, toISODate, type Study } from '@studyclub/mock';
import { Checkbox, Input, Textarea } from '@studyclub/ui';

/**
 * 스터디 입력 폼 — **등록 팝업과 정보 탭이 나눠 쓴다.**
 *
 * 폼을 두 벌 만들면 항목이 갈라져 "등록에는 있는데 수정에는 없는 칸"이 생기고, 운영자는 화면마다
 * 다른 것을 외워야 한다. 여기 하나만 고치면 두 화면이 같이 바뀐다.
 *
 * 제외 항목과 근거:
 * - 진행 형식(온/오프라인): 전 스터디 온라인 운영이라 선택지가 무의미
 * - 신청 링크: 사이트 자체가 신청 창구. 외부 폼 링크를 받지 않음
 * - 모집 시작일: 마감일만 관리 (모집 상태 판정 축이 마감일 하나)
 */

/**
 * 카드 제목 권장 길이 = **말줄임이 나지 않는 최대 글자수**.
 *
 * 근거: 카드 제목 영역 315px · 24px extrabold · 2줄 clamp 조건에서
 * 무작위 한글 제목 5,000건을 렌더해 측정 → 25자부터 3줄로 넘어가 말줄임 발생,
 * 24자까지는 초과 0건. 어절이 길수록(띄어쓰기가 적을수록) 먼저 넘친다.
 */
export const TITLE_RECOMMENDED = 24;
/** 카드 한 줄 소개가 줄바꿈 없이 한 줄로 유지되는 최대 글자수. */
export const SUMMARY_RECOMMENDED = 25;

/**
 * 한 스터디가 달 수 있는 주제 수.
 *
 * 셋을 넘기면 목록에서 스터디 이름보다 주제가 넓어지고, 「이 스터디가 무슨 분야인가」라는
 * 질문에 답이 없어진다. 다 고르는 것은 아무것도 안 고른 것과 같다.
 */
export const CATEGORY_MAX = 3;

export type StudyFormValues = {
  title: string;
  summary: string;
  description: string;
  /** 고른 주제. 한 스터디가 여러 분야에 걸칠 수 있어 목록으로 받는다. */
  categories: string[];
  deadline: string;
  alwaysOpen: boolean;
  /**
   * 모집 때 알리는 일정 문구. 비워 두면 신청 화면에 일정 미정으로 안내한다.
   *
   * 실제로 회차를 만드는 요일·시간은 여기가 아니라 **반**이 갖는다 (크루 탭에서 정한다).
   */
  schedule: string;
};

export const EMPTY_FORM: StudyFormValues = {
  title: '',
  summary: '',
  description: '',
  categories: [],
  deadline: '',
  alwaysOpen: false,
  schedule: '',
};

/** 기존 스터디를 폼 값으로 되돌린다. 화면에 보이는 값과 폼 값이 같아야 편집이 성립한다. */
export function studyToForm(study: Study): StudyFormValues {
  const deadline = toISODate(study.recruitment?.deadline) ?? '';
  return {
    title: tx(study.title),
    summary: tx(study.summary),
    description: tx(study.description),
    categories: categoriesOf(study),
    deadline,
    alwaysOpen: !deadline,
    schedule: tx(study.schedule),
  };
}

export type StudyFormErrors = Partial<Record<keyof StudyFormValues, string>>;

export function validateStudyForm(f: StudyFormValues): StudyFormErrors {
  const e: StudyFormErrors = {};
  if (!f.title.trim()) e.title = '제목을 입력하세요.';
  else if (f.title.trim().length > 60) e.title = '60자 이내로 입력하세요.';
  if (!f.summary.trim()) e.summary = '한 줄 소개를 입력하세요.';
  if (f.categories.length === 0) e.categories = '주제를 하나 이상 고르세요.';
  else if (f.categories.length > CATEGORY_MAX) e.categories = `최대 ${CATEGORY_MAX}개까지 고를 수 있습니다.`;
  return e;
}

/** 권장 길이 대비 현재 글자수. 넘으면 주황 — 경고일 뿐 저장을 막지 않는다. */
function CharCount({ len, max, anno }: { len: number; max: number; anno?: string }) {
  return (
    <span data-anno={anno} className={`tnum ${len > max ? 'text-warning-700' : 'text-fg-placeholder'}`}>
      {len}/{max}
    </span>
  );
}

export function StudyForm({
  value,
  errors,
  onChange,
}: {
  value: StudyFormValues;
  errors: StudyFormErrors;
  onChange: (next: StudyFormValues) => void;
}) {
  const set = <K extends keyof StudyFormValues>(key: K, v: StudyFormValues[K]) => onChange({ ...value, [key]: v });

  return (
    <div className='flex flex-col gap-3'>
      {/*
        **무엇을 만드는지부터 적고 날짜는 마지막에 받는다.** 제목·소개를 쓰기 전에 마감일을 묻는 것은
        운영자가 아직 정하지 않은 것을 먼저 묻는 일이다.
      */}
      <div data-anno='2'>
        <Input
          label='제목'
          required
          value={value.title}
          onChange={(ev) => set('title', ev.target.value)}
          placeholder='AI 논문 스터디'
          error={errors.title}
          labelHint={<CharCount anno='2-1' len={value.title.trim().length} max={TITLE_RECOMMENDED} />}
        />
      </div>

      <div data-anno='3'>
        <Input
          label='한 줄 소개'
          required
          value={value.summary}
          onChange={(ev) => set('summary', ev.target.value)}
          placeholder='AI 논문을 함께 읽고 토론합니다.'
          error={errors.summary}
          labelHint={<CharCount anno='3-1' len={value.summary.trim().length} max={SUMMARY_RECOMMENDED} />}
        />
      </div>

      <div data-anno='4'>
        <CategoryField
          value={value.categories}
          error={errors.categories}
          onChange={(next) => set('categories', next)}
        />
      </div>

      <div data-anno='5'>
        <Textarea
          label='상세 설명'
          rows={4}
          value={value.description}
          onChange={(ev) => set('description', ev.target.value)}
          placeholder='스터디 목표, 진행 방식, 준비물, 대상 등을 자유롭게 작성하세요.'
        />
      </div>

      <div data-anno='6'>
        <Input
          label='진행 일정'
          value={value.schedule}
          onChange={(ev) => set('schedule', ev.target.value)}
          placeholder='2026.11-2026.12'
          labelHint={<span data-anno='6-1'>비우면 신청 화면에 일정 미정으로 안내합니다</span>}
        />
      </div>

      <div className='grid gap-3 sm:grid-cols-2'>
        <div data-anno='7' className='flex flex-col gap-1.5'>
          <label htmlFor='deadline' className='text-sm font-medium text-neutral-800'>
            모집 마감일
          </label>
          <div className='flex items-center gap-3'>
            <input
              id='deadline'
              type='date'
              value={value.deadline}
              disabled={value.alwaysOpen}
              onChange={(ev) => set('deadline', ev.target.value)}
              className='h-10 w-[9.5rem] shrink-0 rounded-control border border-border-strong bg-bg px-3 text-sm text-neutral-900 outline-none transition-[border-color,box-shadow] focus:border-brand focus:shadow-[var(--ring)] disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-neutral-400'
            />
            <div data-anno='7-1'>
              <Checkbox
                label='상시 모집'
                checked={value.alwaysOpen}
                onChange={(ev) => {
                  const on = ev.target.checked;
                  onChange({ ...value, alwaysOpen: on, deadline: on ? '' : value.deadline });
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 주제 — 여러 개 고른다.
 *
 * 드롭다운을 쓰지 않는다. 고른 것이 접혀 보이지 않으면 몇 개를 골랐는지 매번 펼쳐 확인해야 한다.
 */
function CategoryField({
  value,
  error,
  onChange,
}: {
  value: string[];
  error?: string;
  onChange: (next: string[]) => void;
}) {
  const full = value.length >= CATEGORY_MAX;

  function toggle(c: string) {
    onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);
  }

  return (
    <div className='flex flex-col gap-1.5'>
      <div className='flex items-baseline gap-2'>
        <span className='text-sm font-medium text-neutral-800'>
          주제
          <span className='ml-0.5 text-error-600'>*</span>
        </span>
        <span data-anno='2-1' className='text-xs text-fg-muted'>
          최대 {CATEGORY_MAX}개
        </span>
        <span className='tnum ml-auto text-xs text-fg-placeholder'>
          {value.length}/{CATEGORY_MAX}
        </span>
      </div>

      <div className='flex flex-wrap gap-1.5'>
        {STUDY_CATEGORIES.map((c) => {
          const on = value.includes(c);
          return (
            <button
              key={c}
              type='button'
              aria-pressed={on}
              // 이미 최대만큼 골랐으면 나머지는 누를 수 없다 — 눌러 놓고 거절당하는 것보다 낫다
              disabled={!on && full}
              onClick={() => toggle(c)}
              className={`rounded-pill border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                on
                  ? 'border-brand bg-brand text-white'
                  : 'border-border-strong bg-bg text-fg-secondary hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-fg-placeholder disabled:hover:bg-bg'
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      {error && <p className='text-xs font-medium text-error-600'>{error}</p>}
    </div>
  );
}
