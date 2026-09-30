'use client';

import { useRef, type ChangeEvent } from 'react';

import { tx } from '@console/lib/l10n';
import { MARKDOWN_HINT } from '@core/components/ApplicationFormUi';
import {
  STUDY_CATEGORIES,
  categoriesOf,
  latestCohort,
  programs,
  toISODate,
  type Study,
  type StudyKind,
  type StudyTimezone,
} from '@studyclub/mock';
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
 * - 모집 시작일: 마감일만 관리 (모집 상태 판정 축이 마감일 하나) — **진행 시작일과는 다른 값이다.** 진행
 *   시작일(STUDY.START_AT)은 여기서 받는다
 * - 상시 모집: 없다. 마감일은 필수이고, 이어지는 참여는 클럽의 기수 이월로 표현한다
 *
 * **프로그램은 따로 등록하지 않고 이 폼에서 함께 다룬다.** 프로그램은 제목·종류뿐이고 기수 없는 프로그램은
 * 의미가 없다. 등록 모드에서는 「새 프로그램」(첫 기수와 함께 만든다) 또는 「기존 클럽의 새 기수」를 고르고,
 * 수정 모드에서는 프로그램과 종류를 읽기 전용으로 보인다 — **종류는 한 번 정하면 바꾸지 못한다.**
 */

export const KIND_LABEL: Record<StudyKind, string> = { study: '스터디', club: '클럽' };

/** 「미정」을 빈 문자열로 다루는 게 폼 상태 전체와 일관된다 — 다른 선택 입력(주제 제외)도 빈 값이 「안 정함」이다. */
export const TIMEZONE_LABEL: Record<StudyTimezone, string> = { KST: 'KST', PST: 'PST', both: '동시 진행(KST·PST)' };

export type FormMode = 'create' | 'edit';

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
 * 상세 설명 기본 템플릿 — **등록할 때 미리 채워 둔다.** 마크다운을 쓸 수 있다.
 *
 * 빈 칸에서 시작하면 공고마다 항목과 순서가 달라진다. 킥오프·문의처럼 별도 칸이 없는 내용은
 * 「특이사항」에 적는다.
 */
export const DESCRIPTION_TEMPLATE = `## 목표


## 진행 방식


## 참가 대상


## 특이사항
`;

export type StudyFormValues = {
  /** 등록에서만 고른다. 수정 모드는 늘 `existing` — 프로그램은 바꾸지 않는다. */
  programMode: 'new' | 'existing';
  /** `existing` 일 때 붙일 프로그램. */
  programId: string;
  /** 프로그램 종류. 새 프로그램을 만들 때만 정하고, 그 뒤로는 바꾸지 못한다. */
  kind: StudyKind;
  title: string;
  summary: string;
  description: string;
  /** 주제 — 한 개만 고른다. `STUDY.CATEGORY` 는 단일 값이다(다중 카테고리는 지원하지 않는다). */
  category: string;
  deadline: string;
  /**
   * 모집 정원(명). 「제한 없음」을 체크하면 입력을 막고 비운다.
   * 현재 참여자 수는 입력값이 아니라 신청 명부에서 계산되어 목록에 뜬다.
   */
  capacity: string;
  /** 정원 제한 없음. 체크하면 `capacity` 는 늘 빈 값이다. */
  unlimited: boolean;
  /**
   * 모집 때 알리는 일정 문구. 비워 두면 신청 화면에 일정 미정으로 안내한다.
   *
   * 실제로 회차를 만드는 요일·시간은 여기가 아니라 **반**이 갖는다 (크루 탭에서 정한다).
   */
  schedule: string;
  /** STUDY.TIMEZONE. 빈 문자열 = 미정. 「진행 일정」과 달리 KST·PST·동시 진행 중 하나를 고르는 값이다. */
  timezone: StudyTimezone | '';
  /**
   * STUDY.THUMBNAIL_URL. 선택 입력 — 비우면 목록·상세가 주제 기반 기본 이미지를 쓴다.
   * 업로드한 파일의 미리보기 값(blob: URL)이 프로토타입 한정으로 여기 들어간다 — 실제 업로드
   * 엔드포인트가 없어 별도 스토리지에 올리지 못한다. THUMBNAIL_URL 은 VARCHAR(2048)이라 파일을
   * data URL로 직접 넣을 수 없다 — 실제 연동 시엔 presigned-upload 로 받은 짧은 호스팅 URL이어야 한다.
   */
  thumbnail: string;
  /** 진행 시작일(STUDY.START_AT). 모임이 실제로 시작하는 날 — 모집 마감일·「진행 일정」 문구와는 다른 값이다. 선택 입력. */
  startAt: string;
  /** STUDY.DISCORD_CHANNEL_URL. 선택 입력 — 채널을 아직 안 만들었으면 비워 둔다. */
  discordUrl: string;
  /** STUDY.DRIVE_URL. 선택 입력. */
  driveUrl: string;
};

