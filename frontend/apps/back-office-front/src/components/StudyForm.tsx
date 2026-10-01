'use client';

import { Checkbox, Input, Select, Textarea } from '@studyclub/ui';

import { CATEGORY_OPTIONS, type ApiStudyDetail, type StudyUpdatePayload } from '@/features/studies/types';

/**
 * 스터디 입력 폼 — **등록 팝업과 정보 탭이 나눠 쓴다.**
 *
 * 폼을 두 벌 만들면 항목이 갈라져 "등록에는 있는데 수정에는 없는 칸"이 생기고, 운영자는 화면마다
 * 다른 것을 외워야 한다. 여기 하나만 고치면 두 화면이 같이 바뀐다.
 *
 * 항목 구성은 playground 프로토(`proto/console/components/StudyForm.tsx`)를 따른다.
 * 제외 항목과 근거:
 * - 진행 형식(온/오프라인): 전 스터디 온라인 운영이라 선택지가 무의미
 * - 모집 시작일: 마감일만 관리 (모집 상태 판정 축이 마감일 하나) — 진행 시작일과는 다른 값이다
 * - 상시 모집·공개일: 없다. 마감일은 필수이고, 공개는 운영자가 직접 켠다
 * - 시간대·썸네일: 저장할 컬럼·업로드 API 가 아직 없다
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

export type StudyFormValues = {
  title: string;
  summary: string;
  description: string;
  /** API enum 코드 (`AI_ML` 등). */
  category: string;
  /** 모집 마감일 YYYY-MM-DD (KST). 필수. */
  deadline: string;
  /** 모집 정원(명). `unlimited` 이면 늘 빈 값이다. */
  capacity: string;
  unlimited: boolean;
  schedule: string;
  /** 진행 시작일 YYYY-MM-DD (KST). 모임이 실제로 시작하는 날 — 마감일·진행 일정 문구와는 다른 값. */
  startAt: string;
  discordUrl: string;
  driveUrl: string;
};

export const EMPTY_FORM: StudyFormValues = {
  title: '',
  summary: '',
  description: '',
  category: '',
  deadline: '',
  capacity: '',
  unlimited: true,
  schedule: '',
  startAt: '',
  discordUrl: '',
  driveUrl: '',
};

/**
 * 날짜는 **KST 벽시계**로 읽고 쓴다. UTC 로 자르면 한국 오전 9시 이전 값이 하루 앞당겨 보인다.
 * 운영 콘솔은 한국 운영진이 쓰므로 기준을 KST 하나로 둔다.
 */
function toKstDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

/** 마감일은 그날 끝까지 받는다 — 「10월 1일 마감」이면 10월 1일에도 신청할 수 있어야 한다. */
function deadlineToIso(date: string): string {
  return new Date(`${date}T23:59:59+09:00`).toISOString();
}

function startDateToIso(date: string): string {
  return new Date(`${date}T00:00:00+09:00`).toISOString();
}

/** 기존 스터디를 폼 값으로 되돌린다. 화면에 보이는 값과 폼 값이 같아야 편집이 성립한다. */
export function detailToForm(d: ApiStudyDetail): StudyFormValues {
  return {
    title: d.title,
    summary: d.oneLineSummary,
    description: d.description ?? '',
    category: d.category,
    deadline: toKstDate(d.recruitDeadlineAt),
    capacity: d.capacity == null ? '' : String(d.capacity),
    unlimited: d.capacity == null,
    schedule: d.schedule ?? '',
    startAt: toKstDate(d.startAt),
    discordUrl: d.discordChannelUrl ?? '',
    driveUrl: d.driveUrl ?? '',
  };
}

/**
 * 폼에서 **바뀐 칸만** PATCH 바디로 만든다.
 *
 * 전부 보내면 이미 마감이 지난 스터디의 다른 칸을 고칠 때 지난 마감일이 함께 가서 서버가
 * 「마감일은 미래여야 합니다」로 거절한다. 비운 칸은 `null` 로 보내 서버 값도 비운다.
 */
