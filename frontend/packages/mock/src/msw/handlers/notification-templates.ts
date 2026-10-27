import { mockClient } from "../utils";

export type ApiNotificationTemplate = {
  id: number;
  eventType: string;
  channel: string;
  subject: string;
  body: string;
  updatedAt: string | null;
  updatedByAdminId: number | null;
};

export const mockNotificationTemplates: ApiNotificationTemplate[] = [
  {
    id: 1,
    eventType: "USER_REGISTERED",
    channel: "EMAIL",
    subject: "[StudyClub] 가입을 환영합니다!",
    body: "안녕하세요, StudyClub에 오신 것을 환영합니다.",
    updatedAt: "2024-01-01T00:00:00Z",
    updatedByAdminId: 1,
  },
  // 같은 조건에 템플릿이 여럿일 수 있다 — 목록에서는 조건과 제목으로 구분한다
  {
    id: 2,
    eventType: "USER_REGISTERED",
    channel: "EMAIL",
    subject: "[StudyClub] 첫 스터디를 찾아보세요",
    body: "안녕하세요, {{nickname}}님.\n\n지금 모집 중인 스터디를 둘러보세요.",
    updatedAt: "2024-02-01T00:00:00Z",
    updatedByAdminId: 1,
  },
];

const notFound = { errorMessage: "템플릿을 찾을 수 없습니다." };
const serverError = { errorMessage: "서버 오류가 발생했습니다." };
const invalid = { errorMessage: "제목과 본문을 입력해 주세요." };
const taken = {
  errorMessage:
    "이미 이 알림 조건의 템플릿이 있습니다. 기존 템플릿을 수정하세요.",
};

/** 요청 바디를 읽어 저장된 모양으로 돌려준다. 목 서버라 목록(GET)에는 반영되지 않는다. */
async function savedTemplate({
  request,
  params,
}: {
  request: Request;
  params: Record<string, string | string[]>;
}) {
  const draft = (await request.json()) as {
    eventType: string;
    subject: string;
    body: string;
  };
  const id = Number(params.id ?? 3);
  return {
    id,
    ...draft,
    channel: "EMAIL",
    updatedAt: new Date().toISOString(),
    updatedByAdminId: 1,
  };
}

export const notificationTemplatesHandlers = mockClient.createHandlerGroup(
  "/api/admin/notification-templates",
  [
    {
      method: "GET",
      path: "/",
      presets: [
        { label: "정상", status: 200, response: mockNotificationTemplates },
        { label: "빈 목록", status: 200, response: [] },
        { label: "서버 오류", status: 500, response: serverError },
      ],
    },
    // 계약: specs/notification/spec.md — 같은 조건에 템플릿은 한 건뿐이라 이미 있으면 409
    {
      method: "POST",
      path: "/",
      presets: [
        { label: "추가됨", status: 201, response: savedTemplate },
        { label: "400 잘못된 입력", status: 400, response: invalid },
        { label: "409 이미 있는 조건", status: 409, response: taken },
        { label: "500 서버 오류", status: 500, response: serverError },
      ],
    },
    {
      method: "PUT",
      path: "/:id",
      presets: [
        { label: "수정됨", status: 200, response: savedTemplate },
        { label: "400 잘못된 입력", status: 400, response: invalid },
        { label: "404 이미 삭제됨", status: 404, response: notFound },
        { label: "500 서버 오류", status: 500, response: serverError },
      ],
    },
    {
      method: "DELETE",
      path: "/:id",
      presets: [
        { label: "삭제됨", status: 204, response: null },
        { label: "404 이미 삭제됨", status: 404, response: notFound },
        { label: "500 서버 오류", status: 500, response: serverError },
      ],
    },
  ],
);
