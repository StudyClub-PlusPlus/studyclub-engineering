'use client';

import { useState } from 'react';

import { Checkbox, Input, Select, Textarea } from '@studyclub/ui';

import { useClubPrograms } from '@/features/studies/queries';
import {
  CATEGORY_OPTIONS,
  type ApiStudyDetail,
  type StudyCreatePayload,
  type StudyUpdatePayload,
} from '@/features/studies/types';
import { http } from '@/lib/http';

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
 *
 * **프로그램은 따로 등록하지 않고 이 폼에서 함께 다룬다.** 프로그램은 제목·종류뿐이고 기수 없는 프로그램은
 * 의미가 없다(docs/erd/STUDY_PROGRAM.md). 등록 모드에서는 「새 프로그램」(첫 기수와 함께 만든다) 또는
 * 「기존 클럽의 새 기수」를 고르고, 수정 모드에서는 프로그램과 종류를 읽기 전용으로 보인다 —
 * **종류는 한 번 정하면 바꾸지 못한다.**
 */

export type FormMode = 'create' | 'edit';

export type StudyKind = 'STUDY' | 'CLUB';

export const KIND_LABEL: Record<StudyKind, string> = { STUDY: '스터디', CLUB: '클럽' };

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
  /** 등록에서만 고른다. 수정 모드는 늘 `existing` — 프로그램은 바꾸지 않는다. */
  programMode: 'new' | 'existing';
  /** `existing` 일 때 붙일 프로그램. 빈 문자열이면 아직 안 골랐다. */
  programId: string;
  /** 프로그램 종류. 새 프로그램을 만들 때만 정하고, 그 뒤로는 바꾸지 못한다. */
  kind: StudyKind;
  /** 표시 전용 — 수정 모드에서 어떤 프로그램에 속한 기수인지 보여 준다. 입력 칸이 아니다. */
  programTitle: string;
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
  programMode: 'new',
  programId: '',
  kind: 'STUDY',
  programTitle: '',
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
    programMode: 'existing',
    programId: String(d.programId),
    kind: d.studyKind,
    programTitle: d.programTitle,
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

/**
 * 등록 바디. 프로그램은 **둘 중 하나만** 보낸다 — 새 프로그램이면 `studyKind`, 기존 클럽의 새 기수면
 * `studyProgramId`. 둘을 함께 보내면 서버가 400 으로 거절한다(종류는 한 번 정하면 못 바꾼다).
 *
 * ⚠️ 등록 API 는 아직 정원·진행 시작일·채널/드라이브 주소를 받지 않는다(`StudyCreateRequest`). 그래서 그
 * 칸들은 **등록 요청에 실리지 않고**, 등록 뒤 정보 탭에서 저장해야 한다 — specs/study-registration-spec.md
 * 10절의 남은 항목이다. 보내도 서버가 조용히 버리므로 아예 싣지 않는다.
 */
export function formToCreatePayload(form: StudyFormValues): StudyCreatePayload {
  const payload: StudyCreatePayload = {
    title: form.title.trim(),
    oneLineSummary: form.summary.trim(),
    category: form.category,
    recruitDeadline: deadlineToIso(form.deadline),
  };
  if (form.programMode === 'existing') payload.studyProgramId = Number(form.programId);
  else payload.studyKind = form.kind;
  if (form.description.trim()) payload.description = form.description;
  if (form.schedule.trim()) payload.schedule = form.schedule.trim();
  return payload;
}

export type StudyFormErrors = Partial<Record<keyof StudyFormValues, string>>;