export function formToPayload(form: StudyFormValues, initial: StudyFormValues): StudyUpdatePayload {
  const p: StudyUpdatePayload = {};
  const changed = (key: keyof StudyFormValues) => form[key] !== initial[key];

  if (changed('title')) p.title = form.title.trim();
  if (changed('summary')) p.oneLineSummary = form.summary.trim();
  if (changed('description')) p.description = form.description;
  if (changed('category')) p.category = form.category;
  if (changed('schedule')) p.schedule = form.schedule.trim();
  if (changed('deadline')) p.recruitDeadline = deadlineToIso(form.deadline);
  if (changed('capacity') || changed('unlimited')) {
    p.capacity = form.unlimited ? null : Number(form.capacity.trim());
  }
  if (changed('startAt')) p.startAt = form.startAt ? startDateToIso(form.startAt) : null;
  if (changed('discordUrl')) p.discordChannelUrl = form.discordUrl.trim() || null;
  if (changed('driveUrl')) p.driveUrl = form.driveUrl.trim() || null;
  return p;
}

export type StudyFormErrors = Partial<Record<keyof StudyFormValues, string>>;

/** 서버 오류 `필드: 사유` 를 어느 칸에 붙일지. 서버 필드 이름과 폼 필드 이름이 다른 것만 적는다. */
const SERVER_FIELD: Record<string, keyof StudyFormValues> = {
  oneLineSummary: 'summary',
  recruitDeadline: 'deadline',
  discordChannelUrl: 'discordUrl',
};

/** 서버 검증 메시지(`capacity: 1 이상의 정수여야 합니다.`)를 칸 오류로 바꾼다. 못 바꾸면 null. */
export function serverErrorToField(message: string): StudyFormErrors | null {
  const m = /^(\w+):\s*(.+)$/.exec(message);
  if (!m) return null;
  const field = SERVER_FIELD[m[1]] ?? m[1];
  if (!(field in EMPTY_FORM)) return null;
  return { [field]: m[2] } as StudyFormErrors;
}

const isHttpUrl = (v: string) => /^https?:\/\/\S+$/i.test(v.trim());

export function validateStudyForm(f: StudyFormValues): StudyFormErrors {
  const e: StudyFormErrors = {};
  if (!f.title.trim()) e.title = '제목을 입력하세요.';
  else if (f.title.trim().length > 60) e.title = '60자 이내로 입력하세요.';
  if (!f.summary.trim()) e.summary = '한 줄 소개를 입력하세요.';
  if (!f.category) e.category = '카테고리를 선택하세요.';
  if (!f.deadline) e.deadline = '모집 마감일을 입력하세요.';
  if (!f.unlimited && !/^[1-9]\d*$/.test(f.capacity.trim())) {
    e.capacity = '1 이상의 정수로 입력하세요. 제한이 없으면 「제한 없음」을 체크하세요.';
  }
  if (f.discordUrl.trim() && !isHttpUrl(f.discordUrl)) e.discordUrl = 'http(s):// 로 시작하는 주소를 입력하세요.';
  if (f.driveUrl.trim() && !isHttpUrl(f.driveUrl)) e.driveUrl = 'http(s):// 로 시작하는 주소를 입력하세요.';
  return e;
}

/** 권장 길이 대비 현재 글자수. 넘으면 주황 — 경고일 뿐 저장을 막지 않는다. */
function CharCount({ len, max }: { len: number; max: number }) {
  return (
    <span className={`tnum ${len > max ? 'text-warning-700' : 'text-fg-placeholder'}`}>
      {len}/{max}
    </span>
  );
}