export const EMPTY_FORM: StudyFormValues = {
  programMode: 'new',
  programId: '',
  kind: 'study',
  title: '',
  summary: '',
  description: DESCRIPTION_TEMPLATE,
  category: '',
  deadline: '',
  capacity: '',
  unlimited: true,
  schedule: '',
  timezone: '',
  thumbnail: '',
  startAt: '',
  discordUrl: '',
  driveUrl: '',
};

/**
 * 기존 클럽에 새 기수를 붙일 때의 기본값.
 * 제목은 **프로그램 제목**, 한 줄 소개·상세 설명·주제는 **최신 기수**의 것이다. 마감일·일정·정원·진행 시작일은
 * 기수마다 달라 비운다.
 *
 * **디스코드 채널·드라이브 주소는 비우지 않고 최신 기수 값을 그대로 물려준다.** 클럽은 기수가 바뀌어도
 * 채널을 새로 파지 않고 같은 채널을 계속 쓴다 — 채널은 사실 기수(STUDY)가 아니라 프로그램 단위 자원이다.
 * 새 채널로 바꿨다면 이 값을 직접 고치면 된다.
 */
export function cohortDefaults(programId: string): Partial<StudyFormValues> {
  const program = programs.find((p) => p.id === programId);
  const latest = latestCohort(programId);
  return {
    programId,
    kind: 'club',
    title: program ? tx(program.title) : '',
    ...(latest && {
      summary: tx(latest.summary),
      description: tx(latest.description),
      category: categoriesOf(latest)[0] ?? '',
      // 시간대는 모임이 실제로 도는 기준이라 채널·드라이브와 같은 이유로 최신 기수 값을 물려준다 —
      // 기수가 바뀌었다고 클럽이 갑자기 다른 시간대로 옮겨가지는 않는다.
      timezone: latest.timezone ?? '',
      thumbnail: latest.image ?? '',
      discordUrl: latest.discord_url ?? '',
      driveUrl: latest.driveUrl ?? '',
    }),
  };
}

/** 기존 스터디를 폼 값으로 되돌린다. 화면에 보이는 값과 폼 값이 같아야 편집이 성립한다. */
export function studyToForm(study: Study): StudyFormValues {
  const deadline = toISODate(study.recruitment?.deadline) ?? '';
  return {
    programMode: 'existing',
    programId: study.program?.id ?? '',
    kind: study.program?.kind ?? 'study',
    title: tx(study.title),
    summary: tx(study.summary),
    description: tx(study.description),
    category: categoriesOf(study)[0] ?? '',
    deadline,
    capacity: study.recruitment?.capacity ? String(study.recruitment.capacity) : '',
    unlimited: !study.recruitment?.capacity,
    schedule: tx(study.schedule),
    timezone: study.timezone ?? '',
    thumbnail: study.image ?? '',
    startAt: toISODate(study.startAt) ?? '',
    discordUrl: study.discord_url ?? '',
    driveUrl: study.driveUrl ?? '',
  };
}

export type StudyFormErrors = Partial<Record<keyof StudyFormValues, string>>;

