import { monthlyClubCohorts, type StudyDraft } from './helpers';

export const STUDIES_RECRUITING: StudyDraft[] = [
  // ── 예정(모집중) ────────────────────────────────────────────────────
  {
    id: 'ai-paper-study',
    kind: 'study',
    title: { ko: 'AI 논문 스터디', en: 'AI Paper Study' },
    host: {
      name: { ko: 'H. 김', en: 'H. Kim' },
      credential: {
        ko: '現 AI 리서처 · 논문 리뷰어',
        en: 'AI Researcher · paper reviewer',
      },
    },
    summary: {
      ko: '최신 AI·딥러닝 논문을 함께 읽고 발표·토론합니다.',
      en: 'Read, present, and discuss the latest AI and deep-learning papers.',
    },
    status: 'recruiting',
    format: 'online',
    category: 'AI · ML',
    schedule: { ko: '매주 목 20:00 · 8주 과정', en: 'Thu 8:00 PM · 8 weeks' },
    description: {
      ko: '매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.',
      en: 'Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.',
    },
    recruit_url: 'https://forms.gle/Zynn7eGdjQZQLUEx9',
    recruitment: {
      status: 'open',
      deadline: '2026-12-31',
      cadence: 'one-time',
      form_url: 'https://forms.gle/Zynn7eGdjQZQLUEx9',
    },
    order: 1,
    year: '2026',
  },
  {
    id: 'pytorch-ai-coding',
    kind: 'study',
    title: {
      ko: 'PyTorch AI 실전 코딩 스터디',
      en: 'PyTorch AI Hands-on Coding',
    },
    host: {
      name: { ko: 'J. 신', en: 'J. Shin' },
      credential: { ko: '現 빅테크 MLE · 10년차', en: 'Big-tech MLE · 10 yrs' },
    },
    summary: {
      ko: 'Deep Learning·Attention·GPT 개념을 PyTorch로 구현 (10/15 시작).',
      en: 'Implement deep learning, attention, and GPT concepts in PyTorch (starts 10/15).',
    },
    status: 'recruiting',
    format: 'online',
    category: 'AI · ML',
    description: {
      ko: '매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.',
      en: 'Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.',
    },
    recruit_url: 'https://forms.gle/CLEr7JzvjwxkdTGP8',
    recruitment: {
      status: 'open',
      deadline: '2026-10-10',
      cadence: 'one-time',
      form_url: 'https://forms.gle/CLEr7JzvjwxkdTGP8',
      kickoff: '10/15 시작',
    },
    order: 2,
    year: '2026',
  },
  {
    id: 'python-pandas-ml-coding',
    kind: 'study',
    title: {
      ko: 'Python(Pandas) & ML(Numpy) 실전 코딩',
      en: 'Python (Pandas) & ML (Numpy) Coding',
    },
    host: {
      name: { ko: 'S. 이', en: 'S. Lee' },
      credential: { ko: '現 데이터 사이언티스트', en: 'Data Scientist' },
    },
    summary: {
      ko: 'Data Scientist/Analyst를 위한 파이썬·ML 실전 코딩.',
      en: 'Hands-on Python and ML coding for data scientists and analysts.',
    },
    status: 'recruiting',
    format: 'online',
    category: 'AI · ML',
    schedule: { ko: '매주 목 20:00 · 8주 과정', en: 'Thu 8:00 PM · 8 weeks' },
    description: {
      ko: '매주 정해진 논문이나 자료를 각자 읽고 모여서 정리한 내용을 나눕니다. 발표자는 돌아가며 맡고, 나머지는 미리 읽어 온 뒤 질문을 준비합니다. 이론만 훑지 않고 코드나 실제 사례로 확인하는 시간을 함께 가집니다. 배경 지식이 부족해도 따라올 수 있도록 첫 주에 기초를 정리하고 시작합니다.',
      en: 'Each week we read the assigned paper or material on our own, then meet to share what we took away. Presenters rotate, and everyone comes with questions prepared. We go beyond theory by checking ideas against code or real cases. The first week covers fundamentals so newcomers can keep up.',
    },
    recruit_url: 'https://forms.gle/Xj2u6v3npRSrzSV19',
    recruitment: {
      status: 'open',
      deadline: '2026-12-31',
      cadence: 'one-time',
      form_url: 'https://forms.gle/Xj2u6v3npRSrzSV19',
    },
    order: 3,
    year: '2026',
  },
  {
    id: 'early-bird',
    kind: 'club',
    title: { ko: '얼리버드', en: 'Early Bird' },
    host: {
      name: { ko: 'M. 박', en: 'M. Park' },
      credential: {
        ko: '얼리버드 클럽장 · 3년째 운영',
        en: 'Early Bird host · 3rd year',
      },
    },
    summary: {
      ko: '아침 1시간, 일찍 일어나 나만의 공부 · 자기개발 시간 만들기.',
      en: 'Wake up an hour earlier and make time for yourself.',
    },
    status: 'recruiting',
    format: 'online',
    category: '라이프스타일',
    schedule: {
      ko: '매일 아침 인증 · 한 달 단위',
      en: 'Daily morning check-in · monthly',
    },
    timezone: 'KST',
    description: {
      ko: '아침에 1시간이라도 일찍 일어나면 아무런 방해 없이 온전히 나만의 공부 · 자기개발 시간을 만들 수 있습니다. 혼자 하면 어려운 아침 습관을 같이 만들어요. 이 시간에 공부 · 운동 · 명상 · 독서처럼 나에게 의미 있는 일을 해 보세요.\n\n- 목표: 아침에 일어나 의미 있는 일로 하루 시작하기, 일찍 일어나는 습관 만들기\n- 진행: 매주 일요일 올라오는 출석부에 하루하루 인증\n- 기간: 한 달. 끝까지 하면 다음 달 출석부에 자동으로 이어집니다\n- 킥오프 모임이 없습니다. 디스코드 얼리버드 › 로비의 가이드를 꼭 읽어 주세요',
      en: 'Waking up even an hour earlier gives you uninterrupted time for yourself. Morning habits are hard alone but doable together — use the time for study, exercise, meditation, reading, or anything meaningful to you.\n\n- Goal: start the day with something meaningful and build an early-rising habit\n- How: check in every day on the attendance sheet posted each Sunday\n- Length: one month. Finish it and you continue into next month automatically\n- No kickoff meeting — please read the guide in the Early Bird lobby on Discord',
    },
    recruit_url: 'https://forms.gle/Ub9YHsQjuhyw7o166',
    recruitment: {
      status: 'monthly',
      deadline: '2026-12-31',
      cadence: 'monthly',
      form_url: 'https://forms.gle/Ub9YHsQjuhyw7o166',
      capacity: 20,
      note: { ko: '15명 + α (최대 20명) · 끝까지 하면 다음 달 자동 연장', en: '15+ members (max 20) · finish to continue next month' },
    },
    order: 4,
    year: '2026',
  },
  {
    id: 'weeklyx',
    kind: 'club',
    title: { ko: 'WeeklyX', en: 'WeeklyX' },
    host: {
      name: { ko: 'Y. 정', en: 'Y. Jung' },
      credential: { ko: 'WeeklyX 클럽장', en: 'WeeklyX host' },
    },
    summary: {
      ko: '매주 스스로 정한 X시간을 꾸준히 공부하고 회고하기.',
      en: 'Study the X hours you set each week, and reflect.',
    },
    status: 'recruiting',
    format: 'online',
    category: '라이프스타일',
    schedule: {
      ko: '매주 목표 시간 · 공부 시간 기록 · 회고',
      en: 'Weekly goal · log hours · retro',
    },
    timezone: 'both',
    description: {
      ko: '일주일 동안 스스로 정한 X시간을 꾸준히 공부하는 모임입니다. 매주 목표 시간을 새로 정하고, 공부한 시간을 기록하고, 회고를 남깁니다.\n\n- 목표: 매주 정한 X시간을 채우고 회고하기. 함께해서 꾸준히 공부하기\n- 참가 대상: 빠지지 않고 매주 공부하고, 시간을 기록하고 회고를 남기실 분\n- 기간: 한 달. 출석부에 남아 있으면 다음 달로 자동 연장됩니다\n- 킥오프 모임이 없습니다. 디스코드 WeeklyX › 로비 › 공지의 스터디 가이드를 확인해 주세요',
      en: 'Study the X hours you set for yourself every week. Set a new weekly goal, log your study time, and leave a retro.\n\n- Goal: hit your weekly X hours and reflect on it — stay consistent together\n- For: people who will study every week, log their hours and write retros\n- Length: one month. Stay on the attendance sheet and you continue next month automatically\n- No kickoff meeting — read the study guide in WeeklyX › Lobby › Notices on Discord',
    },
    recruit_url: 'https://forms.gle/4RpAXWfWCVNVmRAU8',
    recruitment: {
      status: 'monthly',
      deadline: '2026-12-31',
      cadence: 'monthly',
      form_url: 'https://forms.gle/4RpAXWfWCVNVmRAU8',
      capacity: 20,
      note: { ko: '15명 (최대 20명) · 자리가 남으면 매달 추가 모집', en: '15 members (max 20) · monthly top-up if seats remain' },
    },
    order: 5,
    year: '2026',
  },
  {
    id: 'past-project-review',
    // 공개일이 미래 = 사용자 사이트에 아직 안 보임. 운영자 콘솔에서만 보인다.
    publish_at: '2026-09-15',
    kind: 'study',
    title: { ko: '지난 플젝 톺아보기', en: 'Past Project Review' },
    host: {
      name: { ko: 'D. 최', en: 'D. Choi' },
      credential: {
        ko: '시니어 SWE · 글쓰기 멘토',
        en: 'Senior SWE · writing mentor',
      },
    },
    summary: {
      ko: '내 프로젝트를 돌아보며 글로 정리합니다.',
      en: 'Look back on your projects and write them up.',
    },
    status: 'recruiting',
    format: 'online',
    category: '라이프스타일',
    description: {
      ko: '혼자서는 이어가기 어려운 습관을 함께 만들어 갑니다. 각자 목표를 정하고 매일 인증하며, 주 1회 모여 지난 한 주를 돌아봅니다. 잘 안 된 주도 그대로 이야기하는 것이 규칙입니다. 부담 없이 오래 가는 것을 목표로 합니다.',
      en: "We build habits that are hard to keep alone. Everyone sets a goal, checks in daily, and we meet weekly to look back. Talking about the weeks that didn't go well is part of the rule. The aim is to last, not to be intense.",
    },
    recruit_url: 'https://forms.gle/SMQeimGZKMQ2Zbeq8',
    recruitment: {
      status: 'open',
      deadline: '2026-12-31',
      cadence: 'one-time',
      form_url: 'https://forms.gle/SMQeimGZKMQ2Zbeq8',
    },
    order: 6,
    year: '2026',
  },
  {
    id: 'system-design-interview',
    kind: 'study',
    title: {
      ko: 'System Design Interview Study',
      en: 'System Design Interview Study',
    },
    host: {
      name: { ko: 'K. 한', en: 'K. Han' },
      credential: {
        ko: '現 빅테크 스태프 엔지니어',
        en: 'Big-tech Staff Engineer',
      },
    },
    summary: {
      ko: 'Hello Interview 자료 기반 시스템 디자인 인터뷰 준비.',
      en: 'System design interview prep based on Hello Interview material.',
    },
    status: 'recruiting',
    format: 'online',
    category: '커리어',
    description: {
      ko: '이력서와 포트폴리오를 실제로 고쳐가며 진행합니다. 각자 초안을 가져오면 함께 읽고 고칠 부분을 짚습니다. 모의 면접도 포함되며, 피드백은 구체적으로 남깁니다. 지원 중인 분과 준비 단계인 분 모두 참여할 수 있습니다.',
      en: 'We revise resumes and portfolios for real. Bring a draft; we read it together and mark what to fix. Mock interviews are included, with concrete feedback. Open to both active applicants and those still preparing.',
    },
    recruit_url: 'https://forms.gle/QD54d719pDyGcuLF8',
    recruitment: {
      status: 'open',
      deadline: '2026-12-31',
      cadence: 'one-time',
      form_url: 'https://forms.gle/QD54d719pDyGcuLF8',
    },
    order: 7,
    year: '2026',
  },
  {
    id: 'daily-leetcode',
    kind: 'club',
    title: { ko: 'Daily LeetCode', en: 'Daily LeetCode' },
    host: {
      name: { ko: 'R. 오', en: 'R. Oh' },
      credential: {
        ko: 'Daily LeetCode 운영',
        en: 'Daily LeetCode host',
      },
    },
    summary: {
      ko: '리트코드 1일 1문제를 매일 공부하며 Streak 쌓기.',
      en: 'Study LeetCode\'s daily problem and build your streak.',
    },
    status: 'recruiting',
    format: 'online',
    category: '알고리즘',
    schedule: { ko: '매일 1문제 · UTC 0시(한국 오전 9시) 리셋', en: 'One problem a day · resets 00:00 UTC' },
    description: {
      ko: '리트코드가 매일 내는 1일 1문제를 함께 푸는 챌린지입니다. 난이도가 무작위라 「푼다」보다 「공부한다」는 느낌으로 합니다.\n\n- 목표: 많은 문제를 경험하고 공부하기, 매일 풀며 Streak 쌓기, Streak 배지(50일 · 100일 · 월간) 따기\n- 기준 시간: **UTC 0시에 하루가 바뀝니다** (한국 오전 9시 · PST 오후 4시 · EST 오후 7시)\n- 인증: 리트코드 닉네임으로 자동 인증. 리셋 1~2시간 뒤 전날 기록이 업데이트됩니다\n- 가이드: 하루 최대 30분 권장. 5분 고민해도 모르겠으면 Editorial · Solution을 보고 공부하기\n- 지속적으로 불참하면 제명되며, 다음 달 다시 참여할 수 있습니다. 이미 Streak 가 있어도 참가할 수 있어요',
      en: 'A challenge to study LeetCode\'s daily problem together. Difficulty is random, so the aim is to study rather than just solve.\n\n- Goals: see many problems, build a streak, earn streak badges (50 · 100 days, monthly)\n- Day boundary: **the day resets at 00:00 UTC** (09:00 KST · 16:00 PST · 19:00 EST)\n- Check-in: automatic via your LeetCode username; yesterday\'s record updates 1–2 hours after reset\n- Guide: up to 30 minutes a day. Stuck after 5 minutes? Read the editorial or solutions and learn\n- Repeated absences mean removal; you can rejoin next month. Existing streaks are welcome',
    },
    recruit_url: 'https://forms.gle/7tqPWZXf8m4eSz2t5',
    recruitment: {
      status: 'monthly',
      deadline: '2026-12-31',
      cadence: 'monthly',
      form_url: 'https://forms.gle/7tqPWZXf8m4eSz2t5',
      note: { ko: '정원 없음 · 이미 참여 중이면 다시 신청하지 않아도 됩니다', en: 'No cap · current members need not reapply' },
    },
    order: 8,
    year: '2026',
  },

  // ── 월별 클럽 기수 (7·8·9월). 모집중 카드는 위에 그대로 두고, 기수는 참여 이력·출석부용.
  ...monthlyClubCohorts(
    'early-bird',
    { ko: '얼리버드', en: 'Early Bird' },
    {
      kind: 'club',
      host: {
        name: { ko: 'M. 박', en: 'M. Park' },
        credential: {
          ko: '얼리버드 클럽장 · 3년째 운영',
          en: 'Early Bird host · 3rd year',
        },
      },
      summary: {
        ko: '아침 1시간, 일찍 일어나 나만의 공부 · 자기개발 시간 만들기.',
        en: 'Wake up an hour earlier and make time for yourself.',
      },
      format: 'online',
      category: '라이프스타일',
      schedule: {
        ko: '매일 아침 인증 · 한 달 단위',
        en: 'Daily morning check-in · monthly',
      },
      description: {
        ko: '아침에 1시간이라도 일찍 일어나면 아무런 방해 없이 온전히 나만의 공부 · 자기개발 시간을 만들 수 있습니다. 혼자 하면 어려운 아침 습관을 같이 만들어요. 이 시간에 공부 · 운동 · 명상 · 독서처럼 나에게 의미 있는 일을 해 보세요.\n\n- 목표: 아침에 일어나 의미 있는 일로 하루 시작하기, 일찍 일어나는 습관 만들기\n- 진행: 매주 일요일 올라오는 출석부에 하루하루 인증\n- 기간: 한 달. 끝까지 하면 다음 달 출석부에 자동으로 이어집니다\n- 킥오프 모임이 없습니다. 디스코드 얼리버드 › 로비의 가이드를 꼭 읽어 주세요',
        en: 'Waking up even an hour earlier gives you uninterrupted time for yourself. Morning habits are hard alone but doable together — use the time for study, exercise, meditation, reading, or anything meaningful to you.\n\n- Goal: start the day with something meaningful and build an early-rising habit\n- How: check in every day on the attendance sheet posted each Sunday\n- Length: one month. Finish it and you continue into next month automatically\n- No kickoff meeting — please read the guide in the Early Bird lobby on Discord',
      },
      recruit_url: 'https://forms.gle/Ub9YHsQjuhyw7o166',
      discord_url: 'https://discord.gg/earlybird-demo',
      driveUrl: 'https://drive.google.com/drive/folders/earlybird-demo',
    }
  ),
  ...monthlyClubCohorts(
    'weeklyx',
    { ko: 'WeeklyX', en: 'WeeklyX' },
    {
      kind: 'club',
      host: {
        name: { ko: 'Y. 정', en: 'Y. Jung' },
        credential: { ko: 'WeeklyX 클럽장', en: 'WeeklyX host' },
      },
      summary: {
        ko: '매주 스스로 정한 X시간을 꾸준히 공부하고 회고하기.',
        en: 'Study the X hours you set each week, and reflect.',
      },
      format: 'online',
      category: '라이프스타일',
      schedule: {
        ko: '매주 목표 시간 · 공부 시간 기록 · 회고',
        en: 'Weekly goal · log hours · retro',
      },
      description: {
        ko: '일주일 동안 스스로 정한 X시간을 꾸준히 공부하는 모임입니다. 매주 목표 시간을 새로 정하고, 공부한 시간을 기록하고, 회고를 남깁니다.\n\n- 목표: 매주 정한 X시간을 채우고 회고하기. 함께해서 꾸준히 공부하기\n- 참가 대상: 빠지지 않고 매주 공부하고, 시간을 기록하고 회고를 남기실 분\n- 기간: 한 달. 출석부에 남아 있으면 다음 달로 자동 연장됩니다\n- 킥오프 모임이 없습니다. 디스코드 WeeklyX › 로비 › 공지의 스터디 가이드를 확인해 주세요',
        en: 'Study the X hours you set for yourself every week. Set a new weekly goal, log your study time, and leave a retro.\n\n- Goal: hit your weekly X hours and reflect on it — stay consistent together\n- For: people who will study every week, log their hours and write retros\n- Length: one month. Stay on the attendance sheet and you continue next month automatically\n- No kickoff meeting — read the study guide in WeeklyX › Lobby › Notices on Discord',
      },
      recruit_url: 'https://forms.gle/4RpAXWfWCVNVmRAU8',
    }
  ),
  ...monthlyClubCohorts(
    'daily-leetcode',
    { ko: 'Daily LeetCode', en: 'Daily LeetCode' },
    {
      kind: 'club',
      host: {
        name: { ko: 'R. 오', en: 'R. Oh' },
        credential: {
          ko: 'Daily LeetCode 운영',
          en: 'Daily LeetCode host',
        },
      },
      summary: {
        ko: '리트코드 1일 1문제를 매일 공부하며 Streak 쌓기.',
        en: 'Study LeetCode\'s daily problem and build your streak.',
      },
      format: 'online',
      category: '알고리즘',
      schedule: { ko: '매일 1문제 · UTC 0시(한국 오전 9시) 리셋', en: 'One problem a day · resets 00:00 UTC' },
      description: {
        ko: '리트코드가 매일 내는 1일 1문제를 함께 푸는 챌린지입니다. 난이도가 무작위라 「푼다」보다 「공부한다」는 느낌으로 합니다.\n\n- 목표: 많은 문제를 경험하고 공부하기, 매일 풀며 Streak 쌓기, Streak 배지(50일 · 100일 · 월간) 따기\n- 기준 시간: **UTC 0시에 하루가 바뀝니다** (한국 오전 9시 · PST 오후 4시 · EST 오후 7시)\n- 인증: 리트코드 닉네임으로 자동 인증. 리셋 1~2시간 뒤 전날 기록이 업데이트됩니다\n- 가이드: 하루 최대 30분 권장. 5분 고민해도 모르겠으면 Editorial · Solution을 보고 공부하기\n- 지속적으로 불참하면 제명되며, 다음 달 다시 참여할 수 있습니다. 이미 Streak 가 있어도 참가할 수 있어요',
        en: 'A challenge to study LeetCode\'s daily problem together. Difficulty is random, so the aim is to study rather than just solve.\n\n- Goals: see many problems, build a streak, earn streak badges (50 · 100 days, monthly)\n- Day boundary: **the day resets at 00:00 UTC** (09:00 KST · 16:00 PST · 19:00 EST)\n- Check-in: automatic via your LeetCode username; yesterday\'s record updates 1–2 hours after reset\n- Guide: up to 30 minutes a day. Stuck after 5 minutes? Read the editorial or solutions and learn\n- Repeated absences mean removal; you can rejoin next month. Existing streaks are welcome',
      },
      recruit_url: 'https://forms.gle/7tqPWZXf8m4eSz2t5',
    }
  ),
];
