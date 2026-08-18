"use client";

import { Plus } from "lucide-react";
import {
  attendanceRate,
  type AttendanceStatus,
  type Crew,
  type Study,
  type StudySession,
} from "@studyclub/mock";
import { Button } from "@studyclub/ui";

/**
 * 출석 탭 — 크루 × 회차 격자.
 *
 * 지금까지 구글시트로 하던 일이라 **시트와 같은 모양**을 유지한다. 화면은 이 격자 하나뿐 —
 * 회차별 화면을 따로 두면 같은 일을 두 곳에서 하게 되고, 한 사람이 몇 번 빠졌는지 보려면
 * 회차를 하나씩 열어야 한다.
 *
 * 출석률은 버튼 없이 **체크하는 즉시** 다시 계산된다. 집계를 따로 돌려야 한다면 시트와 다를 게 없다.
 * 분모는 **체크된 회차만** — 아직 열리지 않은 회차 때문에 출석률이 낮아 보이면 안 된다.
 */

const CELL_STYLE: Record<AttendanceStatus, string> = {
  present: "border-transparent bg-success-100 text-success-700",
  late: "border-transparent bg-warning-100 text-warning-700",
  absent: "border-transparent bg-error-50 text-error-700",
};

const CELL_LABEL: Record<AttendanceStatus, string> = {
  present: "출석",
  late: "지각",
  absent: "결석",
};

function Cell({
  status,
  onClick,
}: {
  status: AttendanceStatus | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="눌러서 출석 → 지각 → 결석 → 미체크"
      className={`h-8 w-full rounded-sm border text-[11px] font-bold transition-colors ${
        status ? CELL_STYLE[status] : "border-dashed border-border-strong bg-surface text-fg-muted hover:bg-surface-2"
      }`}
    >
      {status ? CELL_LABEL[status] : ""}
    </button>
  );
}

export function AttendanceTab({
  study,
  crew,
  sessions,
  attendance,
  onToggle,
}: {
  study: Study;
  crew: Crew[];
  sessions: StudySession[];
  attendance: Record<string, Record<string, AttendanceStatus>>;
  onToggle: (crewId: string, sessionId: string) => void;
}) {
  if (sessions.length === 0) {
    return (
      <div className="card px-6 py-10 text-center">
        <p className="text-sm font-semibold text-fg">아직 회차가 없습니다.</p>
        <Button size="sm" className="mt-4" leadingIcon={<Plus size={15} />} disabled title="미구현">
          회차 등록
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold">
          출석부
          <span className="ml-2 text-[13px] font-medium text-fg-muted">
            크루 {crew.length} · 회차 {sessions.length}
          </span>
        </h2>
        <Button size="sm" variant="secondary" leadingIcon={<Plus size={15} />} disabled title="미구현">
          회차 등록
        </Button>
      </div>

      <div className="card mt-3 overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-[1] bg-surface px-4 py-3 text-left text-xs font-semibold text-fg-muted">
                크루
              </th>
              {sessions.map((s) => (
                <th key={s.id} className="tnum w-[3.6rem] px-1 py-2 text-center text-[11px] font-semibold text-fg-secondary">
                  {s.no}회
                  <span className="block text-[10px] font-medium text-fg-muted">{s.date.slice(5)}</span>
                </th>
              ))}
              <th className="px-3 py-2 text-right text-xs font-semibold text-fg-muted">출석률</th>
            </tr>
          </thead>
          <tbody>
            {crew.map((c) => {
              const row = attendance[c.id];
              const rate = attendanceRate(row);
              return (
                <tr key={c.id}>
                  <td className="sticky left-0 z-[1] whitespace-nowrap border-t border-border bg-surface px-4 py-1.5 font-semibold">
                    {c.name}
                  </td>
                  {sessions.map((s) => (
                    <td key={s.id} className="border-t border-border px-1 py-1.5">
                      <Cell status={row?.[s.id]} onClick={() => onToggle(c.id, s.id)} />
                    </td>
                  ))}
                  <td className="tnum border-t border-border px-3 py-1.5 text-right font-bold">
                    {rate === undefined ? (
                      <span className="text-fg-muted">—</span>
                    ) : (
                      <span className={rate >= 80 ? "text-success-700" : rate >= 60 ? "text-fg" : "text-error-700"}>
                        {rate}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-fg-muted">칸을 누르면 출석 → 지각 → 결석 → 미체크 순으로 바뀝니다. 출석률에는 지각도 참석으로 셉니다.</p>
    </div>
  );
}