export function validateStudyForm(f: StudyFormValues): StudyFormErrors {
  const e: StudyFormErrors = {};
  if (f.programMode === 'existing' && !f.programId) e.programId = '기수를 추가할 프로그램을 고르세요.';
  if (!f.title.trim()) e.title = '제목을 입력하세요.';
  else if (f.title.trim().length > 60) e.title = '60자 이내로 입력하세요.';
  if (!f.summary.trim()) e.summary = '한 줄 소개를 입력하세요.';
  if (!f.category) e.category = '주제를 선택하세요.';
  if (!f.deadline) e.deadline = '모집 마감일을 입력하세요.';
  if (!f.unlimited && !/^[1-9]\d*$/.test(f.capacity.trim())) e.capacity = '1 이상의 정수로 입력하세요. 제한이 없으면 「제한 없음」을 체크하세요.';
  const isUrl = (v: string) => /^https?:\/\/.+/i.test(v.trim());
  if (f.discordUrl.trim() && !isUrl(f.discordUrl)) e.discordUrl = 'http(s):// 로 시작하는 주소를 입력하세요.';
  if (f.driveUrl.trim() && !isUrl(f.driveUrl)) e.driveUrl = 'http(s):// 로 시작하는 주소를 입력하세요.';
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
  mode = 'create',
}: {
  value: StudyFormValues;
  errors: StudyFormErrors;
  onChange: (next: StudyFormValues) => void;
  mode?: FormMode;
}) {
  const set = <K extends keyof StudyFormValues>(key: K, v: StudyFormValues[K]) => onChange({ ...value, [key]: v });

  return (
    <div className='flex flex-col gap-3'>
      {/*
        **무엇을 만드는지부터 적고 날짜는 마지막에 받는다.** 제목·소개를 쓰기 전에 마감일을 묻는 것은
        운영자가 아직 정하지 않은 것을 먼저 묻는 일이다.
      */}
      <div data-anno='11'>
        <ProgramField mode={mode} value={value} errors={errors} onChange={onChange} />
      </div>

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

      <div data-anno='17'>
        <ThumbnailField value={value.thumbnail} onChange={(next) => set('thumbnail', next)} />
      </div>

      <div data-anno='4'>
        <CategoryField value={value.category} error={errors.category} onChange={(next) => set('category', next)} />
      </div>

      <div data-anno='5'>
        <Textarea
          label='상세 설명'
          rows={8}
          value={value.description}
          onChange={(ev) => set('description', ev.target.value)}
          helper={MARKDOWN_HINT}
        />
      </div>

      <div data-anno='6'>
        <Input
          label='진행 일정'
          value={value.schedule}
          onChange={(ev) => set('schedule', ev.target.value)}
          placeholder='매주 목 20:00 · 8주 과정'
          labelHint={<span data-anno='6-1'>비우면 신청 화면에 일정 미정으로 안내합니다</span>}
        />
      </div>

      <div data-anno='16'>
        <TimezoneField value={value.timezone} onChange={(next) => set('timezone', next)} />
      </div>

      <div className='grid gap-3 sm:grid-cols-2'>
        <div data-anno='7' className='flex flex-col gap-1.5'>
          <label htmlFor='deadline' className='text-sm font-medium text-neutral-800'>
            모집 마감일
            <span className='ml-0.5 text-error-600'>*</span>
          </label>
          <input
            id='deadline'
            type='date'
            value={value.deadline}
            onChange={(ev) => set('deadline', ev.target.value)}
            className='h-10 w-[9.5rem] shrink-0 rounded-control border border-border-strong bg-bg px-3 text-sm text-neutral-900 outline-none transition-[border-color,box-shadow] focus:border-brand focus:shadow-[var(--ring)]'
          />
          {errors.deadline && <p className='text-xs font-medium text-error-600'>{errors.deadline}</p>}
        </div>

        <div data-anno='10'>
          <Input
            label='모집 정원'
            inputMode='numeric'
            value={value.capacity}
            onChange={(ev) => set('capacity', ev.target.value.replace(/[^\d]/g, ''))}
            disabled={value.unlimited}
            placeholder={value.unlimited ? '제한 없음' : '명'}
            error={errors.capacity}
            labelHint={
              <span data-anno='10-1'>
                <Checkbox
                  label='제한 없음'
                  checked={value.unlimited}
                  // 체크하면 입력값을 비운다 — 막아 둔 칸에 숫자가 남아 있으면 저장되는 값이 헷갈린다
                  onChange={(ev) => onChange({ ...value, unlimited: ev.target.checked, capacity: '' })}
                />
              </span>
            }
          />
        </div>
      </div>

      {/*
        진행 시작일은 「모집 마감일」(신청 언제까지)·「진행 일정」(어떤 요일·몇 주짜리인지 알리는 문구)과
        다른 값이다 — 실제로 모임이 시작하는 날짜 하나다. 셋 다 선택 입력이라 등록 시점에 비워도 된다.
      */}
      <div className='grid gap-3 sm:grid-cols-2'>
        <div data-anno='13' className='flex flex-col gap-1.5'>
          <label htmlFor='startAt' className='text-sm font-medium text-neutral-800'>
            진행 시작일
          </label>
          <input
            id='startAt'
            type='date'
            value={value.startAt}
            onChange={(ev) => set('startAt', ev.target.value)}
            className='h-10 w-[9.5rem] shrink-0 rounded-control border border-border-strong bg-bg px-3 text-sm text-neutral-900 outline-none transition-[border-color,box-shadow] focus:border-brand focus:shadow-[var(--ring)]'
          />
          <span className='text-xs text-fg-muted'>모임이 실제로 시작하는 날. 미정이면 비워 둡니다</span>
        </div>
      </div>

      <div data-anno='14'>
        <Input
          label='디스코드 채널 주소'
          value={value.discordUrl}
          onChange={(ev) => set('discordUrl', ev.target.value)}
          placeholder='https://discord.com/channels/…'
          error={errors.discordUrl}
          labelHint={<span data-anno='14-1'>채널을 아직 안 만들었으면 비워 둡니다</span>}
        />
      </div>

      <div data-anno='15'>
        <Input
          label='자료 드라이브 주소'
          value={value.driveUrl}
          onChange={(ev) => set('driveUrl', ev.target.value)}
          placeholder='https://drive.google.com/…'
          error={errors.driveUrl}
        />
      </div>
    </div>
  );
}

