"use client";

import type { StudyclubEvent } from "@studyclub/mock";
import { Input, Select } from "@studyclub/ui";

import { tx, EVENT_TYPE_LABEL } from "@/lib/l10n";

/**
 * 행사 입력 폼 — **등록 팝업과 편집 팝업이 나눠 쓴다.** 스터디 폼(`StudyForm`)과 같은 규칙이다.
 *
 * 첫 줄에 분류와 날짜를 두는 순서도 스터디와 맞춘다 — 두 화면을 오가는 운영자가 매번 다른
 * 위치를 찾지 않도록.
 */

export const EVENT_TYPES = ["meetup", "workshop", "talk", "online"] as const;

export type EventFormValues = {
  title: string;
  summary: string;
  type: string;
  date: string;
  location: string;
  link: string;
};

export const EMPTY_EVENT: EventFormValues = {
  title: "",
  summary: "",
  type: "",
  date: "",
  location: "",
  link: "",
};

export function eventToForm(event: StudyclubEvent): EventFormValues {
  return {
    title: tx(event.title),
    summary: tx(event.summary),
    type: event.type,
    date: event.date,
    location: event.location ? tx(event.location) : "",
    link: event.link ?? "",
  };
}

export type EventFormErrors = Partial<Record<keyof EventFormValues, string>>;

export function validateEventForm(f: EventFormValues): EventFormErrors {
  const e: EventFormErrors = {};
  if (!f.title.trim()) e.title = "행사명을 입력하세요.";
  if (!f.summary.trim()) e.summary = "한 줄 소개를 입력하세요.";
  if (!f.type) e.type = "타입을 선택하세요.";
  if (!f.date) e.date = "날짜를 입력하세요.";
  return e;
}

export function EventForm({
  value,
  errors,
  onChange,
}: {
  value: EventFormValues;
  errors: EventFormErrors;
  onChange: (next: EventFormValues) => void;
}) {
  const set = <K extends keyof EventFormValues>(key: K, v: EventFormValues[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="타입"
          required
          value={value.type}
          onChange={(ev) => set("type", ev.target.value)}
          error={errors.type}
        >
          <option value="">선택하세요</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {EVENT_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
        <Input
          label="날짜"
          type="date"
          required
          value={value.date}
          onChange={(ev) => set("date", ev.target.value)}
          error={errors.date}
        />
      </div>

      <Input
        label="행사명"
        required
        value={value.title}
        onChange={(ev) => set("title", ev.target.value)}
        placeholder="2026 가을 시즌 킥오프 밋업"
        error={errors.title}
      />

      <Input
        label="한 줄 소개"
        required
        value={value.summary}
        onChange={(ev) => set("summary", ev.target.value)}
        placeholder="가을 시즌 스터디 소개와 크루 네트워킹."
        error={errors.summary}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="장소"
          value={value.location}
          onChange={(ev) => set("location", ev.target.value)}
          placeholder="온라인"
          labelHint="미입력 시 온라인"
        />
        {/* 스터디와 달리 행사는 외부 신청 폼을 쓰는 경우가 있어 링크를 받는다 */}
        <Input
          label="신청 링크"
          value={value.link}
          onChange={(ev) => set("link", ev.target.value)}
          placeholder="https://"
          labelHint="선택"
        />
      </div>
    </div>
  );
}
