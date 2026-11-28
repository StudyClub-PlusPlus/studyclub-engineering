import type { ApplicationQuestion } from "@studyclub/types";

export const DEMO_APPLICATION_FORM: ApplicationQuestion[] = [
  {
    id: "reason",
    label: "지원 사유",
    type: "text",
    required: true,
    placeholder: "내 답변",
  },
  {
    id: "intro",
    label: "하고 싶은 말",
    type: "textarea",
    required: false,
    placeholder: "내 답변",
    description: "선택 입력입니다.\n\n**자유롭게** 적어도 됩니다.",
  },
  {
    id: "time",
    label: "참여 가능 시간을 모두 선택하세요",
    type: "checkbox",
    required: true,
    options: ["평일 오전", "평일 오후", "주말 오전", "주말 오후"],
    allowOther: true,
  },
  {
    id: "level",
    label: "희망 난이도를 선택하세요",
    type: "radio",
    required: true,
    options: ["입문", "초급", "중급", "고급", "심화"],
    allowOther: true,
  },
  {
    id: "kickoff",
    label:
      "킥오프 모임이 없는 스터디임을 확인하였습니다. 가이드를 잘 읽고, 궁금한 점이 있으면 질문하겠습니다.",
    type: "select",
    required: true,
    options: ["예", "아니오"],
  },
];

/**
 * 클럽 신청 폼 — 2026-12 기수 구글 폼을 옮겼다. 디스코드 닉네임 · 이름 · 이메일은 계정과 디스코드 연동이 대신하고,
 * 개인정보 동의는 사이트 약관이 대신해 넣지 않는다. 키는 클럽(기수 id 의 앞부분)이다.
 */
export const CLUB_APPLICATION_FORMS: Record<string, ApplicationQuestion[]> = {
  "early-bird": [
    {
      id: "wake-goal",
      label: "목표 시간",
      type: "radio",
      required: true,
      options: ["오전 5시", "오전 6시", "오전 7시", "오전 8시", "오전 9시"],
      allowOther: true,
    },
    {
      id: "goal",
      label: "얼리버드에서 목표하고자 하는 바",
      type: "textarea",
      required: true,
      placeholder: "내 답변",
    },
    {
      id: "kickoff",
      label:
        "킥오프 모임이 없는 스터디임을 확인하였습니다. 가이드를 잘 읽고, 궁금한 점이 있으면 질문하겠습니다.",
      type: "select",
      required: true,
      options: ["동의합니다"],
    },
  ],
  weeklyx: [
    {
      id: "x-hours",
      label: "목표하는 나의 X 시간",
      type: "text",
      required: true,
      placeholder: "예: 7시간",
      description:
        "매주 내가 채우고자 하는 공부 시간 (예: 7시간, 15시간, 20시간)",
    },
    {
      id: "topic",
      label: "무엇을 공부하려고 하시나요? (참고용)",
      type: "text",
      required: false,
      placeholder: "내 답변",
    },
    {
      id: "kickoff",
      label:
        "킥오프 모임이 없으므로 가이드를 확인하고, 필요한 사항이 있으면 문의하겠습니다.",
      type: "select",
      required: true,
      options: ["동의합니다"],
    },
  ],
  "daily-leetcode": [
    {
      id: "leetcode-nickname",
      label: "리트코드 닉네임 (이메일 주소 X)",
      type: "text",
      required: true,
      placeholder: "내 답변",
      description:
        "가입 이메일이나 아이디가 아니라 **프로필 주소(leetcode.com/u/\*\*\*)의 \*\*\* 부분**입니다. 잘못 적으면 기록이 업데이트되지 않아 제명될 수 있어요. 없으면 회원가입 먼저 해 주세요.",
    },
  ],
};