/**
 * 썸네일 — **선택 입력.** 목록·상세 카드에 쓸 이미지를 올린다. 비우면 주제 기반 기본 이미지를 쓴다
 * (아래 목록 카드가 늘 그렇게 동작해 왔다 — 이 필드는 그 기본값을 덮어쓰는 자리다).
 *
 * 실제 업로드 엔드포인트가 아직 없다 — 고른 파일은 이 화면 안에서만 보이는 미리보기(`blob:` URL)로
 * 남고, 새로고침하면 사라진다. 실제 연동 시엔 여기서 파일을 스토리지에 먼저 올리고, 돌아온 짧은
 * 호스팅 URL을 `STUDY.THUMBNAIL_URL`(VARCHAR(2048))에 넣어야 한다 — data URL은 못 들어간다.
 */
function ThumbnailField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = ''; // 같은 파일을 다시 골라도 onChange 가 일어나게 비워 둔다
    if (!file) return;
    if (value.startsWith('blob:')) URL.revokeObjectURL(value); // 미리보기 하나만 살아 있으면 된다
    onChange(URL.createObjectURL(file));
  }

  function remove() {
    if (value.startsWith('blob:')) URL.revokeObjectURL(value);
    onChange('');
  }

  return (
    <div className='flex flex-col gap-1.5'>
      <span className='text-sm font-medium text-neutral-800'>썸네일</span>
      <div className='flex items-center gap-3'>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob: 미리보기는 next/image 최적화 대상이 아니다
          <img src={value} alt='' className='h-16 w-16 shrink-0 rounded-control border border-border object-cover' />
        ) : (
          <div className='flex h-16 w-16 shrink-0 items-center justify-center rounded-control border border-dashed border-border-strong text-[11px] text-fg-muted'>
            주제 기본값
          </div>
        )}
        <div className='flex flex-col gap-1'>
          <div className='flex gap-1.5'>
            <button
              type='button'
              onClick={() => inputRef.current?.click()}
              className='h-8 rounded-control border border-border-strong bg-bg px-3 text-[13px] font-medium text-fg-secondary transition-colors hover:bg-surface-2'
            >
              {value ? '다른 이미지로 바꾸기' : '이미지 업로드'}
            </button>
            {value && (
              <button
                type='button'
                onClick={remove}
                className='h-8 rounded-control border border-border-strong bg-bg px-3 text-[13px] font-medium text-fg-secondary transition-colors hover:bg-surface-2'
              >
                제거
              </button>
            )}
          </div>
          <span className='text-xs text-fg-muted'>비우면 주제에 맞는 기본 이미지가 쓰입니다</span>
        </div>
        <input ref={inputRef} type='file' accept='image/*' onChange={pick} className='hidden' />
      </div>
    </div>
  );
}

