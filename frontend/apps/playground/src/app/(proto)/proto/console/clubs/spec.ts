import type { ScreenSpec } from '@/proto/annotate';

/** 클럽 다음 기수 — 매달 초안이 자동으로 생기고 캡틴이 모집을 연다 (ST-021). */
const COHORT: ScreenSpec = {
  screen: '클럽 운영 › 기수 (운영 콘솔)',
  story: 'ST-021',
  prd: 'captain-reregister-cohort',
  chip: '다음 기수',
  scope: 'cohort',
  notes: [
    '클럽 기수는 달 하나다 — 1일 시작, 말일 종료 (POL-0012)',
    '화면 위 클럽 고르기(얼리버드 · WEEKLY X · Daily LeetCode)와 「기수 · 출석부」 탭은 이 지면의 공통 틀이다',
  ],
  entries: [
    {
      n: '1',
      title: '이번 기수',
      display: ['지금 진행 중인 기수의 제목'],
      data: ['`GET /api/admin/clubs/{programId}` — `currentCohort`'],
    },
    {
      n: '1-1',
      title: '진행 상태',
      display: ['이번 기수가 진행 중임을 알린다'],
    },
    {
      n: '1-2',
      title: '진행 기간',
      display: ['그 달 1일 ~ 말일. 요일을 함께 적는다'],
    },
    {
      n: '1-3',
      title: '참여 중',
      display: ['참여 중단하지 않은 참여자 수'],
      data: ['`STUDY_PARTICIPANT.STATUS = ACTIVE` 수'],
    },
    {
      n: '2',
      title: '다음 기수',
      display: ['다음 달 기수의 제목 — 「{클럽} {YYYY}년 {M}월」'],
      policy: ['한 클럽에 같은 달 기수는 하나뿐이다 — 이미 있으면 초안을 다시 만들지 않는다'],
    },
    {
      n: '2-1',
      title: '다음 기수 상태',
      display: ['아직 없음 · 초안(사이트 미공개) · 모집중(마감까지 남은 날) 셋을 구분해 알린다'],
    },
    {
      n: '2-2',
      title: '초안 내용',
      display: [
        '진행: 다음 달 1일 ~ 말일',
        '모집: 모집 시작한 날 ~ 이번 달 말일. 모집 중이면 실제 시작일',
        '정원: 이번 기수 값과 남은 자리 (정원 − 이어서 참여 − 신청). 정원이 없으면 「제한 없음」',
        '신청 폼: 이번 기수 폼을 그대로 쓴다. 클럽이 받는 값(기상 목표 · LeetCode ID)은 필수',
        '이어서 참여: 다음 기수로 넘어갈 예정 인원',
        '신청: 모집 중일 때 들어온 신청 수',
      ],
      policy: [
        '소개 · 상세 설명 · 카테고리 · 디스코드 채널 · 드라이브 · 정원 · 신청 폼은 이번 기수 값을 복사한다',
        '복사한 값을 고쳐도 이번 기수는 그대로다',
        '모집 마감은 이번 달 말일 23:59 (캡틴 시간대)',
      ],
      data: ['새 `STUDY`(`STATUS = DRAFT`) · `STUDY_RECRUITMENT` 1행 · 기본 반 1개'],
    },
    {
      n: '2-3',
      title: '모집 시작',
      when: '다음 기수가 초안일 때',
      behavior: ['누르면 확인 창(2-4)이 열린다'],
    },
    {
      n: '2-4',
      title: '모집 시작 확인',
      when: '「모집 시작」을 눌렀을 때',
      display: ['「‘{기수 제목}’ 모집을 시작하시겠습니까?」 · 「사용자 사이트에 공개되고 오늘부터 {말일}까지 신청을 받습니다.」'],
      behavior: [
        '「모집 시작」 — 기수를 공개하고 오늘을 모집 시작일로 적는다. 다음 기수 상태가 모집중으로 바뀐다',
        '「취소」(기본 포커스) — 아무것도 바꾸지 않고 닫는다',
      ],
      policy: ['공개 조건은 스터디 공개와 같다 — 신청 폼이 연결되어 있어야 한다 (POL-0003)'],
      data: ['`POST /api/admin/studies/{studyId}/publish`'],
    },
    {
      n: '2-5',
      title: '초안 예정 안내',
      when: '다음 기수가 아직 없을 때',
      display: [
        '자동 초안이 켜져 있으면 「{날짜}에 초안이 자동으로 만들어집니다.」',
        '꺼져 있으면 「자동 초안이 꺼져 있습니다. 직접 만들어 주세요.」',
      ],
    },
    {
      n: '2-6',
      title: '지금 초안 만들기',
      when: '다음 기수가 아직 없을 때',
      behavior: ['누르면 자동 초안과 같은 내용으로 다음 기수 초안을 바로 만든다'],
      data: ['`POST /api/admin/clubs/{programId}/next-cohort`'],
    },
    {
      n: '3',
      title: '자동 초안 설정',
      display: ['클럽마다 따로 정한다'],
      data: ['`PATCH /api/admin/clubs/{programId}` — `autoDraftEnabled` · `autoDraftDay`'],
    },
    {
      n: '3-1',
      title: '자동 만들기 켜고 끄기',
      behavior: ['켜면 매월 정한 날 0시(캡틴 시간대)에 다음 달 기수 초안이 미공개로 만들어진다'],
      policy: ['기본값은 켜짐'],
    },
    {
      n: '3-2',
      title: '초안 만드는 날',
      display: ['매월 1~28일 중 하루. 기본 15일'],
      policy: ['꺼져 있으면 고를 수 없다', '정한 날이 이미 지났으면 다음 달부터 적용된다'],
    },
  ],
};

