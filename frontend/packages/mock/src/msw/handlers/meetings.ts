import { HttpResponse } from "msw";

import { studies } from "../../data";
import { getStudyCrew } from "../../data/crew";
import { currentUserName, mockClient, type MockResolveContext } from "../utils";

const GROUP_ID_OFFSET = 1000;
/** 4줄 — line-clamp-4 에서 잘리지 않으므로 「모두 보기」 버튼 없음 */
const RULES_SHORT = `1. 각 주차에 최대 2명(발표자1, 발표자2)이 발표를 진행합니다.
2. 발표자1이 메인으로 발표하고, 발표자2는 부족한 점을 보충하거나 덧붙입니다.
3. 발표 자료는 언어 무관, 단 1장이라도 같이 볼 수 있는 자료를 준비합니다.
4. 발표 1시간(2명), Q&A 20분. 질문은 각자 1개씩 준비하면 좋습니다(강제 아님).`;

/** 5줄 — line-clamp-4 에서 잘리므로 「모두 보기」 버튼 노출 */
const RULES_LONG = `1. 각 주차에 최대 2명(발표자1, 발표자2)이 발표를 진행합니다.
2. 발표자1이 메인으로 발표하고, 발표자2는 부족한 점을 보충하거나 덧붙입니다.
3. 발표 자료는 언어 무관, 단 1장이라도 같이 볼 수 있는 자료를 준비합니다.
4. 발표 1시간(2명), Q&A 20분. 질문은 각자 1개씩 준비하면 좋습니다(강제 아님).
5. 불참 시 최소 하루 전까지 채널에 미리 공유해 주세요.`;

/** 5줄 규칙을 쓸 스터디 ID. 나머지는 RULES_SHORT. */
const LONG_RULES_IDS = new Set([3, 9, 19, 22, 25, 28]);
const rulesState = new Map<number, string>();

function rulesFor(studyId: number): string {
  if (rulesState.has(studyId)) return rulesState.get(studyId)!;
  return LONG_RULES_IDS.has(studyId) ? RULES_LONG : RULES_SHORT;
}
export const CAPTAIN_STUDY_IDS = new Set([1, 9, 20]);
export const NAVIGATOR_STUDY_IDS = new Set([11]);
export const withdrawnState = new Map<number, Set<number>>();
export function getWithdrawnParticipants(studyId: number): Set<number> {
  return withdrawnState.get(studyId) ?? new Set<number>();
}
type MeetingRow = {
  id: number;
  type: string;
  number: number;
  scheduledAt: string;
  title: string;
  presenter1: { participantId: number; name: string; active: boolean } | null;
  presenter2: { participantId: number; name: string; active: boolean } | null;
  started: boolean;
};
type MeetingResponse = {
  study: {
    id: number;
    title: string;
    discordChannelUrl: string | null;
    driveUrl: string | null;
  };
  studyGroup: {
    id: number;
    name: string;
    timezone: string;
    startTime: string;
    navigatorName: string;
    rules: string | null;
  };
  me: { participantId: number | null; canEdit: boolean };
  participants: Array<{
    participantId: number;
    name: string;
    discordNickname?: string | null;
    left?: boolean;
    active?: boolean;
  }>;
  meetings: MeetingRow[];
};
const meetingState = new Map<number, MeetingRow[]>();

