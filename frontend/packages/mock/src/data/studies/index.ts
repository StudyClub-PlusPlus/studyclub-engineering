import type { L10n, Recruitment, Study, StudyKind, StudyProgram } from '../../types';
import { DEMO_APPLICATION_FORM } from '../../constants';
import { toISODate } from '../../utils';
import { STUDIES_CLOSED_2024 } from './closed-2024';
import { STUDIES_CLOSED_2025 } from './closed-2025';
import { STUDIES_CLOSED_2026 } from './closed-2026';
import type { StudyDraft } from './helpers';
import { STUDIES_ONGOING } from './ongoing';
import { STUDIES_RECRUITING } from './recruiting';

export type { StudyProgram };

const STUDIES_SEED: StudyDraft[] = [
  ...STUDIES_RECRUITING,
  ...STUDIES_ONGOING,
  ...STUDIES_CLOSED_2026,
  ...STUDIES_CLOSED_2025,
  ...STUDIES_CLOSED_2024,
];

/**
 * 데모용 스터디 프로그램 — 시드에는 프로그램이 없어 제목에서 기수 표기를 뗀 것을 프로그램으로 본다.
 */
function programStem(title: L10n): L10n {
  const strip = (t: string) =>
    t
      .replace(/\s*\d+기\s*(\([^)]*\))?\s*$/, "")
      .replace(/\s*Cohort\s*\d+\s*(\([^)]*\))?\s*$/, "")
      .replace(/\s*\(?\d{4}년.*$/, "")
      .replace(/\s*\d+월.*$/, "")
      .replace(/\s*(\d+기|시즌\s*\d+)\s*$/, "")
      .trim() || t;
  return { ko: strip(title.ko), en: strip(title.en) };
}

/**
 * 데모용 모집 시작일 — 시드에는 시작일이 없어 마감 14일 전으로 채운다.
 */
function withDemoStart(rec: Recruitment | undefined): Recruitment | undefined {
  if (!rec || rec.start) return rec;
  const end = toISODate(rec.deadline);
  if (!end || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return rec;
  const start = new Date(Date.parse(`${end}T00:00:00Z`) - 14 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return { ...rec, start };
}

const DEMO_PROGRAM_IDS = new Map<string, string>();

/** 시드의 기수 중 하나라도 클럽이면 그 프로그램은 클럽이다 — 종류는 기수가 아니라 프로그램의 것이다. */
const DEMO_PROGRAM_KINDS = new Map<string, StudyKind>();
for (const s of STUDIES_SEED) {
  const stem = programStem(s.title).ko;
  if (s.kind === "club" || !DEMO_PROGRAM_KINDS.has(stem))
    DEMO_PROGRAM_KINDS.set(stem, s.kind === "club" ? "club" : "study");
}

/**
 * 시작일(STUDY.START_AT) 추정 — 등록 폼이 이 값을 받게 된 건 최근이라 옛 시드에는 비어 있는 게 많다.
 * 우선순위: 코호트 대표 날짜(date) → 킥오프 문구의 날짜 → 모집 마감 + 1주.
 */
function deriveStartAt(s: StudyDraft): string | undefined {
  if (s.date) return toISODate(s.date);

  const kickoff = s.recruitment?.kickoff;
  const fullDate = kickoff?.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (fullDate) return `${fullDate[1]}-${fullDate[2].padStart(2, "0")}-${fullDate[3].padStart(2, "0")}`;

  const deadline = toISODate(s.recruitment?.deadline);
  const shortDate = kickoff?.match(/^(\d{1,2})\/(\d{1,2})/);
  if (shortDate && deadline) {
    return `${deadline.slice(0, 4)}-${shortDate[1].padStart(2, "0")}-${shortDate[2].padStart(2, "0")}`;
  }

  if (!deadline) return undefined;
  const started = new Date(`${deadline}T00:00:00Z`);
  started.setUTCDate(started.getUTCDate() + 7);
  return started.toISOString().slice(0, 10);
}

export const studies: Study[] = STUDIES_SEED.map(
  (s, i) => ({
    ...s,
    /** STUDY.ID. 사용자 사이트 상세 조회 키 — 슬러그(id)는 URL에 쓰지 않는다. 시드에는 없고 여기서 순번으로 붙인다. */
    study_id: i + 1,
    startAt: s.startAt ?? deriveStartAt(s),
    program: (() => {
      const title = programStem(s.title);
      if (!DEMO_PROGRAM_IDS.has(title.ko))
        DEMO_PROGRAM_IDS.set(title.ko, String(DEMO_PROGRAM_IDS.size + 1));
      return {
        id: DEMO_PROGRAM_IDS.get(title.ko)!,
        title,
        kind: DEMO_PROGRAM_KINDS.get(title.ko) ?? "study",
      };
    })(),
    recruitment: withDemoStart(s.recruitment),
    // 데모: 지난해 이전에 끝난 스터디는 채널까지 정리된 것으로 본다
    channelDeleted:
      s.channelDeleted ??
      (s.status === "closed" && Boolean(s.year) && Number(s.year) < 2026
        ? true
        : undefined),
    applicationForm: DEMO_APPLICATION_FORM,
  }),
);

export const programs: StudyProgram[] = (() => {
  const map = new Map<string, StudyProgram>();
  for (const s of studies) {
    if (!s.program) continue;
    const cur = map.get(s.program.id);
    if (cur) cur.cohorts += 1;
    else map.set(s.program.id, { ...s.program, cohorts: 1 });
  }
  return [...map.values()];
})();

/** 프로그램의 최신 기수 — 모집 마감일이 가장 늦은 기수. 새 기수의 기본값을 가져올 때 쓴다. */
export function latestCohort(programId: string): Study | undefined {
  const key = (s: Study) =>
    toISODate(s.recruitment?.deadline) ?? toISODate(s.recruitment?.start) ?? "";
  return studies
    .filter((s) => s.program?.id === programId)
    .sort((a, b) => key(b).localeCompare(key(a)))[0];
}
