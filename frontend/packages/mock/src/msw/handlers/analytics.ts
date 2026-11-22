import { mockClient } from "../utils";

// 개발용 미리보기에서는 실제 분석 도구로 데이터를 보내지 않는다.
export const analyticsHandlers = mockClient.createHandlerGroup(
  "/api/me/analytics",
  [
    {
      method: "GET",
      path: "",
      presets: [
        {
          label: "분석 비활성화 (개발 기본)",
          status: 200,
          response: { userId: null, enabled: false, optedOutAt: null },
        },
        {
          label: "분석 중단 완료",
          status: 200,
          response: {
            userId: null,
            enabled: false,
            optedOutAt: "2026-11-08T00:00:00Z",
          },
        },
      ],
    },
    {
      method: "POST",
      path: "/browser",
      presets: [
        {
          label: "분석 비활성화",
          status: 200,
          response: { userId: null, enabled: false, optedOutAt: null },
        },
      ],
    },
  ],
);
