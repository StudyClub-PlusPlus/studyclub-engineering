'use client';

import { useEffect, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Checkbox, Input, Select, Textarea, useImageUpload } from '@studyclub/ui';
import { useForm } from 'react-hook-form';

import {
  EMPTY_FORM,
  FormMode,
  KIND_LABEL,
  SUMMARY_RECOMMENDED,
  StudyFormErrors,
  StudyFormValues,
  StudyKind,
  TITLE_RECOMMENDED,
  studyFormSchema,
} from '@/features/studies/form-schema';
import { useClubPrograms } from '@/features/studies/queries';
import { studyDetail } from '@/features/studies/repository';
import { CATEGORY_OPTIONS, type ApiStudyDetail, type StudyTimezone } from '@/features/studies/types';
import { ApiError } from '@/lib/http';
import { uploadImage } from '@/lib/upload';

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
 *
 * **프로그램은 따로 등록하지 않고 이 폼에서 함께 다룬다.** 프로그램은 제목·종류뿐이고 기수 없는 프로그램은
 * 의미가 없다(docs/erd/STUDY_PROGRAM.md). 등록 모드에서는 「새 프로그램」(첫 기수와 함께 만든다) 또는
 * 「기존 클럽의 새 기수」를 고르고, 수정 모드에서는 프로그램과 종류를 읽기 전용으로 보인다 —
 * **종류는 한 번 정하면 바꾸지 못한다.**
 */

/** 공유 입력 컴포넌트의 일괄 변경(프로그램 기본값·업로드)도 RHF 상태에 반영한다. */
export function useStudyForm(initial: StudyFormValues) {
  const methods = useForm<StudyFormValues>({
    resolver: zodResolver(studyFormSchema),
    defaultValues: initial,
    reValidateMode: 'onSubmit',
  });
  const value = methods.watch();
  const { errors: fieldErrors, isDirty } = methods.formState;
  const errors: StudyFormErrors = Object.fromEntries(
    Object.entries(fieldErrors).map(([key, error]) => [key, error?.message]),
  );
  function change(next: StudyFormValues) {
    for (const key of Object.keys(next) as (keyof StudyFormValues)[]) {
      if (methods.getValues(key) !== next[key]) methods.setValue(key, next[key], { shouldDirty: true });
    }
  }
  function setServerErrors(next: StudyFormErrors) {
    methods.clearErrors();
    for (const key of Object.keys(next) as (keyof StudyFormValues)[]) {
      methods.setError(key, { type: 'server', message: next[key] });
    }
  }
  return { ...methods, value, errors, isDirty, change, setServerErrors };
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
 * 단위 자원이다). 새 채널로 바꿨다면 그 칸만 고치면 된다. **시간대도 같은 이유로 물려받는다** — 기수가
 * 바뀌었다고 클럽이 다른 시간대로 옮겨가지는 않는다.
 */
/**
 * 클럽의 「다음 기수 만들기」가 여는 폼 (정보 탭 명세 1-2) — 프로그램은 이 클럽으로 정해져 있고,
 * 제목은 프로그램 제목, 한 줄 소개 · 상세 설명 · 카테고리 · 시간대 · 채널 · 드라이브는 최신 기수의 것으로 채운다.
 * 모집 마감일 · 진행 일정 · 정원 · 진행 시작일은 기수마다 달라 비워 둔다.
 */
export function nextCohortForm(latest: ApiStudyDetail): StudyFormValues {
  return {
    ...EMPTY_FORM,
    programMode: 'existing',
    programId: String(latest.programId),
    kind: 'CLUB',
    programTitle: latest.programTitle,
    title: latest.programTitle,
    ...cohortDefaults(latest),
  };
}

function cohortDefaults(latest: ApiStudyDetail): Partial<StudyFormValues> {
  return {
    summary: latest.oneLineSummary,
    description: latest.description ?? '',
    category: latest.category,
    discordUrl: latest.discordChannelUrl ?? '',
    driveUrl: latest.driveUrl ?? '',
    timezone: latest.timezone ?? '',
  };
}

const TIMEZONE_OPTIONS: { key: StudyTimezone | ''; label: string }[] = [
  { key: '', label: '미정' },
  { key: 'KST', label: 'KST' },
  { key: 'PST', label: 'PST' },
  { key: 'BOTH', label: '동시 진행(KST·PST)' },
];

