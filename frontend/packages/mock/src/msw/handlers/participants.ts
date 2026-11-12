import { mockClient, type MockResolveContext } from "../utils";

/**
 * 백오피스 참여 명단 — `GET /api/admin/studies/{studyId}/participants` (specs/study-group/spec.md 「참여 명단」,
 * 01-planning/stories/captain-view-attendees/PRD.md).
 * BE 가 아직 이 GET 을 만들지 않아(스펙작성중) 신청자 탭 · 일정 탭 발표자 · 출석부 줄이 비어 보인다.
 * devtool 에서 이 핸들러만 켜 두면 나머지 API 는 로컬 백엔드로 그대로 간다.
 *
 * 계약대로 — 기본은 `WITHDRAWN` 을 빼고 `?includeLeft=true` 면 넣는다. 정렬은 네비게이터 → 반 이름 → 닉네임.
 * `participantCount` 는 `ACTIVE` · `PAUSED` 수.
 */

type Status = "ACTIVE" | "PAUSED" | "WITHDRAWN";

const GROUPS = [
  { groupId: 1, name: "기본반", isDefault: true, canDelete: false },
  { groupId: 2, name: "목요일반", isDefault: false, canDelete: false },
];

const person = (
  id: number,
  nickname: string,
  status: Status,
  extra: {
    discordNickname?: string;
    groupId?: number;
    role?: "LEADER" | "MEMBER";
    region?: "KR" | "NA" | "ETC" | null;
    captain?: boolean;
  } = {},
) => ({
  participantId: id,
  accountId: 1000 + id,
  nickname,
  discordNickname: extra.discordNickname ?? null,
  email: `crew${id}@example.com`,
  regionGroup: extra.region === undefined ? "KR" : extra.region,
  groupId: extra.groupId ?? 1,
  participantRole: extra.role ?? "MEMBER",
  status,
  captain: extra.captain ?? false,
  joinedAt: `2026-10-${String(1 + (id % 9)).padStart(2, "0")}T01:00:00Z`,
});

type Row = ReturnType<typeof person>;

/**
 * 두 반 · 반마다 네비게이터 하나 · 신청한 담당 캡틴 한 줄(「캡틴」 칩) · 휴식 중 · 참여 중단(`includeLeft` 때만) ·
 * 디스코드 별명 없는 사람(「—」) · 지역 없는 사람 · 닉네임이 겹치는 두 사람(디스코드 별명으로 가른다).
 */
const CREW: Row[] = [
  person(1, "jamie", "ACTIVE", {
    discordNickname: "제이미/BE/서울/분산시스템",
    role: "LEADER",
  }),
  person(2, "seeun", "ACTIVE", {
    discordNickname: "세은/PM/서울",
    captain: true,
  }),
  person(3, "doyun", "ACTIVE", {
    discordNickname: "도윤/FE/시애틀",
    region: "NA",
  }),
  person(4, "harin", "PAUSED", { discordNickname: "하린/BE/부산" }),
  person(5, "minjun", "ACTIVE", { discordNickname: "민준/BE/서울" }),
  person(6, "minjun", "ACTIVE", {
    discordNickname: "민준/ML/LA",
    region: "NA",
  }),
  person(7, "seoyun", "ACTIVE", { region: null }),
  person(8, "jihoo", "WITHDRAWN", { discordNickname: "지후/FE/서울" }),
  person(11, "chaewon", "ACTIVE", {
    discordNickname: "채원/DE/서울",
    groupId: 2,
    role: "LEADER",
  }),
  person(12, "eunwoo", "ACTIVE", {
    discordNickname: "은우/BE/토론토",
    groupId: 2,
    region: "ETC",
  }),
  person(13, "yuna", "ACTIVE", { groupId: 2 }),
];

const groupName = (id: number) =>
  GROUPS.find((g) => g.groupId === id)?.name ?? "";

function listOf(studyId: number, all: Row[], includeLeft: boolean) {
  const participants = all
    .filter((p) => includeLeft || p.status !== "WITHDRAWN")
    .sort(
      (a, b) =>
        Number(b.participantRole === "LEADER") -
          Number(a.participantRole === "LEADER") ||
        groupName(a.groupId).localeCompare(groupName(b.groupId)) ||
        a.nickname.localeCompare(b.nickname),
    );
  return {
    studyId,
    participantCount: all.filter(
      (p) => p.status === "ACTIVE" || p.status === "PAUSED",
    ).length,
    recruitmentCapacity: 20,
    groups: GROUPS,
    participants,
  };
}

const studyIdOf = ({ params }: MockResolveContext) =>
  Number(Array.isArray(params.id) ? params.id[0] : params.id);
const includeLeftOf = ({ request }: MockResolveContext) =>
  new URL(request.url).searchParams.get("includeLeft") === "true";

export const adminParticipantsHandlers = mockClient.createHandlerGroup(
  "/api/admin/studies",
  [
    {
      method: "GET",
      path: "/:id/participants",
      presets: [
        {
          label: "정상 (두 반 · 10명)",
          status: 200,
          response: (ctx: MockResolveContext) =>
            listOf(studyIdOf(ctx), CREW, includeLeftOf(ctx)),
        },
        {
          label: "빈 명단",
          status: 200,
          response: (ctx: MockResolveContext) =>
            listOf(studyIdOf(ctx), [], includeLeftOf(ctx)),
        },
        {
          label: "서버 오류",
          status: 500,
          response: { errorMessage: "서버 오류가 발생했습니다." },
        },
      ],
    },
    {
      method: "PATCH",
      path: "/:id/participants",
      presets: [
        {
          label: "성공 (반 · 역할 반영)",
          status: 200,
          // 바꾼 값을 CREW 에 남긴다. 저장 뒤 다시 불러와도 그대로 보이게 (새로고침하면 초기화).
          response: async ({ request }: MockResolveContext) => {
            const { changes } = (await request.json()) as {
              changes: {
                participantId: number;
                groupId?: number;
                participantRole?: "LEADER" | "MEMBER";
              }[];
            };
            return {
              participants: changes.map((c) => {
                const row = CREW.find((p) => p.participantId === c.participantId);
                if (row) {
                  row.groupId = c.groupId ?? row.groupId;
                  row.participantRole = c.participantRole ?? row.participantRole;
                }
                return {
                  participantId: c.participantId,
                  participantRole: row?.participantRole ?? c.participantRole,
                  groupId: row?.groupId ?? c.groupId,
                };
              }),
            };
          },
        },
        {
          label: "비활성 크루 거절",
          status: 409,
          response: {
            errorCode: "PARTICIPANT_NOT_ACTIVE",
            errorMessage: "participantId 4: 활성 상태의 크루만 변경할 수 있습니다.",
          },
        },
      ],
    },
  ],
);