/** 이어서 참여 — 이번 기수를 끝까지 마친 사람이 다음 기수로 넘어간다 (ST-042). */
const CARRY: ScreenSpec = {
  screen: '클럽 운영 › 기수 (운영 콘솔)',
  story: 'ST-042',
  prd: 'captain-carry-over-club-members',
  chip: '이어서 참여',
  scope: 'carry',
  entries: [
    {
      n: '1',
      title: '이어서 참여 머리',
      display: ['「{이번 기수 말일}까지 참여한 사람은 {다음 기수 제목} 참여자로 넘어갑니다.」'],
    },
    {
      n: '1-1',
      title: '인원 요약',
      display: ['넘어갈 사람 · 뺀 사람 · 참여 중단 인원'],
      policy: ['저장 전 고친 값으로 센다'],
    },
    {
      n: '2',
      title: '이번 기수 명단',
      display: ['넘어갈 사람 → 뺀 사람 → 참여 중단한 사람 순'],
      data: ['`GET /api/admin/studies/{nextStudyId}/carry-over`'],
    },
    {
      n: '2-1',
      title: '디스코드 별명',
      display: ['참여자의 디스코드 별명'],
    },
    {
      n: '2-2',
      title: '클럽 신청 값',
      when: '얼리버드 · Daily LeetCode',
      display: ['신청 때 받은 기상 목표 시각 또는 LeetCode ID'],
      policy: ['넘어가는 사람의 신청 값은 다음 기수에 그대로 이어진다'],
    },
    {
      n: '2-3',
      title: '이번 기수 출석률',
      display: ['월간 출석부의 출석률. 기록이 없으면 「-」'],
      policy: ['계산은 월간 출석부와 같다 (ST-043)'],
    },
    {
      n: '2-4',
      title: '다음 기수',
      display: [
        '넘어감 — 다음 기수 시작일에 참여자로 넘어간다',
        '뺌 — 캡틴이 뺐다',
        '넘어가지 않음 · {날짜} 참여 중단 — 이번 기수에서 참여 중단했다',
      ],
      policy: ['참여 중단한 사람은 고를 수 없다 — 다시 하려면 다음 기수 모집에 신청한다'],
    },
    {
      n: '3',
      title: '작업 바',
      display: ['고른 인원 / 고를 수 있는 인원'],
    },
    {
      n: '3-1',
      title: '다음 기수에서 빼기',
      behavior: ['고른 사람을 「뺌」으로 바꾼다. 저장 전이다'],
    },
    {
      n: '3-2',
      title: '다시 넣기',
      behavior: ['고른 사람 중 뺀 사람을 「넘어감」으로 되돌린다. 저장 전이다'],
      policy: ['고른 사람 중 뺀 사람이 없으면 누를 수 없다'],
    },
    {
      n: '3-3',
      title: '변경 취소 · 저장',
      behavior: ['저장하면 뺀 사람 목록을 한 번에 반영한다', '변경 취소는 마지막 저장 상태로 되돌린다'],
      policy: ['다음 기수 시작일 0시 전까지 고칠 수 있다'],
      data: ['`PUT /api/admin/studies/{nextStudyId}/carry-over` — `excludedParticipantIds[]`'],
    },
    {
      n: '4',
      title: '다음 기수가 없을 때',
      when: '다음 기수가 아직 없을 때',
      display: ['「아직 다음 기수가 없습니다.」 · 「다음 기수 초안이 만들어지면 이어서 참여할 사람을 확인할 수 있습니다.」'],
    },
  ],
};

