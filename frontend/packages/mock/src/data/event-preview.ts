import type { EventPreviewState, PreviewEvent } from "@studyclub/types";

/** 실제 행사·회원과 무관한 예시. 초기화한 날을 기준으로 다음 행사를 만든다. */
export function createEventPreviewState(now = new Date()): EventPreviewState {
  const date = new Date(now.getTime() + 14 * 86400000)
    .toISOString()
    .slice(0, 10);
  const deadline = new Date(now.getTime() + 12 * 86400000)
    .toISOString()
    .slice(0, 10);
  const base: PreviewEvent = {
    id: "preview-event-community",
    title: "함께 만드는 개발자 커뮤니티",
    summary: "작은 경험을 나누고, 다음 도전을 함께 찾아요.",
    description:
      "각자의 프로젝트에서 배운 점을 나누는 커뮤니티 토크입니다.\n\n첫 60분은 경험 공유와 질의응답, 마지막 30분은 자유로운 대화로 진행해요. 온라인과 오프라인 중 편한 방식으로 참여해 주세요.\n\n운영진이 신청 내용을 확인한 뒤 참가 확정 메일을 보내드립니다. 자세한 참여 안내도 확정 후 확인할 수 있어요.",
    startsAt: `${date}T10:00:00+09:00`,
    endsAt: `${date}T11:30:00+09:00`,
    deadlineAt: `${deadline}T23:00:00+09:00`,
    timeZone: "Asia/Seoul",
    format: "HYBRID",
    location: "서울 커뮤니티 라운지 (예시)",
    onlineUrl: "https://example.com/event-room",
    onlineCapacity: 30,
    offlineCapacity: 4,
    confirmation: "REVIEW",
    status: "PUBLISHED",
    publishedAt: now.toISOString(),
    questions: [
      {
        id: "q-expectation",
        label: "이번 행사에서 나누고 싶은 이야기가 있나요?",
        type: "TEXTAREA",
        required: false,
        options: [],
      },
      {
        id: "q-interest",
        label: "가장 관심 있는 주제는 무엇인가요?",
        type: "RADIO",
        required: true,
        options: ["프로젝트 경험", "커리어 이야기", "커뮤니티 활동"],
      },
    ],
  };
  return {
    version: 1,
    events: [
      base,
      {
        ...base,
        id: "preview-event-coffee",
        title: "주말 온라인 커피챗",
        summary: "커피 한 잔과 함께 가볍게 이야기해요.",
        description:
          "최근에 배우고 있는 것, 해결해 보고 싶은 문제를 편하게 이야기해요.\n\n신청하면 바로 참가가 확정됩니다. 행사 시간에 참여 링크로 들어와 주세요.",
        format: "ONLINE",
        confirmation: "AUTO",
        onlineCapacity: 12,
        questions: [],
      },
    ],
    registrations: [
      {
        id: "sample-1",
        eventId: base.id,
        memberId: "sample-1",
        name: "예시 크루 하나",
        email: "crew1@example.test",
        channel: "OFFLINE",
        status: "PENDING",
        createdAt: now.toISOString(),
        questions: base.questions,
        answers: {
          "q-interest": "프로젝트 경험",
          "q-expectation": "작은 프로젝트를 꾸준히 이어가는 방법이 궁금해요.",
        },
      },
      {
        id: "sample-2",
        eventId: base.id,
        memberId: "sample-2",
        name: "예시 크루 둘",
        email: "crew2@example.test",
        channel: "ONLINE",
        status: "PENDING",
        createdAt: now.toISOString(),
        questions: base.questions,
        answers: { "q-interest": "커리어 이야기" },
      },
      {
        id: "sample-3",
        eventId: base.id,
        memberId: "sample-3",
        name: "예시 크루 셋",
        email: "crew3@example.test",
        channel: "OFFLINE",
        status: "CONFIRMED",
        createdAt: now.toISOString(),
        questions: base.questions,
        answers: { "q-interest": "커뮤니티 활동" },
      },
    ],
    mails: [],
  };
}
