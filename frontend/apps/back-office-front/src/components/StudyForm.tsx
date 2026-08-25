"use client";

import { STUDY_CATEGORIES, toISODate, type Study } from "@studyclub/mock";
import { Checkbox, Input, Select, Textarea } from "@studyclub/ui";

import { tx } from "@/lib/l10n";

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

export type StudyFormValues = {
  title: string;
  summary: string;
  description: string;
  category: string;
  deadline: string;
  alwaysOpen: boolean;
  publishAt: string;
  schedule: string;
};

export const EMPTY_FORM: StudyFormValues = {
  title: "",
  summary: "",
  description: "",
  category: "",
  deadline: "",
  alwaysOpen: false,
  publishAt: "",
  schedule: "",
};

/** 기존 스터디를 폼 값으로 되돌린다. 화면에 보이는 값과 폼 값이 같아야 편집이 성립한다. */
export function studyToForm(study: Study): StudyFormValues {
  const deadline = toISODate(study.recruitment?.deadline) ?? "";
  return {
    title: tx(study.title),
    summary: tx(study.summary),
    description: tx(study.description),
    category: study.category ?? "",
    deadline,
    alwaysOpen: !deadline,
    publishAt: toISODate(study.publish_at) ?? "",
    schedule: tx(study.schedule),
  };
}

export type StudyFormErrors = Partial<Record<keyof StudyFormValues, string>>;

export function validateStudyForm(f: StudyFormValues): StudyFormErrors {
  const e: StudyFormErrors = {};
  if (!f.title.trim()) e.title = "제목을 입력하세요.";
  else if (f.title.trim().length > 60) e.title = "60자 이내로 입력하세요.";
  if (!f.summary.trim()) e.summary = "한 줄 소개를 입력하세요.";
  if (!f.category.trim()) e.category = "카테고리를 선택하세요.";
  if (f.publishAt && f.deadline && f.publishAt > f.deadline) {
    e.publishAt = "공개일이 모집 마감일보다 늦습니다.";
  }
  return e;
}

/** 권장 길이 대비 현재 글자수. 넘으면 주황 — 경고일 뿐 저장을 막지 않는다. */
function CharCount({ len, max }: { len: number; max: number }) {
  return (
    <span className={`tnum ${len > max ? "text-warning-700" : "text-fg-placeholder"}`}>
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
  const set = <K extends keyof StudyFormValues>(key: K, v: StudyFormValues[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="카테고리"
          required
          value={value.category}
          onChange={(ev) => set("category", ev.target.value)}
          error={errors.category}
        >
          <option value="">선택하세요</option>
          {STUDY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="deadline" className="text-sm font-medium text-neutral-800">
            모집 마감일
          </label>
          <div className="flex items-center gap-3">
            <input
              id="deadline"
              type="date"
              value={value.deadline}
              disabled={value.alwaysOpen}
              onChange={(ev) => set("deadline", ev.target.value)}
              className="h-10 w-[9.5rem] shrink-0 rounded-control border border-border-strong bg-bg px-3 text-sm text-neutral-900 outline-none transition-[border-color,box-shadow] focus:border-brand focus:shadow-[var(--ring)] disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-neutral-400"
            />
            <Checkbox
              label="상시 모집"
              checked={value.alwaysOpen}
              onChange={(ev) => {
                const on = ev.target.checked;
                onChange({ ...value, alwaysOpen: on, deadline: on ? "" : value.deadline });
              }}
            />
          </div>
        </div>
      </div>

      <Input
        label="제목"
        required
        value={value.title}
        onChange={(ev) => set("title", ev.target.value)}
        placeholder="AI 논문 스터디"
        error={errors.title}
        labelHint={<CharCount len={value.title.trim().length} max={TITLE_RECOMMENDED} />}
      />

      <Input
        label="한 줄 소개"
        required
        value={value.summary}
        onChange={(ev) => set("summary", ev.target.value)}
        placeholder="AI 논문을 함께 읽고 토론합니다."
        error={errors.summary}
        labelHint={<CharCount len={value.summary.trim().length} max={SUMMARY_RECOMMENDED} />}
      />

      <Textarea
        label="상세 설명"
        rows={4}
        value={value.description}
        onChange={(ev) => set("description", ev.target.value)}
        placeholder="스터디 목표, 진행 방식, 준비물, 대상 등을 자유롭게 작성하세요."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="진행 일정"
          value={value.schedule}
          onChange={(ev) => set("schedule", ev.target.value)}
          placeholder="매주 목 20:00 · 8주 과정"
        />
        <Input
          label="공개일"
          type="date"
          value={value.publishAt}
          onChange={(ev) => set("publishAt", ev.target.value)}
          error={errors.publishAt}
          labelHint="미설정 시 즉시 공개"
        />
      </div>
    </div>
  );
}
