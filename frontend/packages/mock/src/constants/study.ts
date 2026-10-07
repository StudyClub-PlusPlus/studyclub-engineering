import type { ApplicationQuestion } from '../types/study';

export const STUDY_CATEGORIES = [
  "AI · ML",
  "알고리즘",
  "데이터",
  "소프트웨어 개발",
  "커리어",
  "북클럽",
  "어학",
  "라이프스타일",
  "기획 · PM",
  "비즈니스",
  "기타",
] as const;

export const CATEGORY_DISPLAY: Record<string, string> = {
  AI_ML: "AI · ML",
  ALGORITHM: "알고리즘",
  DATA: "데이터",
  SOFTWARE: "소프트웨어 개발",
  CAREER: "커리어",
  BOOK_CLUB: "북클럽",
  LANGUAGE: "어학",
  LIFESTYLE: "라이프스타일",
  PRODUCT: "기획 · PM",
  BUSINESS: "비즈니스",
  OTHER: "기타",
};

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