/** 서버 오류 `필드: 사유` 를 어느 칸에 붙일지. 서버 필드 이름과 폼 필드 이름이 다른 것만 적는다. */
const SERVER_FIELD: Record<string, keyof StudyFormValues> = {
  oneLineSummary: 'summary',
  recruitDeadline: 'deadline',
  discordChannelUrl: 'discordUrl',
  studyProgramId: 'programId',
  studyKind: 'kind',
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
  if (f.programMode === 'existing' && !f.programId) e.programId = '기수를 추가할 프로그램을 고르세요.';
  if (!f.title.trim()) e.title = '제목을 입력하세요.';
  else if (f.title.trim().length > 60) e.title = '60자 이내로 입력하세요.';
  if (!f.summary.trim()) e.summary = '한 줄 소개를 입력하세요.';
  if (!f.category) e.category = '카테고리를 선택하세요.';
  if (!f.deadline) e.deadline = '모집 마감일을 입력하세요.';
  if (f.deadline && f.startAt && f.startAt < f.deadline) {
    e.startAt = '진행 시작일은 모집 마감일보다 빠를 수 없어요.';
  }
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

/**
 * 기존 클럽을 고르면 물려받는 값 — 제목은 **프로그램 제목**, 소개·설명·주제는 **최신 기수**의 것이다.
 *
 * 마감일·진행 일정·정원·진행 시작일은 기수마다 달라 비운다. 반대로 **디스코드 채널·드라이브 주소는 물려받는다**
 * — 클럽은 기수가 바뀌어도 채널을 새로 파지 않고 같은 채널을 계속 쓴다(채널은 사실 기수가 아니라 프로그램
 * 단위 자원이다). 새 채널로 바꿨다면 그 칸만 고치면 된다.
 */
function cohortDefaults(latest: ApiStudyDetail): Partial<StudyFormValues> {
  return {
    summary: latest.oneLineSummary,
    description: latest.description ?? '',
    category: latest.category,
    discordUrl: latest.discordChannelUrl ?? '',
    driveUrl: latest.driveUrl ?? '',
  };
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
  const [prefilling, setPrefilling] = useState(false);
  // 등록 모달에서만 부른다 — 정보 탭에서는 고를 일이 없어 요청하지 않는다
  const { data: clubs = [], isLoading } = useClubPrograms(mode === 'create');

  // MVP: 클럽 미지원 — create 모드에서는 프로그램/종류 선택 불필요 (EMPTY_FORM 기본값 사용)
  if (mode === 'create') return null;

  if (mode === 'edit') {
    return (
      <div className='flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-control border border-border bg-surface-2 px-3 py-2.5 text-sm'>
        <span className='font-medium text-neutral-800'>프로그램</span>
        <span className='min-w-0 truncate text-fg-secondary'>{value.programTitle}</span>
        {/* 종류는 정하면 바꾸지 못한다 — 읽기 전용 */}
        <span className='ml-auto text-xs text-fg-muted'>{KIND_LABEL[value.kind]} · 변경할 수 없음</span>
      </div>
    );
  }

  /**
   * 클럽을 고르면 최신 기수를 읽어 폼을 채운다. 프로그램 선택 자체는 먼저 반영해 두고 — 응답을 기다리는
   * 동안에도 고른 것이 보여야 한다 — 값이 오면 덮어쓴다. 최신 기수를 못 읽어도 선택은 유효하다.
   */
  async function selectProgram(programId: string) {
    if (!programId) {
      onChange({ ...value, programId: '', programTitle: '' });
      return;
    }
    const club = clubs.find((c) => String(c.programId) === programId);
    const base: StudyFormValues = {
      ...value,
      programMode: 'existing',
      programId,
      kind: 'CLUB',
      programTitle: club?.title ?? '',
      title: club?.title ?? value.title,
    };
    onChange(base);
    if (!club?.latestStudyId) return;

    setPrefilling(true);
    try {
      const latest = await http<ApiStudyDetail>(`/api/admin/studies/${club.latestStudyId}`);
      onChange({ ...base, ...cohortDefaults(latest) });
    } catch {
      // 못 읽으면 빈 칸으로 둔다 — 운영자가 직접 적으면 되고, 등록을 막을 이유는 없다
    } finally {
      setPrefilling(false);
    }
  }

  const modeBtn = (m: StudyFormValues['programMode'], label: string) => (
    <button
      type='button'
      role='radio'
      aria-checked={value.programMode === m}
      onClick={() =>
        // 모드를 옮기면 이전 모드의 선택을 들고 가지 않는다
        onChange({
          ...value,
          programMode: m,
          programId: '',
          programTitle: '',
          kind: m === 'existing' ? 'CLUB' : 'STUDY',
        })
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
            {(['STUDY', 'CLUB'] as StudyKind[]).map((k) => (
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
          <span className='text-xs text-fg-muted'>
            {value.kind === 'CLUB' ? '이전 기수 참여자가 다음 기수에 이어집니다' : '한 번 모집해 한 번 진행'}
          </span>
        </div>
      ) : (
        <div className='flex flex-col gap-1.5'>
          <select
            aria-label='프로그램 선택'
            value={value.programId}
            onChange={(ev) => void selectProgram(ev.target.value)}
            disabled={isLoading || prefilling}
            className='h-10 rounded-control border border-border-strong bg-bg px-3 text-sm outline-none focus:border-brand'
          >
            <option value=''>{isLoading ? '불러오는 중…' : '클럽을 고르세요'}</option>
            {clubs.map((c) => (
              <option key={c.programId} value={c.programId}>
                {c.title}
              </option>
            ))}
          </select>
          <p className='text-xs text-fg-muted'>
            {prefilling
              ? '최신 기수의 내용을 불러오는 중…'
              : '새 기수를 붙일 수 있는 것은 클럽뿐입니다. 스터디는 기수가 1개이고, 종류는 한 번 정하면 바꿀 수 없습니다.'}
          </p>
          {errors.programId && <p className='text-xs font-medium text-error-600'>{errors.programId}</p>}
        </div>
      )}
    </div>
  );
}

const DATE_INPUT =
  'h-10 w-[9.5rem] shrink-0 rounded-control border border-border-strong bg-bg px-3 text-sm text-neutral-900 outline-none transition-[border-color,box-shadow] focus:border-brand focus:shadow-[var(--ring)]';

export function StudyForm({
  value,
  errors,
  onChange,
  mode = 'create',
}: {
  value: StudyFormValues;
  errors: StudyFormErrors;
  onChange: (next: StudyFormValues) => void;
  /** 등록이면 프로그램을 고르고, 수정이면 읽기 전용으로 보인다. */
  mode?: FormMode;
}) {
  const set = <K extends keyof StudyFormValues>(key: K, v: StudyFormValues[K]) => onChange({ ...value, [key]: v });

  return (
    <div className='flex flex-col gap-3'>
      {/* 어느 프로그램의 기수인지부터 정한다 — 기존 클럽을 고르면 아래 칸들이 채워진다 */}
      <ProgramField mode={mode} value={value} errors={errors} onChange={onChange} />

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
          min={value.deadline || undefined}
          value={value.startAt}
          onChange={(ev) => set('startAt', ev.target.value)}
          className={DATE_INPUT}
          aria-invalid={Boolean(errors.startAt)}
          aria-describedby={errors.startAt ? 'startAt-error' : undefined}
        />
        {errors.startAt ? (
          <p id='startAt-error' className='text-xs font-medium text-error-600'>
            {errors.startAt}
          </p>
        ) : (
          <span className='text-xs text-fg-muted'>모임이 실제로 시작하는 날. 미정이면 비워 둡니다</span>
        )}
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
