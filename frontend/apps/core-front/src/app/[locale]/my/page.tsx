"use client";

// 수강생 페이지(A8) — 로그인 게이팅. 서버 미들웨어가 access 쿠키로 1차 게이트하고,
// 여기서도 클라이언트 세션(sc_user)이 없으면 /login 으로 보낸다(방어적).
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { MEMBER_REGIONS, studies as allStudies, type MemberRegion, type Study } from "@studyclub/mock";
import { CalendarClock, Heart } from "lucide-react";

import { ProfileDialog } from "@/components/ProfileDialog";
import { categoryGradient, categoryMeta } from "@/components/StudyThumb";
import { getUser, logout, type SessionUser } from "@/lib/auth";
import type { Locale } from "@/lib/content";
import { t } from "@/lib/i18n";
import {
  cancelApplication,
  getApplications,
  getBookmarks,
  getDiscord,
  getDisplayName,
  getRegion,
  seedDemoData,
  setDiscord,
  setBookmarked,
  setDisplayName,
  setRegion,
  type Application,
  type DiscordLink,
} from "@/lib/me";
import { IS_DEV, syncPreview } from "@/lib/preview";
import { recruitState } from "@/lib/recruit";

/**
 * 마이페이지.
 *
 * 스터디를 **회원 입장에서 처리해야 할 순서대로** 나눈다: 승인 대기 → 참여 중 → (참여 이력 ·
 * 관심). 한 목록에 상태 배지만 섞어 두면 "내가 지금 뭘 하고 있는지"를 회원이 직접 읽어내야 한다.
 *
 * 앞의 둘은 펼쳐 두고 뒤의 둘은 탭으로 묶는다 — 앞의 둘은 개수가 늘지 않고, 뒤의 둘만 쌓인다.
 *
 * 참여 중과 참여 이력을 가르는 것은 신청 상태가 아니라 **스터디가 끝났는지** 여부다.
 *
 * 거주 지역은 내 정보에 있다: 일정 미정 스터디의 신청 폼이 "가능한 시간"을 이 지역의 현지
 * 시간으로 받으므로, 지역이 틀리면 운영자가 겹치는 시간을 잘못 계산한다.
 */

/** 목록 한 줄 — 카테고리 색 막대로 어느 분야인지 한눈에 구분한다(목록 카드와 같은 색 규칙). */
function StudyRow({
  study,
  locale,
  right,
}: {
  study: Study;
  locale: Locale;
  right?: React.ReactNode;
}) {
  const { icon: Icon, label } = categoryMeta(study.category);
  return (
    <li className="flex items-center gap-4 border-b border-border py-3.5 last:border-b-0">
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-card text-white"
        style={{ background: categoryGradient(study.category) }}
        aria-hidden="true"
      >
        <Icon size={17} strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <Link
          href={`/${locale}/studies/${study.id}`}
          className="block truncate font-bold text-fg underline-offset-4 hover:underline"
        >
          {t(study.title, locale)}
        </Link>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-fg-secondary">
          <span className="shrink-0 text-fg-muted">{label}</span>
          <span className="text-fg-muted">·</span>
          <CalendarClock size={12} strokeWidth={1.75} className="shrink-0" />
          {/* 일정 미정은 빈칸이 아니라 정책 — 신청자 응답으로 정한다 */}
          <span className="truncate">
            {study.schedule ? t(study.schedule, locale) : "일정 미정 · 신청자와 조율"}
          </span>
        </p>
      </div>
      {right}
    </li>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="card mt-6 px-6 py-5">
      <h2 className="flex items-baseline gap-2 text-[15px] font-bold text-fg">
        {title}
        <span className="tnum text-[13px] font-medium text-fg-muted">{count}</span>
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/**
 * 쌓이는 목록(참여 이력·관심 스터디)은 탭 하나로 묶는다.
 *
 * 넷을 모두 세로로 늘어놓으면 스터디가 쌓일수록 페이지가 끝없이 길어진다. 반대로 넷을 전부
 * 탭으로 만들면 "승인 대기가 있는지"를 보려고 탭을 눌러야 한다 — **지금 할 일은 펼쳐 두고,
 * 쌓이기만 하는 것만 접는다.**
 */
function ArchiveTabs({
  tabs,
  children,
}: {
  tabs: { key: string; label: string; count: number }[];
  children: (key: string) => React.ReactNode;
}) {
  const [active, setActive] = useState(tabs[0].key);
  return (
    <section className="card mt-6 px-6 py-5">
      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={`-mb-px border-b-2 px-3 pb-2.5 text-[15px] font-bold transition-colors ${
              active === t.key
                ? "border-brand text-fg"
                : "border-transparent text-fg-muted hover:text-fg-secondary"
            }`}
          >
            {t.label}
            <span className="tnum ml-1.5 text-[13px] font-medium text-fg-muted">{t.count}</span>
          </button>
        ))}
      </div>
      <div className="mt-2">{children(active)}</div>
    </section>
  );
}

