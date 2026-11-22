import {
  EVENT_LIMITS,
  EVENT_ZONES,
  type EventConfirmation,
  type EventDetail,
  type EventFormat,
  type EventPayload,
  type QuestionType,
} from '@/features/events/types';
import { resolveDateField, wallTime, type DateResolution } from '@/features/events/wall-time';

export type QuestionDraft = {
  /** 화면 안에서만 쓰는 React 키. 서버로 보내지 않는다 */
  key: string;
  /** 기존 질문이면 서버가 준 키, 새 질문이면 null */
  questionId: string | null;
  label: string;
  type: QuestionType;
  required: boolean;
  options: string[];
};

export type EventFormValues = {
  title: string;
  summary: string;
  description: string;
  timeZone: string;
  startsAt: string;
  endsAt: string;
  deadlineAt: string;
  format: EventFormat;
  onlineCapacity: string;
  offlineCapacity: string;
  location: string;
  onlineUrl: string;
  confirmation: EventConfirmation;
  questions: QuestionDraft[];
};

export type DateField = 'startsAt' | 'endsAt' | 'deadlineAt';
export type ResolvedDates = Record<DateField, DateResolution>;
export type EventFormErrors = Record<string, string | undefined>;

export function emptyEventForm(): EventFormValues {
  return {
    title: '',
    summary: '',
    description: '',
    timeZone: EVENT_ZONES[0].value,
    startsAt: '',
    endsAt: '',
    deadlineAt: '',
    format: 'ONLINE',
    onlineCapacity: '30',
    offlineCapacity: '20',
    location: '',
    onlineUrl: '',
    confirmation: 'AUTO',
    questions: [],
  };
}

export function newQuestion(): QuestionDraft {
  return { key: crypto.randomUUID(), questionId: null, label: '', type: 'TEXT', required: false, options: [] };
}

export function formFromDetail(detail: EventDetail): EventFormValues {
  return {
    title: detail.title,
    summary: detail.summary,
    description: detail.description,
    timeZone: detail.timeZone,
    startsAt: wallTime(detail.startsAt, detail.timeZone),
    endsAt: wallTime(detail.endsAt, detail.timeZone),
    deadlineAt: wallTime(detail.deadlineAt, detail.timeZone),
    format: detail.format,
    onlineCapacity: String(detail.online?.capacity ?? 30),
    offlineCapacity: String(detail.offline?.capacity ?? 20),
    location: detail.offline?.location ?? '',
    onlineUrl: detail.online?.url ?? '',
    confirmation: detail.confirmation,
    questions: detail.questions.map((q) => ({ key: q.questionId, ...q })),
  };
}

export function resolveDates(
  values: EventFormValues,
  picked: Partial<Record<DateField, string>>,
  saved?: EventDetail,
): ResolvedDates {
  const resolve = (field: DateField) =>
    resolveDateField(values[field], values.timeZone, {
      pickedIso: picked[field],
      // 저장된 값은 같은 시간대일 때만 비교한다 — 시간대를 바꾸면 같은 현지 시각이라도 다른 순간이다
      savedIso: saved && saved.timeZone === values.timeZone ? (saved[field] ?? undefined) : undefined,
    });
  return { startsAt: resolve('startsAt'), endsAt: resolve('endsAt'), deadlineAt: resolve('deadlineAt') };
}

export function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function capacityError(raw: string): string | undefined {
  const n = Number(raw);
  if (raw.trim() === '' || !Number.isInteger(n) || n < EVENT_LIMITS.minCapacity || n > EVENT_LIMITS.maxCapacity) {
    return '정원은 1명부터 10,000명까지 입력해 주세요.';
  }
  return undefined;
}

export function hasChoices(type: QuestionType) {
  return type === 'RADIO' || type === 'CHECKBOX';
}

/**
 * 서버와 같은 기준의 입력 검사. 서버가 최종 판정이고(권한·상태·신청 수가 걸린 규칙은 서버만 안다),
 * 여기서는 보내기 전에 입력란 옆에 이유를 보여 주는 것까지만 한다.
 */
