// 화면 시안 — 스터디 상세.
// 새 화면을 만들 때 이 폴더를 통째로 복사해서 시작하세요.
// 규칙 하나: 부품은 직접 만들지 말고 @studyclub/ui 에서 가져옵니다.
//           여기 없는 게 필요하면 일단 이 파일 안에 만들고,
//           두 화면에서 쓰이게 되면 그때 packages/ui 로 올립니다.
import { Avatar, Badge, Button, CapacityBar, Card } from "@studyclub/ui";
import { studies, operators } from "@studyclub/mock";
import { CalendarClock, MapPin } from "lucide-react";

export default function StudyDetailScreen() {
  const study = studies[0];
  const lead = operators.find((o) => o.id === study.lead);
  const capacity = study.seats?.total ?? study.recruitment?.capacity ?? 20;
  const taken = study.seats?.taken ?? Math.round(capacity * 0.85);

  return (
    <article className="space-y-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-fg-muted)]">
        화면 시안 · 스터디 상세
      </p>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="recruiting" dot>
            모집 중
          </Badge>
          {(study.topics ?? []).slice(0, 4).map((topic) => (
            <Badge key={topic.ko} tone="neutral">
              {topic.ko}
            </Badge>
          ))}
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight">{study.title.ko}</h1>
        <p className="max-w-2xl leading-relaxed text-[var(--color-fg-muted)]">{study.summary.ko}</p>

        <div className="flex flex-wrap items-center gap-5 text-sm text-[var(--color-fg-muted)]">
          {lead && (
            <span className="flex items-center gap-2">
              <Avatar name={lead.name.ko} size={24} role="captain" />
              {lead.name.ko}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <CalendarClock size={15} />
            {study.schedule?.ko ?? "일정 미정"}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin size={15} />
            {study.format}
          </span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card padding="lg">
          <h2 className="text-base font-bold">스터디 소개</h2>
          <p className="mt-3 leading-relaxed text-[var(--color-fg-muted)]">
            {study.description?.ko ?? "아직 상세 소개가 준비 중이에요."}
          </p>

          {!!study.weeks?.length && (
            <>
              <h3 className="mt-8 text-base font-bold">커리큘럼</h3>
              <ol className="mt-3 divide-y divide-[var(--color-border)]">
                {study.weeks.map((w, i) => (
                  <li key={i} className="flex gap-4 py-3 text-sm">
                    <span className="w-16 shrink-0 font-semibold text-[var(--color-fg-muted)]">{w.label.ko}</span>
                    <span>{w.title.ko}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </Card>

        {/* 신청 사이드바 */}
        <aside className="space-y-4">
          <Card padding="lg">
            <h2 className="text-base font-bold">모집 현황</h2>
            <div className="mt-4">
              <CapacityBar taken={taken} total={capacity} showLabel />
            </div>
            <Button className="mt-5 w-full" size="lg">
              신청하기
            </Button>
            <p className="mt-3 text-center text-xs text-[var(--color-fg-muted)]">
              신청하면 캡틴에게 알림이 갑니다
            </p>
          </Card>
        </aside>
      </div>
    </article>
  );
}