function addDaysYmd(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function meetingsWithKickoff(
  study: (typeof studies)[number],
  crewMeetings: ReturnType<typeof getStudyCrew>["meetings"],
): Array<{ id: string; no: number; date: string }> {
  const sorted = [...crewMeetings].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  if (!first) return sorted;
  const kickoffMeeting = {
    id: `${study.id}-kickoff`,
    no: 0,
    date: addDaysYmd(first.date, -7),
  };
  return [kickoffMeeting, ...sorted];
}

/** attendance 핸들러가 동일한 meeting ID를 쓸 수 있도록 현재 상태를 공유 */
export function getStudyMeetingIds(
  studyId: number,
  study: (typeof studies)[number],
): Array<{ id: number; scheduledAt: string }> {
  const stored = meetingState.get(studyId);
  if (stored)
    return stored.map((m) => ({ id: m.id, scheduledAt: m.scheduledAt }));
  const crew = getStudyCrew(study);
  const time =
    study.schedule?.ko
      .match(/(\d{1,2}):(\d{2})/)
      ?.slice(1)
      .join(":") ?? "20:00";
  return meetingsWithKickoff(study, crew.meetings).map((m) => ({
    id: numericId(m.id),
    scheduledAt: `${m.date}T${time}:00+09:00`,
  }));
}

function studyOf(id: string | string[] | undefined) {
  const studyId = Number(Array.isArray(id) ? id[0] : id);
  return studies.find((study) => study.study_id === studyId);
}

export function numericMeetingId(value: string) {
  return Math.abs(
    [...value].reduce(
      (hash, character) => (hash * 31 + character.charCodeAt(0)) | 0,
      7,
    ),
  );
}

const numericId = numericMeetingId;

function scheduledAt(date: string, study: (typeof studies)[number]) {
  const time =
    study.schedule?.ko
      .match(/(\d{1,2}):(\d{2})/)
      ?.slice(1)
      .join(":") ?? "20:00";
  return `${date}T${time}:00+09:00`;
}

function responseFor({
  request,
  params,
}: Pick<MockResolveContext, "params"> & { request?: Request }):
  MeetingResponse | undefined {
  const study = studyOf(params.studyId);
  if (!study) return undefined;
  const crew = getStudyCrew(study);
  const groupId = study.study_id + GROUP_ID_OFFSET;
  const isCaptain = CAPTAIN_STUDY_IDS.has(study.study_id);
  const isNavigator = NAVIGATOR_STUDY_IDS.has(study.study_id);
  const myName = currentUserName(request);
  const withdrawnSet = getWithdrawnParticipants(study.study_id);

  const navigatorName = isNavigator ? myName : isCaptain ? "가온" : "소율";

  let participants: Array<{
    participantId: number;
    name: string;
    discordNickname?: string | null;
    left?: boolean;
    active?: boolean;
  }>;
  if (isCaptain) {
    participants = [
      { participantId: 1, name: myName, discordNickname: null },
      { participantId: 2, name: "가온", discordNickname: null },
      ...crew.crew
        .filter((p) => p.name !== "가온")
        .map((p, i) => ({
          participantId: i + 3,
          name: p.name,
          discordNickname: p.discordNickname ?? null,
        })),
    ];
  } else if (isNavigator) {
    participants = [
      { participantId: 1, name: myName, discordNickname: null },
      ...crew.crew.map((p, i) => ({
        participantId: i + 2,
        name: p.name,
        discordNickname: p.discordNickname ?? null,
      })),
    ];
  } else {
    participants = [
      { participantId: 1, name: myName, discordNickname: null },
      { participantId: 2, name: "소율", discordNickname: null },
      ...crew.crew
        .filter((p) => p.name !== "소율")
        .map((p, i) => ({
          participantId: i + 3,
          name: p.name,
          discordNickname: p.discordNickname ?? null,
        })),
    ];
  }

  participants = participants.map((p) => ({
    ...p,
    left: withdrawnSet.has(p.participantId),
    active: !withdrawnSet.has(p.participantId),
  }));

  const response = {
    study: {
      id: study.study_id,
      title: study.title.ko,
      discordChannelUrl: study.discord_url ?? null,
      driveUrl: study.driveUrl ?? null,
    },
    studyGroup: {
      id: groupId,
      name: "내 스터디 분반",
      timezone: "Asia/Seoul",
      startTime: study.schedule?.ko.match(/(\d{1,2}:\d{2})/)?.[1] ?? "20:00",
      navigatorName,
      rules: rulesFor(study.study_id),
    },
    me: {
      participantId: 1,
      canEdit: isCaptain || isNavigator,
      captain: isCaptain,
    },
    participants,
    meetings: meetingsWithKickoff(study, crew.meetings).map((meeting) => ({
      id: numericId(meeting.id),
      type: meeting.no === 0 ? "KICKOFF" : "REGULAR",
      number: meeting.no,
      scheduledAt: scheduledAt(meeting.date, study),
      title: meeting.no === 0 ? "킥오프" : "",
      presenter1:
        study.study_id === 11 && meeting.no === 4
          ? { participantId: 2, name: "건우", active: true }
          : null,
      presenter2: null,
      started:
        new Date(scheduledAt(meeting.date, study)).getTime() <= Date.now(),
    })),
  };
  const baseMeetings = meetingState.get(study.study_id) ?? response.meetings;
  // 참여 중단한 사람은 아직 시작하지 않은 회차의 발표자에서 빠진다(10-18 D7). 지난 회차의 발표 기록은 남긴다
  const presenterOf = (p: MeetingRow["presenter1"], started: boolean) => {
    if (!p) return null;
    const active = !withdrawnSet.has(p.participantId);
    return active || started ? { ...p, active } : null;
  };
  const meetings = baseMeetings.map((m) => {
    const started = new Date(m.scheduledAt).getTime() <= Date.now();
    return {
      ...m,
      presenter1: presenterOf(m.presenter1, started),
      presenter2: presenterOf(m.presenter2, started),
    };
  });
  return { ...response, participants, meetings };
}

function studyIdOf(params: Record<string, string | string[]>) {
  return Number(
    Array.isArray(params.studyId) ? params.studyId[0] : params.studyId,
  );
}

/**
 * TODO(api): GET /api/studies/:studyId/meetings
 * TODO(api): POST /api/studies/:studyId/meetings
 * TODO(api): PUT /api/studies/:studyId/meetings/:meetingId
 * TODO(api): DELETE /api/studies/:studyId/meetings (본문 studyGroupId · meetingIds)
 * TODO(api): PUT /api/studies/:studyId/groups/:groupId/rules
 * TODO(api): PUT /api/studies/:studyId/meetings/:meetingId/presenters/:slot/me
 * TODO(api): DELETE /api/studies/:studyId/meetings/:meetingId/presenters/:slot/me
 */
export const studyMeetingsHandlers = mockClient.createHandlerGroup(
  "/api/studies",
  [
    {
      method: "GET",
      path: "/:studyId/meetings",
      presets: [
        {
          label: "정상",
          status: 200,
          response: (context: MockResolveContext) =>
            responseFor(context) ??
            HttpResponse.json(
              {
                errorCode: "NOT_FOUND",
                errorMessage: "스터디를 찾을 수 없습니다.",
              },
              { status: 404 },
            ),
        },
        {
          label: "권한 없음",
          status: 403,
          response: {
            errorCode: "FORBIDDEN",
            errorMessage: "권한이 없습니다.",
          },
        },
      ],
    },
    {
      method: "POST",
      path: "/:studyId/meetings",
      presets: [
        {
          label: "성공",
          status: 204,
          response: async ({ request, params }: MockResolveContext) => {
            const studyId = studyIdOf(params);
            const current = responseFor({ params })?.meetings ?? [];
            const body = (await request.json()) as {
              scheduledAts: string[];
              title?: string;
            };
            const next = [...current];
            body.scheduledAts.forEach((scheduledAt, index) =>
              next.push({
                id: Date.now() + index,
                type: "REGULAR",
                number: next.length + 1,
                scheduledAt,
                title: body.title ?? "",
                presenter1: null,
                presenter2: null,
                started: new Date(scheduledAt).getTime() <= Date.now(),
              }),
            );
            meetingState.set(studyId, next);
            return null;
          },
        },
        {
          label: "권한 없음",
          status: 403,
          response: {
            errorCode: "FORBIDDEN",
            errorMessage: "권한이 없습니다.",
          },
        },
      ],
    },
    {
      method: "PUT",
      path: "/:studyId/meetings/:meetingId",
      presets: [
        {
          label: "성공",
          status: 204,
          response: async ({ request, params }: MockResolveContext) => {
            const studyId = studyIdOf(params);
            const meetingId = Number(
              Array.isArray(params.meetingId)
                ? params.meetingId[0]
                : params.meetingId,
            );
            const body = (await request.json()) as {
              scheduledAt: string;
              title?: string;
              presenter1ParticipantId?: number | null;
              presenter2ParticipantId?: number | null;
            };
            const current = responseFor({ params })?.meetings ?? [];
            const participants = responseFor({ params })?.participants ?? [];
            const toPresenter = (id: number | null | undefined) => {
              if (!id) return null;
              const found = participants.find((p) => p.participantId === id);
              return found
                ? {
                    participantId: found.participantId,
                    name: found.name,
                    active: !found.left,
                  }
                : null;
            };
            meetingState.set(
              studyId,
              current.map((meeting) =>
                meeting.id === meetingId
                  ? {
                      ...meeting,
                      scheduledAt: body.scheduledAt,
                      title: body.title ?? "",
                      started:
                        new Date(body.scheduledAt).getTime() <= Date.now(),
                      presenter1:
                        "presenter1ParticipantId" in body
                          ? toPresenter(body.presenter1ParticipantId)
                          : meeting.presenter1,
                      presenter2:
                        "presenter2ParticipantId" in body
                          ? toPresenter(body.presenter2ParticipantId)
                          : meeting.presenter2,
                    }
                  : meeting,
              ),
            );
            return null;
          },
        },
        {
          label: "권한 없음",
          status: 403,
          response: {
            errorCode: "FORBIDDEN",
            errorMessage: "권한이 없습니다.",
          },
        },
      ],
    },
    {
      method: "DELETE",
      path: "/:studyId/meetings",
      presets: [
        {
          label: "성공",
          status: 204,
          response: async ({ params, request }: MockResolveContext) => {
            const studyId = studyIdOf(params);
            const body = (await request.json()) as { meetingIds: number[] };
            const ids = new Set(body.meetingIds);
            const current = responseFor({ params })?.meetings ?? [];
            meetingState.set(
              studyId,
              current.filter((meeting) => !ids.has(meeting.id)),
            );
            return null;
          },
        },
        {
          label: "시작한 회차가 섞임",
          status: 409,
          response: {
            errorCode: "MEETING_ALREADY_STARTED",
            errorMessage: "3회차는 이미 시작해 지울 수 없습니다.",
          },
        },
        {
          label: "권한 없음",
          status: 403,
          response: {
            errorCode: "FORBIDDEN",
            errorMessage: "권한이 없습니다.",
          },
        },
      ],
    },
    {
      method: "PUT",
      path: "/:studyId/groups/:groupId/rules",
      presets: [
        {
          label: "성공",
          status: 204,
          response: async ({ params, request }: MockResolveContext) => {
            const studyId = studyIdOf(params);
            try {
              const body = (await request.json()) as { rules?: string };
              if (body?.rules !== undefined) {
                rulesState.set(studyId, body.rules);
              }
            } catch {}
            return null;
          },
        },
        {
          label: "권한 없음",
          status: 403,
          response: {
            errorCode: "FORBIDDEN",
            errorMessage: "권한이 없습니다.",
          },
        },
      ],
    },
    {
      method: "PUT",
      path: "/:studyId/meetings/:meetingId/presenters/:slot/me",
      presets: [
        {
          label: "성공",
          status: 204,
          response: ({ params, request }: MockResolveContext) => {
            const studyId = studyIdOf(params);
            const meetingId = Number(
              Array.isArray(params.meetingId)
                ? params.meetingId[0]
                : params.meetingId,
            );
            const slot = Number(
              Array.isArray(params.slot) ? params.slot[0] : params.slot,
            ) as 1 | 2;
            const current = responseFor({ params, request })?.meetings ?? [];
            const myName = currentUserName(request);
            const me = { participantId: 1, name: myName, active: true };
            meetingState.set(
              studyId,
              current.map((m) =>
                m.id === meetingId
                  ? {
                      ...m,
                      ...(slot === 1 ? { presenter1: me } : { presenter2: me }),
                    }
                  : m,
              ),
            );
            return null;
          },
        },
        {
          label: "선착순 마감",
          status: 409,
          response: {
            errorCode: "PRESENTER_SLOT_TAKEN",
            errorMessage: "이미 다른 크루가 신청했습니다.",
          },
        },
        {
          label: "권한 없음",
          status: 403,
          response: {
            errorCode: "FORBIDDEN",
            errorMessage: "권한이 없습니다.",
          },
        },
      ],
    },
    {
      method: "DELETE",
      path: "/:studyId/meetings/:meetingId/presenters/:slot/me",
      presets: [
        {
          label: "성공",
          status: 204,
          response: ({ params, request }: MockResolveContext) => {
            const studyId = studyIdOf(params);
            const meetingId = Number(
              Array.isArray(params.meetingId)
                ? params.meetingId[0]
                : params.meetingId,
            );
            const slot = Number(
              Array.isArray(params.slot) ? params.slot[0] : params.slot,
            ) as 1 | 2;
            const current = responseFor({ params, request })?.meetings ?? [];
            meetingState.set(
              studyId,
              current.map((m) =>
                m.id === meetingId
                  ? {
                      ...m,
                      ...(slot === 1
                        ? { presenter1: null }
                        : { presenter2: null }),
                    }
                  : m,
              ),
            );
            return null;
          },
        },
        {
          label: "권한 없음",
          status: 403,
          response: {
            errorCode: "FORBIDDEN",
            errorMessage: "권한이 없습니다.",
          },
        },
      ],
    },
  ],
);