/** 길어지는 목록은 일부만 보이고 나머지는 눌러서 편다. */
function ExpandableList({ children, initial = 5 }: { children: React.ReactNode[]; initial?: number }) {
  const [all, setAll] = useState(false);
  const hidden = children.length - initial;
  return (
    <>
      <ul>{all ? children : children.slice(0, initial)}</ul>
      {hidden > 0 && !all && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="mt-3 w-full rounded-control border border-border py-2 text-[13px] font-semibold text-fg-secondary transition-colors hover:bg-surface-2"
        >
          {hidden}개 더 보기
        </button>
      )}
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-fg-secondary">{children}</p>;
}

export default function MyPage() {
  const params = useParams();
  const router = useRouter();
  const locale = ((params?.locale as string) ?? "ko") as Locale;
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  const [region, setRegionState] = useState<MemberRegion>("KR");
  const [applications, setApplications] = useState<Application[]>([]);
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [discord, setDiscordState] = useState<DiscordLink>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    // 로컬 미리보기에서는 세션 정의를 맞추고 더미를 채운다(버전이 같으면 아무것도 하지 않는다)
    if (IS_DEV) seedDemoData();
    const u = IS_DEV ? syncPreview() : getUser();
    if (!u) {
      router.replace(`/${locale}/login?next=/${locale}/my`);
      return;
    }
    setUser(u);
    setName(getDisplayName() ?? u.name ?? u.email);
    setRegionState(getRegion());
    setApplications(getApplications());
    setBookmarks(getBookmarks());
    setDiscordState(getDiscord());
    setReady(true);
  }, [locale, router]);

  const byId = useMemo(() => new Map(allStudies.map((s) => [s.id, s])), []);
  const joined = applications
    .map((a) => ({ app: a, study: byId.get(a.studyId) }))
    .filter((x): x is { app: Application; study: Study } => Boolean(x.study))
    .sort((a, b) => b.app.appliedAt.localeCompare(a.app.appliedAt));
  const pending = joined.filter((x) => x.app.status === "pending");
  const active = joined.filter((x) => x.app.status === "accepted" && x.study.status !== "closed");
  const past = joined.filter((x) => x.app.status === "accepted" && x.study.status === "closed");
  const marked = bookmarks
    .map((id) => byId.get(id))
    .filter((s): s is Study => Boolean(s))
    .reverse();

  const regionMeta = MEMBER_REGIONS.find((r) => r.key === region)!;

  if (!ready || !user) {
    return <div className="px-6 py-16 text-center text-sm text-fg-secondary">불러오는 중…</div>;
  }

  async function handleLogout() {
    await logout();
    router.replace(`/${locale}`);
  }

  function saveProfile(next: { name: string; region: MemberRegion }) {
    setName(next.name);
    setDisplayName(next.name);
    setRegionState(next.region);
    setRegion(next.region);
  }

  function connectDiscord() {
    // TODO(api): 디스코드 OAuth 로 교체
    setDiscord("jiwon_dev");
    setDiscordState(getDiscord());
  }

  function disconnectDiscord() {
    setDiscord(null);
    setDiscordState(null);
  }

  function handleCancel(studyId: string) {
    cancelApplication(studyId);
    setApplications(getApplications());
  }

  function handleUnbookmark(studyId: string) {
    setBookmarked(studyId, false);
    setBookmarks(getBookmarks());
  }

  return (
    <div className="mx-auto max-w-3xl px-6 pb-16 pt-10">
      <h1 className="text-2xl font-extrabold tracking-tight">마이페이지</h1>

      {/* 내 정보 — 이름·이메일·거주 지역. 고치는 건 한 곳(수정 팝업)에서 한다 */}
      <section className="card mt-5 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            {user.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.picture} alt="" className="h-14 w-14 shrink-0 rounded-full" />
            ) : (
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-surface-2 text-lg font-bold text-fg-secondary">
                {name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-fg">{name}</p>
              <p className="truncate text-sm text-fg-secondary">{user.email}</p>
              <p className="mt-1 text-[13px] text-fg-secondary">
                거주 지역 · {t(regionMeta.label, locale)}
                <span className="ml-1 text-fg-muted">{regionMeta.tzLabel}</span>
              </p>
              {/* 스터디가 디스코드에서 진행되므로, 연결 여부는 회원이 바로 알아야 한다 */}
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px]">
                <span className="text-fg-secondary">디스코드 ·</span>
                {discord ? (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-pill bg-recruiting-bg px-2 py-0.5 text-[11px] font-bold text-recruiting-fg">
                      연결됨
                    </span>
                    <span className="text-fg-secondary">@{discord.handle}</span>
                    <button
                      type="button"
                      onClick={disconnectDiscord}
                      className="text-xs font-semibold text-fg-muted underline-offset-4 hover:text-error-600 hover:underline"
                    >
                      연결 해제
                    </button>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] font-bold text-fg-secondary">
                      연결 안 됨
                    </span>
                    <button
                      type="button"
                      onClick={connectDiscord}
                      className="text-xs font-semibold text-brand underline-offset-4 hover:underline"
                    >
                      연결하기
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-control border border-border-strong px-3 py-1.5 text-xs font-semibold text-fg-secondary transition-colors hover:bg-surface-2"
            >
              내 정보 수정
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-control px-3 py-1.5 text-xs font-semibold text-fg-muted transition-colors hover:bg-surface-2"
            >
              로그아웃
            </button>
          </div>
        </div>
      </section>

      <Section title="승인 대기" count={pending.length}>
        {pending.length === 0 ? (
          <Empty>
            승인을 기다리는 신청이 없습니다.{" "}
            <Link href={`/${locale}/studies`} className="font-semibold text-brand underline-offset-4 hover:underline">
              스터디 둘러보기
            </Link>
          </Empty>
        ) : (
          <ul>
            {pending.map(({ app, study }) => (
              <StudyRow
                key={study.id}
                study={study}
                locale={locale}
                right={
                  <div className="flex shrink-0 items-center gap-3">
                    <p className="tnum text-[11px] text-fg-muted">{app.appliedAt} 신청</p>
                    {/* 승인 전에는 회원이 스스로 물릴 수 있어야 한다 */}
                    <button
                      type="button"
                      onClick={() => handleCancel(study.id)}
                      className="text-xs font-semibold text-fg-muted underline-offset-4 hover:text-error-600 hover:underline"
                    >
                      취소
                    </button>
                  </div>
                }
              />
            ))}
          </ul>
        )}
      </Section>

      <Section title="참여 중인 스터디" count={active.length}>
        {active.length === 0 ? (
          <Empty>참여 중인 스터디가 없습니다.</Empty>
        ) : (
          <ul>
            {active.map(({ study }) => (
              <StudyRow
                key={study.id}
                study={study}
                locale={locale}
                right={
                  <span className="shrink-0 rounded-pill bg-recruiting-bg px-2.5 py-1 text-[11px] font-bold text-recruiting-fg">
                    진행 중
                  </span>
                }
              />
            ))}
          </ul>
        )}
      </Section>

      {/* 쌓이기만 하는 두 목록 — 탭으로 묶어 페이지가 길어지지 않게 한다 */}
      <ArchiveTabs
        // 관심이 앞 — 다시 열어볼 일이 더 잦고, 참여 이력은 굳이 찾아보는 기록이다
        tabs={[
          { key: "saved", label: "관심 스터디", count: marked.length },
          { key: "past", label: "참여 이력", count: past.length },
        ]}
      >
        {(key) =>
          key === "past" ? (
            past.length === 0 ? (
              <Empty>아직 완료한 스터디가 없습니다.</Empty>
            ) : (
              <ExpandableList>
                {past.map(({ app, study }) => (
                  <StudyRow
                    key={study.id}
                    study={study}
                    locale={locale}
                    right={
                      <div className="shrink-0 text-right">
                        <span className="inline-flex rounded-pill bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-fg-secondary">
                          완료
                        </span>
                        <p className="tnum mt-1 text-[11px] text-fg-muted">{app.appliedAt} 참여</p>
                      </div>
                    }
                  />
                ))}
              </ExpandableList>
            )
          ) : marked.length === 0 ? (
            <Empty>스터디 카드의 하트를 누르면 여기에 모입니다.</Empty>
          ) : (
            <ExpandableList>
              {marked.map((s) => (
                <StudyRow
                  key={s.id}
                  study={s}
                  locale={locale}
                  right={
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-xs font-medium text-fg-secondary">
                        {recruitState(s) === "apply" ? "모집중" : "모집 마감"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUnbookmark(s.id)}
                        aria-label="관심 스터디에서 빼기"
                        title="관심 스터디에서 빼기"
                        className="grid h-8 w-8 place-items-center rounded-full text-error-500 transition-colors hover:bg-surface-2"
                      >
                        <Heart size={16} strokeWidth={2} className="fill-current" />
                      </button>
                    </div>
                  }
                />
              ))}
            </ExpandableList>
          )
        }
      </ArchiveTabs>

      <ProfileDialog
        open={editing}
        onClose={() => setEditing(false)}
        locale={locale}
        email={user.email}
        name={name}
        region={region}
        onSave={saveProfile}
      />
    </div>
  );
}