/**
 * 시간대 — **선택 입력.** 「진행 일정」(요일·시간 문구)과는 다른 축이다 — 어느 시간대를 기준으로
 * 도는가 하나만 고르고, 몇 시인지는 진행 일정이 말한다.
 *
 * 「미정」을 명시적인 선택지로 둔다 — 셋 중 하나를 강제하면 모르는데 아는 것처럼 값이 채워진다.
 */
function TimezoneField({
  value,
  onChange,
}: {
  value: StudyTimezone | '';
  onChange: (next: StudyTimezone | '') => void;
}) {
  return (
    <div className='flex flex-col gap-1.5'>
      <span className='type-label-lg text-neutral-800'>시간대</span>
      <div role='radiogroup' aria-label='시간대' className='flex flex-wrap gap-1'>
        {TIMEZONE_OPTIONS.map((o) => (
          <button
            key={o.key || 'unset'}
            type='button'
            role='radio'
            aria-checked={value === o.key}
            onClick={() => onChange(o.key)}
            className={`h-8 rounded-pill border px-3 type-label-lg transition-colors ${
              value === o.key
                ? 'border-brand bg-brand text-white'
                : 'border-border bg-bg text-fg-secondary hover:border-border-interactive hover:bg-surface-2'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <span className='type-label-sm text-fg-muted'>모임이 실제로 도는 요일·시간은 「진행 일정」에 적습니다</span>
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
  const [prefilling, setPrefilling] = useState(false);
  // 등록 모달에서만 부른다 — 정보 탭에서는 고를 일이 없어 요청하지 않는다
  const { data: clubs = [], isLoading } = useClubPrograms(mode === 'create');

  if (mode === 'edit' || mode === 'next') {
    return (
      <div className='flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-control border border-border bg-surface-2 px-3 py-2.5 type-body-sm'>
        <span className='font-semibold text-neutral-800'>프로그램</span>
        <span className='min-w-0 truncate text-fg-secondary'>{value.programTitle}</span>
        {/* 종류는 정하면 바꾸지 못한다 — 읽기 전용. 다음 기수는 이 클럽에 붙는다 */}
        <span className='ml-auto type-label-sm text-fg-muted'>
          {mode === 'next' ? `${KIND_LABEL[value.kind]}의 새 기수` : `${KIND_LABEL[value.kind]} · 변경할 수 없음`}
        </span>
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
      const latest = await studyDetail(club.latestStudyId);
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
      className={`h-9 flex-1 rounded-control border px-3 type-label-lg transition-colors ${
        value.programMode === m
          ? 'border-brand bg-brand/5 font-semibold text-fg'
          : 'border-border text-fg-secondary hover:border-border-interactive hover:bg-surface-2'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className='flex flex-col gap-2'>
      <span className='type-label-lg text-neutral-800'>
        프로그램
        <span className='ml-0.5 text-error-600'>*</span>
      </span>
      <div role='radiogroup' aria-label='프로그램' className='flex gap-2'>
        {modeBtn('new', '새 프로그램')}
        {modeBtn('existing', '기존 클럽의 새 기수')}
      </div>

      {value.programMode === 'new' ? (
        <div className='flex flex-wrap items-center gap-2 type-body-sm'>
          <span className='type-label-sm text-fg-muted'>종류</span>
          <div role='radiogroup' aria-label='종류' className='inline-flex gap-1'>
            {(['STUDY', 'CLUB'] as StudyKind[]).map((k) => (
              <button
                key={k}
                type='button'
                role='radio'
                aria-checked={value.kind === k}
                onClick={() => onChange({ ...value, kind: k })}
                className={`h-8 rounded-pill border px-3 type-label-lg transition-colors ${
                  value.kind === k
                    ? 'border-brand bg-brand text-white'
                    : 'border-border bg-bg text-fg-secondary hover:border-border-interactive hover:bg-surface-2'
                }`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <span className='type-label-sm text-fg-muted'>
            {value.kind === 'CLUB' ? '이전 기수 참여자가 다음 기수에 이어집니다' : '한 번 모집해 한 번 진행'}
          </span>
        </div>
      ) : (
        <div className='flex flex-col gap-1.5'>
          <Select
            aria-label='프로그램 선택'
            value={value.programId}
            onChange={(ev) => void selectProgram(ev.target.value)}
            disabled={isLoading || prefilling}
          >
            <option value=''>{isLoading ? '불러오는 중…' : '클럽을 고르세요'}</option>
            {clubs.map((c) => (
              <option key={c.programId} value={c.programId}>
                {c.title}
              </option>
            ))}
          </Select>
          <p className='type-label-sm text-fg-muted'>
            {prefilling
              ? '최신 기수의 내용을 불러오는 중…'
              : '새 기수를 붙일 수 있는 것은 클럽뿐입니다. 스터디는 기수가 1개이고, 종류는 한 번 정하면 바꿀 수 없습니다.'}
          </p>
          {errors.programId && <p className='type-label-sm text-error-600'>{errors.programId}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * 썸네일 — 고르면 바로 올리고(번호 받기) 미리보기를 띄운다. 스터디에 붙는 건 「저장」 때다.
 * 올리기만 하고 저장하지 않으면 서버가 하루 뒤 지운다 (docs/flows/image-upload.md).
 */
function ThumbnailField({
  value,
  error,
  onChange,
  onUploadingChange,
}: {
  value: StudyFormValues;
  error?: string;
  onChange: (next: StudyFormValues) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  // 올리는 동안 다른 칸을 고쳐도 덮어쓰지 않게 — 올리기가 끝난 시점의 폼 값에 썸네일만 얹는다
  const latest = useRef(value);
  latest.current = value;
  const thumb = useImageUpload({
    purpose: 'STUDY_THUMBNAIL',
    upload: uploadImage,
    onUploaded: ({ fileId, url }) => onChange({ ...latest.current, thumbnailFileId: fileId, thumbnailUrl: url }),
    onError: (err) =>
      err instanceof ApiError ? err.message : '썸네일을 올리지 못했습니다. 잠시 후 다시 시도해 주세요',
  });
  const shown = thumb.error ?? error;

  useEffect(() => {
    onUploadingChange?.(thumb.isUploading);
    return () => onUploadingChange?.(false);
  }, [thumb.isUploading, onUploadingChange]);

  return (
    <div className='flex flex-col gap-1.5'>
      <span className='type-label-lg text-fg'>썸네일</span>
      <div className='flex items-center gap-3'>
        {value.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- 업로드 직후 URL 미리보기
          <img
            src={value.thumbnailUrl}
            alt=''
            className='h-16 w-16 shrink-0 rounded-control border border-border object-cover'
          />
        ) : (
          <div className='flex h-16 w-16 shrink-0 items-center justify-center rounded-control border border-dashed border-border-strong text-center type-label-sm text-fg-muted'>
            {/* flex 상자 안이라 글과 <br /> 이 따로 놓이지 않게 한 덩이로 감싼다 */}
            <span>
              카테고리
              <br />
              기본값
            </span>
          </div>
        )}
        <div className='flex flex-col gap-1'>
          <div className='flex gap-1.5'>
            <button
              type='button'
              onClick={thumb.pick}
              disabled={thumb.isUploading}
              className='h-8 rounded-control border border-border-strong bg-bg px-3 type-label-lg text-fg-secondary transition-colors hover:bg-surface-2 disabled:opacity-50'
            >
              {thumb.isUploading ? '올리는 중' : value.thumbnailUrl ? '다른 이미지로 바꾸기' : '이미지 업로드'}
            </button>
            {value.thumbnailUrl && (
              <button
                type='button'
                onClick={() => onChange({ ...value, thumbnailUrl: '', thumbnailFileId: null })}
                disabled={thumb.isUploading}
                className='h-8 rounded-control border border-border-strong bg-bg px-3 type-label-lg text-fg-secondary transition-colors hover:bg-surface-2 disabled:opacity-50'
              >
                제거
              </button>
            )}
          </div>
          <span className='type-label-sm text-fg-muted'>비우면 카테고리에 맞는 기본 이미지가 쓰입니다</span>
        </div>
        <input {...thumb.inputProps} className='hidden' aria-label='썸네일 파일' />
      </div>
      {shown && (
        <p role='alert' className='type-label-sm text-error-700'>
          {shown}
        </p>
      )}
    </div>
  );
}

const MARKDOWN_HINT =
  '마크다운을 쓸 수 있습니다: # 제목, **굵게**, *기울임*, ~~취소선~~, `코드`, [링크](url), 1. 순서 목록, - 목록';

/**
 * 카테고리 — **한 개만** 고른다(`STUDY.CATEGORY` 는 단일 값). playground 프로토와 같이 칩으로 펼쳐 둔다 —
 * 열한 개뿐이라 드롭다운을 열어 확인하는 것보다 고른 것이 그 자리에서 보이는 편이 빠르다.
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
      <span className='type-label-lg text-neutral-800'>
        카테고리
        <span className='ml-0.5 text-error-600'>*</span>
      </span>
      <div role='radiogroup' aria-label='카테고리' className='flex flex-wrap gap-1.5'>
        {CATEGORY_OPTIONS.map((c) => {
          const on = value === c.value;
          return (
            <button
              key={c.value}
              type='button'
              role='radio'
              aria-checked={on}
              // 이미 고른 것을 다시 누르면 풀리지 않는다 — 카테고리는 필수다
              onClick={() => onChange(c.value)}
              className={`rounded-pill border px-3 py-1.5 type-label-lg transition-colors ${
                on
                  ? 'border-brand bg-brand text-white'
                  : 'border-border-strong bg-bg text-fg-secondary hover:bg-surface-2'
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      {error && <p className='type-label-sm text-error-600'>{error}</p>}
    </div>
  );
}

const DATE_INPUT =
  'h-10 w-full rounded-control border border-border bg-bg px-3 type-body-sm text-neutral-900 outline-none transition-[border-color,box-shadow] focus:border-border-interactive focus:shadow-[var(--ring)]';

export function StudyForm({
  value,
  errors,
  onChange,
  onUploadingChange,
  mode = 'create',
}: {
  value: StudyFormValues;
  errors: StudyFormErrors;
  onChange: (next: StudyFormValues) => void;
  onUploadingChange?: (uploading: boolean) => void;
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

      <ThumbnailField
        value={value}
        error={errors.thumbnailUrl}
        onChange={onChange}
        onUploadingChange={onUploadingChange}
      />

      <CategoryField value={value.category} error={errors.category} onChange={(next) => set('category', next)} />

      <Textarea
        label='상세 설명'
        rows={8}
        value={value.description}
        onChange={(ev) => set('description', ev.target.value)}
        helper={MARKDOWN_HINT}
      />

      <Input
        label='진행 일정'
        value={value.schedule}
        onChange={(ev) => set('schedule', ev.target.value)}
        placeholder='매주 목 20:00 · 8주 과정'
        labelHint='비우면 신청 화면에 일정 미정으로 안내합니다'
      />

      <TimezoneField value={value.timezone} onChange={(next) => set('timezone', next)} />

      <div className='grid gap-3 sm:grid-cols-2'>
        <div className='flex flex-col gap-1.5'>
          <label htmlFor='deadline' className='type-label-lg text-neutral-800'>
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
          {errors.deadline && <p className='type-label-sm text-error-600'>{errors.deadline}</p>}
        </div>

        <Input
          label='모집 정원'
          inputMode='numeric'
          value={value.capacity}
          onChange={(ev) => set('capacity', ev.target.value.replace(/[^\d]/g, ''))}
          disabled={value.unlimited}
          placeholder={value.unlimited ? '제한 없음' : undefined}
          // 「제한 없음」을 풀면 숫자 뒤에 단위를 붙여 둔다
          suffix={value.unlimited ? undefined : '명'}
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

      {/* 모집 마감일과 같은 두 칸 그리드 — 왼쪽 칸에 서서 마감일과 너비가 같다 */}
      <div className='grid gap-3 sm:grid-cols-2'>
        <div className='flex flex-col gap-1.5'>
          <label htmlFor='startAt' className='type-label-lg text-neutral-800'>
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
            <p id='startAt-error' className='type-label-sm text-error-600'>
              {errors.startAt}
            </p>
          ) : (
            <span className='type-label-sm text-fg-muted'>모임이 실제로 시작하는 날. 미정이면 비워 둡니다</span>
          )}
        </div>
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