/**
 * 주제 — **한 개만** 고른다. `STUDY.CATEGORY` 가 단일 값이라 폼도 단일 선택이다(다중 카테고리 미지원).
 *
 * 드롭다운을 쓰지 않는다. 열한 개뿐이라 펼쳐 놔도 스캔하기 어렵지 않고, 고른 것이 그 자리에서
 * 바로 보이는 편이 드롭다운을 열어 확인하는 것보다 빠르다.
 */
function CategoryField({
  value,
  error,
  onChange,
}: {
  value: string;
  error?: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className='flex flex-col gap-1.5'>
      <span className='text-sm font-medium text-neutral-800'>
        주제
        <span className='ml-0.5 text-error-600'>*</span>
      </span>

      <div role='radiogroup' aria-label='주제' className='flex flex-wrap gap-1.5'>
        {STUDY_CATEGORIES.map((c) => {
          const on = value === c;
          return (
            <button
              key={c}
              type='button'
              role='radio'
              aria-checked={on}
              // 이미 고른 것을 다시 누르면 풀리지 않는다 — 주제는 필수라 항상 하나는 고른 상태를 유지한다
              onClick={() => onChange(c)}
              className={`rounded-pill border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                on
                  ? 'border-brand bg-brand text-white'
                  : 'border-border-strong bg-bg text-fg-secondary hover:bg-surface-2'
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

/**
 * 시간대 — **선택 입력.** 「진행 일정」(요일·시간 문구)과는 다른 축이다 — 이건 어느 시간대를
 * 기준으로 도는가 하나만 고르는 값이고, 몇 시인지는 진행 일정이 말한다.
 *
 * 「미정」을 명시적인 선택지로 둔다 — 셋 중 아무거나 강제로 고르게 하면 실제로는 모르는데
 * 아는 것처럼 값이 채워진다. 값이 없으면 사이트에서 「시간대 미정」으로 정직하게 보인다.
 */
function TimezoneField({
  value,
  onChange,
}: {
  value: StudyTimezone | '';
  onChange: (next: StudyTimezone | '') => void;
}) {
  const options: { key: StudyTimezone | ''; label: string }[] = [
    { key: '', label: '미정' },
    { key: 'KST', label: 'KST' },
    { key: 'PST', label: 'PST' },
    { key: 'both', label: '동시 진행(KST·PST)' },
  ];
  return (
    <div className='flex flex-col gap-1.5'>
      <span className='text-sm font-medium text-neutral-800'>시간대</span>
      <div role='radiogroup' aria-label='시간대' className='flex flex-wrap gap-1.5'>
        {options.map((o) => {
          const on = value === o.key;
          return (
            <button
              key={o.key || 'unset'}
              type='button'
              role='radio'
              aria-checked={on}
              onClick={() => onChange(o.key)}
              className={`rounded-pill border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                on
                  ? 'border-brand bg-brand text-white'
                  : 'border-border-strong bg-bg text-fg-secondary hover:bg-surface-2'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <span className='text-xs text-fg-muted'>모임이 실제로 도는 요일·시간은 「진행 일정」에서 문구로 알립니다</span>
    </div>
  );
}

/**
 * 프로그램 — 등록이면 「새 프로그램 / 기존 클럽의 새 기수」, 수정이면 읽기 전용.
 *
 * 종류는 기수마다 다른 값이 아니라 프로그램의 속성이고, **한 번 정하면 바꾸지 못한다.**
 * 새 기수를 붙일 수 있는 것은 클럽뿐이다 — 스터디는 기수가 1개다.
 */
function ProgramField({
  mode,
  value,
  errors,
  onChange,
}: {
  mode: FormMode;
  value: StudyFormValues;
  errors: StudyFormErrors;
  onChange: (next: StudyFormValues) => void;
}) {
  const current = programs.find((p) => p.id === value.programId);

  if (mode === 'edit') {
    return (
      <div className='flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-control border border-border bg-surface-2 px-3 py-2.5 text-sm'>
        <span className='font-medium text-neutral-800'>프로그램</span>
        <span className='min-w-0 truncate text-fg-secondary'>{current ? tx(current.title) : ''}</span>
        {/* 종류는 정하면 바꾸지 못한다 — 읽기 전용 */}
        <span data-anno='12' className='ml-auto text-xs text-fg-muted'>
          {KIND_LABEL[value.kind]} · 변경할 수 없음
        </span>
      </div>
    );
  }

  const clubs = programs.filter((p) => p.kind === 'club');

  const modeBtn = (m: StudyFormValues['programMode'], label: string) => (
    <button
      type='button'
      role='radio'
      aria-checked={value.programMode === m}
      onClick={() =>
        // 모드를 옮기면 이전 모드의 선택을 들고 가지 않는다
        onChange({ ...value, programMode: m, programId: '', kind: m === 'existing' ? 'club' : 'study' })
      }
      className={`h-9 flex-1 rounded-control border px-3 text-sm transition-colors ${
        value.programMode === m
          ? 'border-brand bg-brand/5 font-semibold text-fg'
          : 'border-border-strong text-fg-secondary hover:bg-surface-2'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className='flex flex-col gap-2'>
      <span className='text-sm font-medium text-neutral-800'>
        프로그램
        <span className='ml-0.5 text-error-600'>*</span>
      </span>
      <div role='radiogroup' aria-label='프로그램' className='flex gap-2'>
        {modeBtn('new', '새 프로그램')}
        {modeBtn('existing', '기존 클럽의 새 기수')}
      </div>

      {value.programMode === 'new' ? (
        <div className='flex flex-wrap items-center gap-2 text-sm'>
          <span className='text-xs text-fg-muted'>종류</span>
          <div role='radiogroup' aria-label='종류' className='inline-flex gap-1'>
            {(['study', 'club'] as StudyKind[]).map((k) => (
              <button
                key={k}
                type='button'
                role='radio'
                aria-checked={value.kind === k}
                onClick={() => onChange({ ...value, kind: k })}
                className={`h-8 rounded-pill border px-3 text-[13px] font-medium transition-colors ${
                  value.kind === k
                    ? 'border-brand bg-brand text-white'
                    : 'border-border-strong bg-bg text-fg-secondary hover:bg-surface-2'
                }`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <span data-anno='12-1' className='text-xs text-fg-muted'>
            {value.kind === 'club' ? '이전 기수 참여자가 다음 기수에 이어집니다' : '한 번 모집해 한 번 진행'}
          </span>
        </div>
      ) : (
        <div className='flex flex-col gap-1.5'>
          <select
            aria-label='프로그램 선택'
            value={value.programId}
            // 프로그램을 고르면 제목은 프로그램 제목, 소개·설명·주제는 최신 기수의 것으로 채운다
            onChange={(ev) =>
              onChange(
                ev.target.value
                  ? { ...value, ...cohortDefaults(ev.target.value) }
                  : { ...value, programId: '', kind: 'club' },
              )
            }
            className='h-10 rounded-control border border-border-strong bg-bg px-3 text-sm outline-none focus:border-brand'
          >
            <option value=''>클럽을 고르세요</option>
            {clubs.map((p) => (
              <option key={p.id} value={p.id}>
                {tx(p.title)}
              </option>
            ))}
          </select>
          <p className='text-xs text-fg-muted'>
            새 기수를 붙일 수 있는 것은 클럽뿐입니다. 스터디는 기수가 1개이고, 종류는 한 번 정하면 바꿀 수 없습니다.
          </p>
          {errors.programId && <p className='text-xs font-medium text-error-600'>{errors.programId}</p>}
        </div>
      )}
    </div>
  );
}
