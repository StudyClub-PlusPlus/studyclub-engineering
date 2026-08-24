"use client";

import { MEMBER_REGIONS, type Crew, type CrewStatus } from "@studyclub/mock";
import { Button } from "@studyclub/ui";

import { TableCard } from "@/components/ui";

/**
 * 신청자 탭 — 승인 대기 처리와 참여 명단.
 *
 * 승인 대기를 **위에 따로 뺀다.** 명단에 섞어 두면 오늘 처리할 일이 몇 건인지 세어야 한다.
 * 승인 판단 재료는 **지난 참여 횟수와 완주율** — 이름만으로는 결정할 수 없어 운영자가 매번
 * 다른 곳을 뒤지게 된다.
 *
 * **버튼은 「승인」 하나뿐이다.** 거절·대기를 따로 두면 셋 중 무엇을 눌러야 할지 매번 판단해야
 * 하는데, 실제로 갈리는 것은 승인했는가 아닌가 둘뿐이다. 승인하지 않고 남겨 둔 것이 곧 미승인이다.
 */

function regionLabel(key: Crew["region"]) {
  return MEMBER_REGIONS.find((r) => r.key === key)?.label.ko ?? key;
}

/** 완주율 — 이력이 없으면 숫자를 만들지 않고 "첫 참여"로 말한다. */
function Completion({ crew }: { crew: Crew }) {
  if (crew.completionRate === undefined) {
    return <span className="text-fg-muted">첫 참여</span>;
  }
  const tone =
    crew.completionRate >= 80 ? "text-success-700" : crew.completionRate >= 60 ? "text-fg" : "text-warning-700";
  return (
    <span className="tnum">
      <span className={`font-bold ${tone}`}>{crew.completionRate}%</span>
      <span className="ml-1 text-xs text-fg-muted">({crew.pastStudies}회)</span>
    </span>
  );
}

export function CrewTab({
  crew,
  capacity,
  onStatus,
}: {
  crew: Crew[];
  capacity: number;
  onStatus: (crewId: string, status: CrewStatus) => void;
}) {
  const pending = crew.filter((c) => c.status === "pending");
  const active = crew.filter((c) => c.status === "active");
  const full = active.length >= capacity;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="flex items-baseline gap-2 text-[15px] font-bold">
          승인 대기
          <span className="tnum text-[13px] font-medium text-fg-muted">{pending.length}</span>
          {full && (
            <span className="rounded-pill bg-warning-100 px-2 py-0.5 text-[11px] font-bold text-warning-700">
              정원 마감 · 승인 시 정원 초과
            </span>
          )}
        </h2>
        {pending.length === 0 ? (
          <p className="mt-2 rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-fg-muted">
            처리할 신청이 없습니다.
          </p>
        ) : (
          <div className="mt-2">
            <TableCard>
              <thead>
                <tr>
                  <th className="whitespace-nowrap">이름</th>
                  <th>이메일</th>
                  <th className="whitespace-nowrap">지역</th>
                  <th className="whitespace-nowrap">완주율</th>
                  <th className="whitespace-nowrap">신청일</th>
                  <th className="text-right">처리</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap font-semibold">{c.name}</td>
                    <td className="whitespace-nowrap text-fg-secondary">{c.email}</td>
                    <td className="whitespace-nowrap text-fg-secondary">{regionLabel(c.region)}</td>
                    <td className="whitespace-nowrap">
                      <Completion crew={c} />
                    </td>
                    <td className="tnum whitespace-nowrap text-xs text-fg-muted">{c.appliedAt}</td>
                    <td>
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => onStatus(c.id, "active")}>
                          승인
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          </div>
        )}
      </section>

      <section>
        <h2 className="flex items-baseline gap-2 text-[15px] font-bold">
          참여 크루
          <span className="tnum text-[13px] font-medium text-fg-muted">
            {active.length}/{capacity}
          </span>
        </h2>
        <div className="mt-2">
          <TableCard>
            <thead>
              <tr>
                <th className="whitespace-nowrap">이름</th>
                <th>이메일</th>
                <th className="whitespace-nowrap">지역</th>
                <th className="whitespace-nowrap">완주율</th>
                <th className="text-right">처리</th>
              </tr>
            </thead>
            <tbody>
              {active.map((c) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap font-semibold">{c.name}</td>
                  <td className="whitespace-nowrap text-fg-secondary">{c.email}</td>
                  <td className="whitespace-nowrap text-fg-secondary">{regionLabel(c.region)}</td>
                  <td className="whitespace-nowrap">
                    <Completion crew={c} />
                  </td>
                  <td>
                    <div className="flex justify-end">
                      <Button size="sm" variant="ghost" onClick={() => onStatus(c.id, "rejected")}>
                        내보내기
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {active.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-fg-muted">
                    아직 승인된 크루가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </TableCard>
        </div>
      </section>
    </div>
  );
}