/** 클럽 월간 출석부 — 사람 × 그 달의 날짜 (ST-043). */
const BOOK: ScreenSpec = {
  screen: '클럽 운영 › 출석부 (운영 콘솔)',
  story: 'ST-043',
  prd: 'captain-club-monthly-attendance',
  chip: '월간 출석부',
  scope: 'clubbook',
  entries: [
    {
      n: '1',
      title: '출석부 머리',
      display: ['「{이번 기수 제목} 출석부」 · 전체 인원'],
    },
    {
      n: '1-1',
      title: '출석부 제목',
      display: ['어느 기수의 출석부인지 알린다'],
    },
    {
      n: '1-2',
      title: '날짜 기준',
      when: 'Daily LeetCode',
      display: ['날짜가 UTC 기준임을 알리고, 「?」에서 한국 시간 오전 9시에 하루가 바뀐다고 설명한다'],
      policy: ['Daily LeetCode 의 날짜는 UTC 날짜다. 나머지 클럽은 참여자의 날짜다'],
    },
    {
      n: '1-3',
      title: '시트에서 붙여넣기',
      behavior: ['누르면 붙여넣기 창(5)이 열린다'],
    },
    {
      n: '2',
      title: '출석 값 안내',
      display: ['이 클럽에서 쓰는 출석 값과 「기록 없음」'],
      policy: [
        '얼리버드: 출석 · 지각 · 결석 · 휴가',
        'WEEKLY X · Daily LeetCode: 출석 · 결석 · 휴가',
        '지각은 0.5일로 센다',
      ],
    },
    {
      n: '3',
      title: '출석부 표',
      display: ['줄은 참여자, 열은 기수 기간의 날짜(1일~말일)'],
      policy: ['참여 중단한 사람은 맨 아래'],
      data: ['`GET /api/admin/studies/{studyId}/attendances` — 클럽은 날마다 회차 하나라 열이 곧 날짜'],
    },
    {
      n: '3-1',
      title: '디스코드 별명',
      display: ['참여자의 디스코드 별명. 참여 중단했으면 그 날짜'],
    },
    {
      n: '3-2',
      title: '클럽 신청 값',
      when: '얼리버드 · Daily LeetCode',
      display: ['기상 목표 시각 또는 LeetCode ID — 출석을 확인할 때 대조하는 값'],
    },
    {
      n: '3-3',
      title: '날짜 머리',
      display: ['날짜와 요일. 오늘은 「오늘」. 주말과 지나지 않은 날을 구분해 알린다'],
    },
    {
      n: '3-4',
      title: '출석 칸',
      display: ['그 날의 출석 값. 비어 있으면 기록 없음. 저장 전에 고친 칸을 구분해 알린다'],
      behavior: ['누를 때마다 이 클럽의 출석 값 순서대로 돌고, 마지막 다음은 기록 없음'],
      policy: [
        '오늘 뒤의 날짜는 입력할 수 없다',
        '참여 중단한 날 뒤의 날짜는 입력할 수 없다 — 「—」',
        '색만으로 가르지 않는다 — 칸에 값의 첫 글자를 적는다',
      ],
    },
    {
      n: '3-5',
      title: '출석 · 출석률',
      display: ['출석 일수(지각 0.5일)와 출석률. 기록이 없으면 「-」'],
      policy: [
        '출석률 = (출석 + 지각 × 0.5) ÷ (기록된 날 − 휴가)',
        '기록 없는 날은 분모에 넣지 않는다',
        '저장 전 고친 값으로 다시 계산한다. 저장된 값은 서버가 같은 식으로 계산해 준다',
      ],
    },
    {
      n: '3-6',
      title: '참여 중단한 줄',
      when: '참여 중단한 사람이 있을 때',
      display: ['참여 중단한 사람과 그 날짜. 고를 수 없다'],
    },
    {
      n: '4',
      title: '작업 바',
      display: ['고른 인원 / 고를 수 있는 인원'],
    },
    {
      n: '4-1',
      title: '바꿀 날짜',
      display: ['1일부터 오늘까지'],
      policy: ['고른 사람이 없으면 고를 수 없다'],
    },
    {
      n: '4-2',
      title: '출석 상태 일괄 변경',
      behavior: ['상태를 고르는 순간 고른 사람의 그 날짜 칸이 바뀐다. 「기록 지우기」는 칸을 비운다. 저장 전이다'],
    },
    {
      n: '4-3',
      title: '참여 중단',
      behavior: ['누르면 확인 창(6)이 열린다'],
    },
    {
      n: '4-4',
      title: '저장',
      display: ['저장 안 한 칸 수'],
      behavior: ['저장하면 고친 칸을 한 번에 반영한다', '변경 취소는 마지막 저장 상태로 되돌린다'],
      data: ['`POST /api/admin/studies/{studyId}/attendances` — `updates[]` (그 날의 회차 · 상태)'],
    },
    {
      n: '5',
      title: '붙여넣기 창',
      when: '「시트에서 붙여넣기」를 눌렀을 때',
      display: ['시트에서 복사한 줄을 넣는 칸'],
    },
    {
      n: '5-1',
      title: '붙여넣을 줄',
      display: ['첫 칸은 디스코드 별명, 그 뒤는 1일부터 차례로 그 날의 값. 이 클럽의 값 표기(출석 O · 지각 △ · 결석 X · 휴가 휴)'],
      policy: [
        '칸은 탭으로 나눈다 — 시트에서 복사하면 탭으로 나뉜다',
        '출석: O · 1 · 출석 · V / 지각: △ · (O) · 지각 · 0.5 / 결석: X · 0 · 결석 · - / 휴가: 휴 · 휴가 · E',
        '빈 칸은 그 날 값을 그대로 둔다',
        '오늘 뒤의 값은 버린다',
      ],
    },
    {
      n: '5-2',
      title: '반영 미리보기',
      when: '붙여넣은 글이 있을 때',
      display: [
        '「{n}명 · {m}칸을 반영합니다.」',
        '명단에 없는 이름 · 읽을 수 없는 값(이 클럽에 없는 값 포함)을 따로 알린다',
      ],
    },
    {
      n: '5-3',
      title: '반영',
      behavior: ['읽은 칸을 출석부에 넣고 창을 닫는다. 저장 전이다'],
      policy: ['읽은 칸이 없으면 누를 수 없다', '참여 중단한 날 뒤의 칸은 넣지 않는다'],
    },
    {
      n: '6',
      title: '참여 중단 확인',
      when: '「참여 중단」을 눌렀을 때',
      display: ['고른 사람 이름과 「오늘({날짜})로 참여가 끝납니다. 이 기수를 완주하지 않은 것으로 남고, 다음 기수로 이어지지 않습니다. 다시 참여하려면 다음 기수 모집에 신청해야 합니다.」'],
      behavior: ['「{n}명 참여 중단」 — 바로 반영된다', '「취소」(기본 포커스)'],
      policy: ['되돌리지 않는다', '다음 기수의 「이어서 참여」에서 빠진다 (ST-042)'],
      data: ['`POST /api/admin/studies/{studyId}/attendances` 의 `withdrawals[]` — `STUDY_PARTICIPANT.STATUS = WITHDRAWN` · `LEFT_AT`'],
    },
    {
      n: '7',
      title: '나가기 확인',
      when: '저장 안 한 고침이 있는데 탭 · 클럽을 바꿀 때',
      display: ['「저장을 누르지 않으면 고친 내용이 사라집니다. 나가기 전에 저장해 주세요.」'],
      behavior: ['저장하지 않고 나가기 · 이 화면에 머물기'],
    },
  ],
};

export const SPECS: ScreenSpec[] = [COHORT, CARRY, BOOK];