export function validateEventForm(
  values: EventFormValues,
  dates: ResolvedDates,
  context: { now: number; saved?: EventDetail },
): EventFormErrors {
  const errors: EventFormErrors = {};
  const title = values.title.trim();
  const summary = values.summary.trim();
  const description = values.description.trim();
  if (!title) errors.title = '행사명을 입력해 주세요.';
  else if (title.length > EVENT_LIMITS.title) errors.title = `행사명은 ${EVENT_LIMITS.title}자 이내로 입력해 주세요.`;
  if (!summary) errors.summary = '한 줄 소개를 입력해 주세요.';
  else if (summary.length > EVENT_LIMITS.summary)
    errors.summary = `한 줄 소개는 ${EVENT_LIMITS.summary}자 이내로 입력해 주세요.`;
  if (!description) errors.description = '모집 상세를 입력해 주세요.';
  else if (description.length > EVENT_LIMITS.description)
    errors.description = `모집 상세는 ${EVENT_LIMITS.description.toLocaleString()}자 이내로 입력해 주세요.`;
  if (!EVENT_ZONES.some((z) => z.value === values.timeZone)) errors.timeZone = '기준 시간대를 선택해 주세요.';

  for (const field of ['startsAt', 'deadlineAt'] as const) {
    if (!values[field]) errors[field] = field === 'startsAt' ? '행사 시작 시각을 입력해 주세요.' : '신청 마감 시각을 입력해 주세요.';
    else if (dates[field].error) errors[field] = dates[field].error;
  }
  if (values.endsAt && dates.endsAt.error) errors.endsAt = dates.endsAt.error;

  const { startsAt, endsAt, deadlineAt } = {
    startsAt: dates.startsAt.iso,
    endsAt: values.endsAt ? dates.endsAt.iso : null,
    deadlineAt: dates.deadlineAt.iso,
  };
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt) && !errors.endsAt)
    errors.endsAt = '종료 시각은 시작 시각보다 늦어야 합니다.';
  if (startsAt && deadlineAt && Date.parse(deadlineAt) > Date.parse(startsAt) && !errors.deadlineAt)
    errors.deadlineAt = '신청 마감은 행사 시작 시각 이전으로 설정해 주세요.';
  if (deadlineAt && !errors.deadlineAt) {
    const { saved } = context;
    const mustBeFuture = !saved || (saved.status === 'PUBLISHED' && Date.parse(deadlineAt) !== Date.parse(saved.deadlineAt));
    if (mustBeFuture && Date.parse(deadlineAt) <= context.now)
      errors.deadlineAt = '신청 마감 시각을 현재보다 늦게 설정해 주세요.';
  }

  if (values.format !== 'OFFLINE') {
    errors.onlineCapacity = capacityError(values.onlineCapacity);
    const url = values.onlineUrl.trim();
    if (url && (!isWebUrl(url) || url.length > EVENT_LIMITS.url))
      errors.onlineUrl = '온라인 참여 링크는 http 또는 https 주소로 입력해 주세요.';
  }
  if (values.format !== 'ONLINE') {
    errors.offlineCapacity = capacityError(values.offlineCapacity);
    const location = values.location.trim();
    if (!location) errors.location = '오프라인 장소를 입력해 주세요.';
    else if (location.length > EVENT_LIMITS.location)
      errors.location = `오프라인 장소는 ${EVENT_LIMITS.location}자 이내로 입력해 주세요.`;
  }

  if (values.questions.length > EVENT_LIMITS.questions)
    errors.questions = `신청 질문은 최대 ${EVENT_LIMITS.questions}개까지 추가할 수 있습니다.`;
  values.questions.forEach((q, i) => {
    const label = q.label.trim();
    if (!label) errors[`questions.${i}.label`] = '질문 제목을 입력해 주세요.';
    else if (label.length > EVENT_LIMITS.questionLabel)
      errors[`questions.${i}.label`] = `질문 제목은 ${EVENT_LIMITS.questionLabel}자 이내로 입력해 주세요.`;
    if (!hasChoices(q.type)) return;
    const options = q.options.map((o) => o.trim());
    if (
      options.length < EVENT_LIMITS.minOptions ||
      options.length > EVENT_LIMITS.maxOptions ||
      options.some((o) => !o) ||
      new Set(options).size !== options.length
    )
      errors[`questions.${i}.options`] = `서로 다른 선택지를 ${EVENT_LIMITS.minOptions}~${EVENT_LIMITS.maxOptions}개 입력해 주세요.`;
    else if (options.some((o) => o.length > EVENT_LIMITS.optionLabel))
      errors[`questions.${i}.options`] = `선택지는 하나당 ${EVENT_LIMITS.optionLabel}자 이내로 입력해 주세요.`;
  });

  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
}

/** 검사를 통과한 폼 → 요청 본문. 문자열은 앞뒤 공백을 자르고, 방식에 없는 쪽(offline/online)은 null 로 보낸다. */
export function toPayload(values: EventFormValues, dates: ResolvedDates): EventPayload {
  const online = values.format !== 'OFFLINE';
  const offline = values.format !== 'ONLINE';
  return {
    title: values.title.trim(),
    summary: values.summary.trim(),
    description: values.description.trim(),
    timeZone: values.timeZone,
    startsAt: dates.startsAt.iso!,
    endsAt: values.endsAt ? dates.endsAt.iso : null,
    deadlineAt: dates.deadlineAt.iso!,
    format: values.format,
    offline: offline ? { capacity: Number(values.offlineCapacity), location: values.location.trim() } : null,
    online: online ? { capacity: Number(values.onlineCapacity), url: values.onlineUrl.trim() || null } : null,
    confirmation: values.confirmation,
    questions: values.questions.map((q) => ({
      questionId: q.questionId,
      label: q.label.trim(),
      type: q.type,
      required: q.required,
      options: hasChoices(q.type) ? q.options.map((o) => o.trim()) : [],
    })),
  };
}

/** 서버 오류 코드 → 입력란. 없는 코드는 폼 위 알림으로 보인다. */
export function fieldOfServerError(code: string | undefined, message: string): string | null {
  switch (code) {
    case 'EVENT_START_LOCKED':
      return 'startsAt';
    case 'EVENT_ALREADY_STARTED':
      return 'confirmation';
    case 'CHANNEL_IN_USE':
      return 'format';
    case 'CAPACITY_BELOW_OCCUPIED':
      return 'capacity';
    case 'INVALID_INPUT': {
      const name = /\b(title|summary|description|startsAt|endsAt|deadlineAt|timeZone)\b/.exec(message)?.[1];
      return name ?? null;
    }
    default:
      return null;
  }
}
