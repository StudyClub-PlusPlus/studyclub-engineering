"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  STUDY_CATEGORIES,
  attendanceRate,
  getStudyCrew,
  publishState,
  recruitState,
  toISODate,
  type Study,
} from "@studyclub/mock";
import { tx } from "@/lib/l10n";
import { TableCard } from "@/components/ui";
import { Badge } from "@studyclub/ui";

/**
 * 스터디 관리 목록.
 *
 * **칼럼은 등록 폼에 있는 항목으로만 짠다.** 운영자가 입력할 수 없는 값(형식·정원·연도·종류)은
 * 영원히 비거나 더미로 남으므로 목록에 두지 않는다. 상태 두 개(모집·공개)는 각각 등록 폼의
 * 「모집 마감일」·「공개일」 하나에서 파생되므로 별도 입력 없이도 항상 정확하다.
 *
 * 판정 함수는 사용자 사이트와 공유한다(`@studyclub/mock`) — 콘솔에만 "마감"으로 보이는 사고 방지.
 *
 * 행에 편집·삭제 버튼을 두지 않는다. 스터디 이름을 누르면 **운영 페이지**로 들어가고, 거기서
 * 크루 승인·출석·정보 수정을 모두 한다.
 */

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "카테고리 전체" },
  ...STUDY_CATEGORIES.map((c) => ({ value: c, label: c })),
];

type RecruitFilter = "all" | "apply" | "closed";
type PublishFilter = "all" | "live" | "scheduled";

// "전체" 항목에 축 이름을 붙인다 — 필터가 한 줄에 나란히 서면 어떤 축인지 라벨 없이 알아야 한다.
const RECRUIT_OPTIONS: { value: RecruitFilter; label: string }[] = [
  { value: "all", label: "모집 전체" },
  { value: "apply", label: "모집중" },
  { value: "closed", label: "마감" },
];

const PUBLISH_OPTIONS: { value: PublishFilter; label: string }[] = [
  { value: "all", label: "공개 전체" },
  { value: "live", label: "공개" },
  { value: "scheduled", label: "공개 예정" },
];

/** 필터 셀렉트 — 세 축이 한 줄에 나란히 서므로 생김새를 하나로 맞춘다. */
function FilterSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={`h-9 rounded-control border bg-surface px-3 text-sm outline-none focus:border-brand ${
        value === "all" ? "border-border-strong text-fg-secondary" : "border-brand font-semibold text-fg"
      }`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** 목록에 필요한 만큼만 뽑는다 — 어느 스터디를 열어야 하는지 고르기 위한 숫자. */
function summarize(study: Study) {
  const { crew, capacity, attendance } = getStudyCrew(study);
  const active = crew.filter((c) => c.status === "active");
  const rows = active.map((c) => attendanceRate(attendance[c.id])).filter((r): r is number => r !== undefined);
  return {
    capacity,
    active: active.length,
    pending: crew.filter((c) => c.status === "pending").length,
    rate: rows.length === 0 ? undefined : Math.round(rows.reduce((a, b) => a + b, 0) / rows.length),
  };
}

export function StudiesTable({ studies }: { studies: Study[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [recruit, setRecruit] = useState<RecruitFilter>("all");
  const [publish, setPublish] = useState<PublishFilter>("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return studies
      .filter((s) => {
        if (category !== "all" && s.category !== category) return false;
        if (recruit !== "all" && recruitState(s) !== recruit) return false;
        if (publish !== "all" && publishState(s) !== publish) return false;
        if (q) {
          const hay = `${tx(s.title)} ${tx(s.summary)} ${s.category ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      // 운영자가 손댈 것부터 위로: 모집중 먼저, 그 안에서 마감이 임박한 순.
      // 마감일 없는 상시 모집은 급할 게 없으므로 모집중 그룹의 끝.
      .sort((a, b) => {
        const ra = recruitState(a) === "apply" ? 0 : 1;
        const rb = recruitState(b) === "apply" ? 0 : 1;
        if (ra !== rb) return ra - rb;
        const da = toISODate(a.recruitment?.deadline) ?? "9999-99-99";
        const db = toISODate(b.recruitment?.deadline) ?? "9999-99-99";
        return da.localeCompare(db);
      });
  }, [studies, query, category, recruit, publish]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="제목 · 한 줄 소개 검색"
          className="h-9 w-56 rounded-control border border-border-strong bg-surface px-3 text-sm outline-none focus:border-brand"
        />
        <FilterSelect value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
        <FilterSelect value={recruit} onChange={setRecruit} options={RECRUIT_OPTIONS} />
        <FilterSelect value={publish} onChange={setPublish} options={PUBLISH_OPTIONS} />
        <span className="ml-auto text-xs text-fg-muted">{rows.length}개</span>
      </div>

      <TableCard>
        <thead>
          <tr>
            <th>스터디</th>
            <th className="whitespace-nowrap">카테고리</th>
            <th className="whitespace-nowrap">모집</th>
            <th className="whitespace-nowrap">크루</th>
            <th className="whitespace-nowrap">출석률</th>
            <th className="whitespace-nowrap">공개</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const open = recruitState(s) === "apply";
            const deadline = toISODate(s.recruitment?.deadline);
            const publishAt = toISODate(s.publish_at);
            const scheduled = publishState(s) === "scheduled";
            const crewStat = summarize(s);
            return (
              <tr key={s.id}>
                <td className="w-[42%] max-w-0">
                  <Link
                    href={`/studies/${s.id}`}
                    className="block truncate font-semibold underline-offset-4 hover:text-brand hover:underline"
                  >
                    {tx(s.title)}
                  </Link>
                </td>
                <td className="whitespace-nowrap text-fg-secondary">{s.category ?? "—"}</td>
                <td>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <Badge tone={open ? "recruiting" : "closed"} dot className="px-2.5 py-1 font-semibold">
                      {open ? "모집중" : "마감"}
                    </Badge>
                    <span className="tnum text-xs text-fg-muted">
                      {deadline ? `~${deadline}` : open ? "상시" : ""}
                    </span>
                  </div>
                </td>
                <td className="tnum whitespace-nowrap text-xs text-fg-secondary">
                  {crewStat.active}/{crewStat.capacity}
                </td>
                <td className="tnum whitespace-nowrap text-xs font-semibold text-fg-secondary">
                  {crewStat.rate === undefined ? <span className="text-fg-muted">—</span> : `${crewStat.rate}%`}
                </td>
                {/* 공개 예정은 사용자 사이트에서 아직 안 보인다는 뜻 — 날짜를 함께 보여준다 */}
                <td className="tnum whitespace-nowrap text-xs">
                  {scheduled ? (
                    <span className="font-semibold text-warning-700">{publishAt} 공개</span>
                  ) : (
                    <span className="text-fg-secondary">공개</span>
                  )}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-fg-muted">
                조건에 맞는 스터디가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </TableCard>
    </div>
  );
}