const DATE_INPUT =
  'h-10 w-[9.5rem] shrink-0 rounded-control border border-border-strong bg-bg px-3 text-sm text-neutral-900 outline-none transition-[border-color,box-shadow] focus:border-brand focus:shadow-[var(--ring)]';

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
      {/* 무엇을 만드는지부터 적고 날짜는 뒤에 받는다 */}
      <Input
        label='제목'
        required
        value={value.title}
        onChange={(ev) => set('title', ev.target.value)}
        placeholder='AI 논문 스터디'
        error={errors.title}
        labelHint={<CharCount len={value.title.trim().length} max={TITLE_RECOMMENDED} />}
      />

      <Input
        label='한 줄 소개'
        required
        value={value.summary}
        onChange={(ev) => set('summary', ev.target.value)}
        placeholder='AI 논문을 함께 읽고 토론합니다.'
        error={errors.summary}
        labelHint={<CharCount len={value.summary.trim().length} max={SUMMARY_RECOMMENDED} />}
      />

      <Select
        label='카테고리'
        required
        value={value.category}
        onChange={(ev) => set('category', ev.target.value)}
        error={errors.category}
      >
        <option value=''>선택하세요</option>
        {CATEGORY_OPTIONS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </Select>

      <Textarea
        label='상세 설명'
        rows={6}
        value={value.description}
        onChange={(ev) => set('description', ev.target.value)}
        placeholder='스터디 목표, 진행 방식, 참가 대상, 특이사항을 적어 주세요. 마크다운을 쓸 수 있습니다.'
      />

      <Input
        label='진행 일정'
        value={value.schedule}
        onChange={(ev) => set('schedule', ev.target.value)}
        placeholder='매주 목 20:00 · 8주 과정'
        labelHint='비우면 신청 화면에 일정 미정으로 안내합니다'
      />

      <div className='grid gap-3 sm:grid-cols-2'>
        <div className='flex flex-col gap-1.5'>
          <label htmlFor='deadline' className='text-sm font-medium text-neutral-800'>
            모집 마감일
            <span className='ml-0.5 text-error-600'>*</span>
          </label>
          <input
            id='deadline'
            type='date'
            value={value.deadline}
            onChange={(ev) => set('deadline', ev.target.value)}
            className={DATE_INPUT}
          />
          {errors.deadline && <p className='text-xs font-medium text-error-600'>{errors.deadline}</p>}
        </div>

        <Input
          label='모집 정원'
          inputMode='numeric'
          value={value.capacity}
          onChange={(ev) => set('capacity', ev.target.value.replace(/[^\d]/g, ''))}
          disabled={value.unlimited}
          placeholder={value.unlimited ? '제한 없음' : '명'}
          error={errors.capacity}
          labelHint={
            <Checkbox
              label='제한 없음'
              checked={value.unlimited}
              // 체크하면 입력값을 비운다 — 막아 둔 칸에 숫자가 남아 있으면 저장되는 값이 헷갈린다
              onChange={(ev) => onChange({ ...value, unlimited: ev.target.checked, capacity: '' })}
            />
          }
        />
      </div>

      <div className='flex flex-col gap-1.5'>
        <label htmlFor='startAt' className='text-sm font-medium text-neutral-800'>
          진행 시작일
        </label>
        <input
          id='startAt'
          type='date'
          value={value.startAt}
          onChange={(ev) => set('startAt', ev.target.value)}
          className={DATE_INPUT}
        />
        <span className='text-xs text-fg-muted'>모임이 실제로 시작하는 날. 미정이면 비워 둡니다</span>
      </div>

      <Input
        label='디스코드 채널 주소'
        value={value.discordUrl}
        onChange={(ev) => set('discordUrl', ev.target.value)}
        placeholder='https://discord.com/channels/…'
        error={errors.discordUrl}
        labelHint='채널을 아직 안 만들었으면 비워 둡니다'
      />

      <Input
        label='자료 드라이브 주소'
        value={value.driveUrl}
        onChange={(ev) => set('driveUrl', ev.target.value)}
        placeholder='https://drive.google.com/…'
        error={errors.driveUrl}
      />
    </div>
  );
}
