import { ATTENDANCE_STATUSES, STATUS_LABEL, type ClubMember } from '@console/lib/clubs';
import type { AttendanceStatus } from '@studyclub/types';

/**
 * 시트 값 → 출석 값. 표 하나로 읽기와 안내 문구를 함께 만든다 — 기호를 더하려면 이 표만 고친다.
 * 첫 기호가 안내에 보이는 대표 기호다.
 */
export const SHEET_SYMBOLS: Record<AttendanceStatus, string[]> = {
  present: ['O', '1', '출석', 'V', '✓', '✔'],
  late: ['△', '(O)', '지각', '0.5'],
  absent: ['X', '0', '결석', '-'],
  excused: ['휴', '휴가', 'E'],
};

/** 시트에서 붙여넣은 값 하나를 출석 값으로. 모르는 값은 undefined, 빈 칸은 null(그대로 둔다). */
export function parseSheetValue(raw: string): AttendanceStatus | null | undefined {
  const v = raw.trim().toUpperCase();
  if (v === '') return null;
  return ATTENDANCE_STATUSES.find((k) => SHEET_SYMBOLS[k].includes(v));
}

/** 「출석 O · 지각 △ · 결석 X · 휴가 휴」 */
export function sheetValueHint(): string {
  return ATTENDANCE_STATUSES.map((s) => `${STATUS_LABEL[s]} ${SHEET_SYMBOLS[s][0]}`).join(' · ');
}

export type PasteCell = { id: string; day: string; status: AttendanceStatus };

export type PasteResult = { cells: PasteCell[]; unknownNames: string[]; badValues: string[]; people: number };

/**
 * 시트에서 복사한 줄들 — 첫 칸은 디스코드 별명, 그 뒤는 1일부터 차례로 그 날의 값 (탭으로 나뉨).
 * 화면과 떼어 둔다 — 같은 규칙을 서버 · 테스트에서도 그대로 쓴다.
 */
export function parseSheetRows(text: string, members: ClubMember[], days: string[]): PasteResult {
  const cells: PasteCell[] = [];
  const unknownNames: string[] = [];
  const badValues = new Set<string>();
  let people = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [name, ...vals] = line.split('\t');
    const m = members.find((x) => x.name === name.trim());
    if (!m) {
      unknownNames.push(name.trim());
      continue;
    }
    people += 1;
    vals.slice(0, days.length).forEach((raw, i) => {
      const s = parseSheetValue(raw);
      if (s === null) return;
      if (s === undefined) {
        badValues.add(raw.trim());
        return;
      }
      cells.push({ id: m.id, day: days[i], status: s });
    });
  }
  return { cells, unknownNames, badValues: [...badValues], people };
}
