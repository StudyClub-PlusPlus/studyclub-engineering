import type { EventNoticeTemplate, EventPreviewState, EventRegistration, PreviewEvent, PreviewNotificationTemplate } from "@studyclub/types";

export const EVENT_NOTICE_TEMPLATE: EventNoticeTemplate = {
  id: 3,
  trigger: "EVENT_ANNOUNCEMENT",
  channel: "EMAIL",
  subject: "[StudyClub] {{eventTitle}} 안내",
  body: "안녕하세요, {{nickname}}님.\n\n{{eventTitle}} 행사 안내드립니다.\n\n{{notice}}\n\n일정: {{eventSchedule}}\n참여 안내: {{participation}}\n\n감사합니다.\nStudyClub 드림",
  updatedAt: "2026-11-14T00:00:00Z",
};

const eventStatusBody = (label: string, content: string, detailTitle: string, detail: string) => `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${label}</title>
</head>
<body style="margin:0;padding:0;background:#F5F7FF;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#282A43;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
          <tr>
            <td style="padding:0 8px 16px;font-size:18px;font-weight:700;">StudyClub</td>
          </tr>
          <tr>
            <td style="background:#fff;border:1px solid #E2E1E9;border-radius:12px;padding:36px 40px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#5267D8;">${label}</p>
              <h1 style="margin:0 0 20px;font-size:24px;line-height:34px;">{{eventTitle}}</h1>
              <p style="margin:0 0 24px;font-size:16px;line-height:26px;color:#626476;">안녕하세요, {{nickname}}님.</p>
              <div style="font-size:15px;line-height:25px;color:#282A43;">
                ${content}
              </div>
              <div style="margin-top:24px;padding:18px;background:#F5F7FF;border-radius:8px;">
                <p style="margin:0 0 10px;font-size:14px;font-weight:700;">${detailTitle}</p>
                ${detail}
              </div>
              <div style="height:1px;background:#E2E1E9;margin:28px 0 22px;"></div>
              <p style="margin:0;font-size:14px;line-height:22px;color:#626476;">
                궁금한 사항이 있다면 운영진에게 문의해 주세요.<br><br>
                감사합니다.<br>
                <span style="color:#282A43;">StudyClub 드림</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export const EVENT_STATUS_TEMPLATES: PreviewNotificationTemplate[] = [
  {
    id: 4,
    trigger: "EVENT_REGISTRATION_CONFIRMED",
    channel: "EMAIL",
    subject: "[StudyClub] {{eventTitle}} 참가가 확정되었습니다",
    body: eventStatusBody(
      "참가 확정",
      "<p style=\"margin:0;\"><strong>{{eventTitle}}</strong> 행사 참가가 확정되었습니다.</p>",
      "참여 안내",
      "<p style=\"margin:0;font-size:14px;line-height:22px;\">일정: {{eventSchedule}}<br>참여 방식: {{channel}}<br>{{participation}}</p>",
    ),
    updatedAt: "2026-11-14T00:00:00Z",
  },
  {
    id: 5,
    trigger: "EVENT_REGISTRATION_PENDING",
    channel: "EMAIL",
    subject: "[StudyClub] {{eventTitle}} 신청이 확인 대기 중입니다",
    body: eventStatusBody(
      "확인 대기",
      "<p style=\"margin:0;\"><strong>{{eventTitle}}</strong> 행사 신청이 정상적으로 접수되었습니다.<br>현재 운영진이 신청 내용을 확인하고 있습니다. 참가 여부가 결정되면 이메일로 다시 안내해 드립니다.</p>",
      "신청 정보",
      "<p style=\"margin:0;font-size:14px;line-height:22px;\">일정: {{eventSchedule}}<br>참여 방식: {{channel}}</p>",
    ),
    updatedAt: "2026-11-14T00:00:00Z",
  },
  {
    id: 6,
    trigger: "EVENT_REGISTRATION_DECLINED",
    channel: "EMAIL",
    subject: "[StudyClub] {{eventTitle}} 참가 결과를 안내드립니다",
    body: eventStatusBody(
      "참가 불가",
      "<p style=\"margin:0;\">아쉽게도 이번 행사에는 함께하기 어렵게 되었습니다.<br>관심을 가지고 신청해 주셔서 감사드리며, 다음 행사에서 다시 만나 뵐 수 있기를 바랍니다.</p>",
      "신청 정보",
      "<p style=\"margin:0;font-size:14px;line-height:22px;\">일정: {{eventSchedule}}<br>참여 방식: {{channel}}</p>",
    ),
    updatedAt: "2026-11-14T00:00:00Z",
  },
  {
    id: 7,
    trigger: "EVENT_REGISTRATION_CANCELLED",
    channel: "EMAIL",
    subject: "[StudyClub] {{eventTitle}} 신청이 취소되었습니다",
    body: eventStatusBody(
      "신청 취소",
      "<p style=\"margin:0;\"><strong>{{eventTitle}}</strong> 행사 신청이 취소되었습니다.<br>행사가 아직 모집 중이라면 행사 페이지에서 다시 신청할 수 있습니다.</p>",
      "취소된 신청 정보",
      "<p style=\"margin:0;font-size:14px;line-height:22px;\">일정: {{eventSchedule}}<br>참여 방식: {{channel}}</p>",
    ),
    updatedAt: "2026-11-14T00:00:00Z",
  },
];

/** 메인 디스코드 실제 행사 기반. 일정·확정 방식·신청자는 체험용이며 원문 출처는 PRD에 기록한다. */
export function createEventPreviewState(now = new Date(), noticeBody = EVENT_NOTICE_TEMPLATE.body): EventPreviewState {
  const date = new Date(now.getTime() + 14 * 86400000)
    .toISOString()
    .slice(0, 10);
  const deadline = new Date(now.getTime() + 12 * 86400000)
    .toISOString()
    .slice(0, 10);
  const day = (offset: number) => new Date(now.getTime() + offset * 86400000).toISOString().slice(0, 10);
  const base: PreviewEvent = {
    id: "preview-event-community",
    title: "Next 30 Years: AI 시대 개발자의 새로운 생존 전략",
    summary: "코드별 연사님과 함께 AI 시대 개발자의 다음 30년을 이야기합니다.",
    description:
      "AI가 바꿀 산업과 사회, 개발자의 역할, 글로벌 경쟁 속에서 필요한 성장 전략을 함께 살펴봅니다.\n\n연사: 코드별 (가명)\n개발과 커리어에 관한 경험을 나누고 참가자들의 질문에 답합니다.\n\n오프라인은 서니베일 드림센터에서, 온라인은 Google Meet으로 함께합니다. 온라인 참여 링크는 행사 전날 안내드립니다.",
    startsAt: `${date}T18:00:00-08:00`,
    endsAt: `${date}T21:00:00-08:00`,
    deadlineAt: `${deadline}T23:00:00-08:00`,
    timeZone: "America/Los_Angeles",
    format: "HYBRID",
    location: "서니베일 드림센터, 1290 Reamwood Ave suite B, Sunnyvale, CA 94089",
    onlineUrl: "",
    onlineCapacity: 100,
    offlineCapacity: 50,
    confirmation: "REVIEW",
    status: "PUBLISHED",
    publishedAt: new Date(now.getTime() - 7 * 86400000).toISOString(),
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
  const events: PreviewEvent[] = [
      base,
      {
        ...base,
        id: "preview-event-coffee",
        title: "강화학습, 한 시간 만에 격파합니다",
        summary: "AI 논문 스터디에서 강화학습의 큰 구조를 함께 살펴봅니다.",
        description:
          "DP, RL, DRL, MPO를 상태가치 V·행동가치 Q·정책 π라는 틀로 연결해 봅니다.\n\n가치 평가와 정책 개선, 두 가지를 결합하는 과정을 따라가며 강화학습의 전체 구조를 살펴보는 특강입니다.\n\n장소: 스터디클럽 디스코드 AI 논문 스터디 공부방",
        startsAt: `${day(7)}T17:00:00-08:00`,
        deadlineAt: `${day(6)}T23:00:00-08:00`,
        endsAt: "",
        location: "",
        format: "ONLINE",
        confirmation: "AUTO",
        onlineCapacity: 100,
        questions: [
          { id: 'q-rl-level', label: '강화학습을 어느 정도 접해 보셨나요?', type: 'RADIO', required: false, options: ['처음 접해요', '기초 개념을 알아요', '논문이나 구현 경험이 있어요'] },
          { id: 'q-rl-topics', label: '특히 궁금한 주제를 골라 주세요.', type: 'CHECKBOX', required: false, options: ['가치 함수', '정책 최적화', '실습 방법', '논문 읽기'] },
          { id: 'q-rl-question', label: '미리 나누고 싶은 질문이 있나요?', type: 'TEXTAREA', required: false, options: [] },
        ],
      },
      {
        ...base,
        id: "preview-event-picnic",
        title: "베이 지역 가을 피크닉",
        summary: "함께 즐기고 이야기 나누는 스터디클럽 야외 모임",
        description: "알고리즘 스터디 종강을 기념해 준비한 베이 지역 피크닉입니다. 스터디 참여 여부와 관계없이 스터디클럽 멤버라면 함께할 수 있습니다.\n\n게임과 네트워킹을 함께 즐깁니다. 별도 준비물은 없고, 식사 비용은 참가자끼리 나누어 부담합니다.\n\n공원 내 음주가 금지되어 있어 주류를 가져올 수 없습니다. 정원은 30명입니다.",
        startsAt: `${day(21)}T16:00:00-08:00`,
        deadlineAt: `${day(20)}T23:00:00-08:00`,
        endsAt: "",
        format: "OFFLINE",
        confirmation: "AUTO",
        location: "Washington Park, 840 W Washington Ave, Sunnyvale, CA",
        offlineCapacity: 30,
        questions: [
          { id: 'q-picnic-food', label: '식사 준비에 참고할 사항이 있나요?', type: 'RADIO', required: false, options: ['없어요', '채식 메뉴를 선호해요', '개별 도시락을 가져갈게요'] },
          { id: 'q-picnic-game', label: '함께 하고 싶은 활동을 골라 주세요.', type: 'CHECKBOX', required: false, options: ['보드게임', '가벼운 산책', '커리어 이야기', '사진 찍기'] },
          { id: 'q-picnic-note', label: '운영진에게 전할 말이 있나요?', type: 'TEXTAREA', required: false, options: [] },
        ],
      },
    ];
  const relative = (days: number, hours = 0) => new Date(now.getTime() + days * 86400000 + hours * 3600000).toISOString();
  const talk = events[0]!;
  const lecture = events[1]!;
  const picnic = events[2]!;
  events.push(
    {
      ...talk, id: 'preview-event-closed', title: 'AI 커리어 토크',
      summary: 'AI를 활용하는 개발자의 경험과 고민을 함께 나눕니다.',
      description: 'AI를 활용하며 일하는 개발자들의 실제 경험과 커리어 고민을 나누는 대화 모임입니다.\n\n온라인과 오프라인으로 함께하며, 짧은 발표 이후에는 참가자 질문을 중심으로 자유롭게 이야기를 나눕니다. AI 시대의 커리어 방향을 함께 고민하고 싶은 분이라면 누구나 신청할 수 있습니다.',
      status: 'CLOSED', startsAt: relative(3), endsAt: relative(3, 2), deadlineAt: relative(-1),
      onlineCapacity: 12, offlineCapacity: 8,
      questions: [...structuredClone(talk.questions), { id: 'q-role', label: '요즘 어떤 일을 하고 계신가요?', type: 'TEXT', required: false, options: [] }],
    },
    {
      ...lecture, id: 'preview-event-finished', title: '강화학습 기초 특강 · 1회차',
      summary: '가치 함수와 정책의 관계를 차근차근 살펴봅니다.',
      description: '강화학습을 처음 접하는 분을 위한 기초 특강입니다. 가치 함수와 정책의 관계를 중심으로 핵심 개념을 살펴보고, 간단한 적용 사례를 함께 풀어봅니다.\n\n사전 지식은 필요하지 않습니다. 궁금한 점이 있다면 신청폼에 미리 남겨 주세요.',
      status: 'CLOSED', publishedAt: relative(-24), startsAt: relative(-14), endsAt: relative(-14, 2), deadlineAt: relative(-15),
      timeZone: 'Asia/Seoul', onlineCapacity: 30, onlineUrl: 'https://example.com/?event=rl-session-1',
    },
    {
      ...picnic, id: 'preview-event-cancelled', title: '베이 지역 피크닉',
      status: 'CANCELLED', startsAt: relative(2), endsAt: relative(2, 3), deadlineAt: relative(-2),
    },
    {
      ...lecture, id: 'preview-event-draft', title: 'AI 논문 읽기, 첫걸음',
      summary: '처음 논문을 읽는 크루를 위한 온라인 모임을 준비하고 있습니다.',
      description: '짧은 논문 한 편을 함께 읽으며 배경, 핵심 아이디어, 실험 결과를 차례로 살펴봅니다.\n\n참가 조건은 없습니다. 읽기 전에 궁금한 점을 신청폼으로 남겨 주세요. 노트북과 메모할 도구가 있으면 좋습니다.',
      status: 'DRAFT', publishedAt: undefined, startsAt: relative(28), endsAt: '', deadlineAt: relative(26),
      timeZone: 'America/Toronto', confirmation: 'REVIEW', onlineCapacity: 20,
      questions: [
        { id: 'q-draft-role', label: '현재 관심 있는 분야를 알려 주세요.', type: 'TEXT', required: true, options: [] },
        { id: 'q-draft-experience', label: '논문을 읽어 본 경험이 있나요?', type: 'RADIO', required: true, options: ['처음이에요', '몇 편 읽어 봤어요', '꾸준히 읽고 있어요'] },
        { id: 'q-draft-topic', label: '함께 읽고 싶은 분야를 골라 주세요.', type: 'CHECKBOX', required: false, options: ['강화학습', '자연어 처리', '컴퓨터 비전', '추천 시스템'] },
        { id: 'q-draft-source', label: '모임을 어디서 알게 되셨나요?', type: 'RADIO', required: false, options: ['디스코드 공지', '스터디 크루 추천', '홈페이지'] },
        { id: 'q-draft-question', label: '모임에서 얻고 싶은 점을 알려 주세요.', type: 'TEXTAREA', required: false, options: [] },
      ],
    },
    {
      ...picnic, id: 'preview-event-full', title: '주말 산책과 커리어 대화',
      summary: '공원을 걸으며 개발과 커리어 이야기를 나누는 소규모 모임입니다.',
      description: '가볍게 공원을 걸으며 개발과 커리어 이야기를 나눕니다.\n\n서로 충분히 이야기할 수 있도록 8명만 함께합니다. 편한 신발과 물을 준비해 주세요.\n\n관심 있는 분야와 요즘의 고민을 편하게 나누며 새로운 크루를 만나 보세요.',
      startsAt: relative(5), endsAt: relative(5, 2), deadlineAt: relative(4), offlineCapacity: 8,
      questions: [
        { id: 'q-walk-topic', label: '이번 산책에서 나누고 싶은 주제가 있나요?', type: 'TEXT', required: false, options: [] },
        { id: 'q-walk-pace', label: '편하게 느끼는 산책 속도를 골라 주세요.', type: 'RADIO', required: true, options: ['천천히 이야기하며 걷기', '보통 속도로 걷기'] },
      ],
    },
    {
      ...lecture, id: 'preview-event-live', title: '강화학습 오피스아워',
      summary: '강화학습을 공부하며 생긴 질문을 함께 풀어 보는 온라인 모임입니다.',
      description: '특강을 듣고 생긴 질문을 함께 정리하는 오피스아워입니다.\n\n가치 함수와 정책, 논문을 읽으며 막혔던 부분을 편하게 질문해 주세요. 질문을 미리 적어 오시면 함께 살펴보겠습니다.\n\n처음 공부하는 분도 참여할 수 있으며 별도 실습 환경은 필요하지 않습니다.',
      startsAt: relative(0, -0.5), endsAt: relative(0, 1.5), deadlineAt: relative(0, -2), onlineCapacity: 20,
      timeZone: 'America/New_York', onlineUrl: 'https://example.com/?event=rl-office-hours',
    },
  );
  const registrations = createExampleRegistrations(events, now);
  for (const event of events.filter((item) => item.status === 'CANCELLED')) {
    event.cancellationRecipientIds = registrations.filter((row) => row.eventId === event.id).map((row) => row.id);
  }
  return {
    version: 2,
    eventTemplates: [{ ...structuredClone(EVENT_NOTICE_TEMPLATE), body: noticeBody }],
    notificationTemplates: [
      { ...structuredClone(EVENT_NOTICE_TEMPLATE), body: noticeBody },
      ...structuredClone(EVENT_STATUS_TEMPLATES),
    ],
    events,
    registrations,
    mails: [],
  };
}

// 기존 스터디 플레이그라운드처럼 짧은 가명과 로마자+숫자 이메일을 사용한다. 실제 회원 정보가 아니다.
const PEOPLE = [
  ['지원', 'jiwon24'], ['민서', 'minseo38'], ['도윤', 'doyun17'],
  ['서연', 'seoyeon92'], ['하준', 'hajun56'], ['예린', 'yerin31'],
  ['시우', 'siwoo67'], ['수아', 'sua85'], ['지호', 'jiho43'],
  ['채원', 'chaewon19'], ['건우', 'gunwoo72'], ['유나', 'yuna46'],
  ['민준', 'minjun28'], ['소율', 'soyul63'], ['준서', 'junseo51'],
  ['다인', 'dain90'], ['현우', 'hyunwoo34'], ['지안', 'jian76'],
  ['태윤', 'taeyun15'], ['은서', 'eunseo48'], ['성민', 'seongmin62'],
  ['루아', 'rua83'], ['세아', 'sea29'], ['정우', 'jungwoo54'],
  ['하린', 'harin37'], ['서우', 'seowoo69'], ['지율', 'jiyul21'],
  ['유진', 'yujin95'], ['나은', 'naeun44'], ['연우', 'yeonwoo58'],
] as const;
const DOMAINS = ['gmail.com', 'naver.com', 'kakao.com', 'daum.net', 'outlook.com'];

function createExampleRegistrations(events: PreviewEvent[], now: Date): EventRegistration[] {
  return events.flatMap((event, group) => {
    const count = [18, 14, 12, 10, 16, 10, 0, 8, 10][group]!;
    const theme = [0, 1, 2, 0, 1, 2, 1, 2, 1][group]!;
    return Array.from({ length: count }, (_, index): EventRegistration => {
      const person = PEOPLE[(index + group * 8) % PEOPLE.length]!;
      const status: EventRegistration['status'] = group === 5 ? 'CANCELLED' : group === 7 ? 'CONFIRMED' : theme === 0
        ? (['PENDING', 'PENDING', 'CONFIRMED', 'CONFIRMED', 'CONFIRMED', 'PENDING', 'DECLINED', 'CANCELLED', 'CONFIRMED'][index % 9] as EventRegistration['status'])
        : index % 6 === 5 ? 'CANCELLED' : 'CONFIRMED';
      const answerExamples: EventRegistration['answers'] = theme === 0 ? {
        'q-interest': ['프로젝트 경험', '커리어 이야기', '커뮤니티 활동'][index % 3]!,
        'q-expectation': ['작은 프로젝트를 꾸준히 이어가는 방법이 궁금해요.', 'AI 도구를 업무에 활용한 경험을 나누고 싶어요.', '다른 분야 개발자들과 커리어 이야기를 나누고 싶어요.', '처음 참여합니다. 편하게 이야기 나누고 싶어요.', '개인 프로젝트를 서비스로 발전시킨 경험이 궁금해요.', '팀에서 배운 내용을 커뮤니티와 나누고 싶어요.'][index % 6]!,
      } : theme === 1 ? {
        'q-rl-level': ['처음 접해요', '기초 개념을 알아요', '논문이나 구현 경험이 있어요'][index % 3]!,
        'q-rl-topics': index % 2 ? ['정책 최적화', '논문 읽기'] : ['가치 함수', '실습 방법'],
        'q-rl-question': ['처음 읽기 좋은 강화학습 논문이 궁금해요.', '작은 예제로 가치 함수를 이해하고 싶어요.', '정책 기반 방법과 가치 기반 방법의 차이가 궁금해요.', '실습 환경을 구성하는 방법을 알고 싶어요.'][index % 4]!,
      } : {
        'q-picnic-food': ['없어요', '채식 메뉴를 선호해요', '개별 도시락을 가져갈게요'][index % 3]!,
        'q-picnic-game': index % 2 ? ['보드게임', '커리어 이야기'] : ['가벼운 산책', '사진 찍기'],
        'q-picnic-note': ['첫 오프라인 모임이라 기대돼요!', '간단한 보드게임을 가져갈 수 있어요.', '시작 시간에 맞춰 도착하겠습니다.', '새로운 크루들과 이야기 나누고 싶어요.'][index % 4]!,
      };
      const answers = Object.fromEntries(event.questions.map((question) => [question.id, answerExamples[question.id] ?? (
        question.type === 'CHECKBOX' ? question.options.slice(0, 2)
          : ['RADIO', 'SELECT'].includes(question.type) ? question.options[index % question.options.length]!
          : question.id === 'q-role' ? ['웹 서비스를 개발하고 있어요.', '데이터와 AI를 공부하고 있어요.', '개인 프로젝트를 만들고 있어요.'][index % 3]!
          : ['팀에서 성장하는 방법이 궁금해요.', '함께 프로젝트할 크루를 만나고 싶어요.', '새로운 분야에 도전한 경험을 나누고 싶어요.'][index % 3]!
      )]));
      const previewMember = [3, 4, 5, 8].includes(group) && index === 0;
      return {
        id: group === 0 && index < 3 ? `sample-${index + 1}` : `sample-${event.id}-${index + 1}`,
        eventId: event.id,
        memberId: previewMember ? 'preview-self' : group === 0 && index < 3 ? `sample-${index + 1}` : `sample-person-${(index + group * 8) % PEOPLE.length}`,
        name: previewMember ? '코딩구름' : person[0],
        email: previewMember ? 'me@example.test' : `${person[1]}@${DOMAINS[((index + group * 8) % PEOPLE.length) % DOMAINS.length]}`,
        channel: event.format === 'ONLINE' ? 'ONLINE' : event.format === 'OFFLINE' ? 'OFFLINE' : index % 2 ? 'ONLINE' : 'OFFLINE',
        status,
        createdAt: new Date(Math.min(now.getTime(), Date.parse(event.deadlineAt)) - (count - index) * 5 * 3600000).toISOString(),
        questions: structuredClone(event.questions),
        answers,
      };
    });
  });
}
