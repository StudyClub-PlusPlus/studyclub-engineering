import type { ScreenSpec } from '@/proto/annotate';

/**
 * 스터디 신청하기 — 신청 폼 · 디스코드 연동 · 완료 팝업.
 *
 * 유저스토리 "크루는 스터디 신청 폼을 제출할 수 있다"의 프로토타입.
 * 캡틴이 설계하는 신청 폼(운영 콘솔의 "신청 폼 설계" Story)의 반대편 — 크루가 그 폼을 실제로 보고 채워 제출하는 화면이다.
 *
 * 신청하기는 상세에서만 연다 — 목록에는 신청하기·찜을 두지 않는다.
 */

/** 스터디 신청하기 — 신청 폼 다이얼로그. */
export const APPLY_SPEC: ScreenSpec = {
  screen: '스터디 신청',
  chip: '스터디 신청하기',
  scope: 'apply',
  notes: [
    '신청 결과는 화면 상태(localStorage)로만 남는다 — POST /api/studies/{id}/applications 가 아직 없다',
    '제출하면 마이페이지 "승인 대기" 목록에 즉시 반영된다. 취소도 거기서 한다 — 이 다이얼로그 범위 밖',
    '이미 제출한 신청서는 수정할 수 없다. 같은 스터디의 신청하기는 「신청 완료」로 바뀌고 폼이 다시 열리지 않는다',
    '이름·이메일은 이 폼에 두지 않는다 — 로그인 계정에서 읽기만 한다',
    '디스코드 계정 연동은 폼을 열기 전에 확인한다. 서버 별명은 모든 신청 폼에 항상 포함되는 기본 질문이라 캡틴이 지우거나 타입을 바꿀 수 없다',
    '카드(2~6)는 다이얼로그 몸통보다 밝은 색을 써서 각 입력 단위가 도드라지게 한다',
    '미입력 필수 항목이 있으면 신청을 눌렀을 때 그 항목으로 화면을 옮긴다(검사 순서 = 번호 순서)',
    '유효값(Empty / MIN / MAX / ENUM)은 apply-validation.ts 와 PRD §3 표가 같다. 서버도 같은 표로 거절한다',
  ],
  entries: [
    {
      n: '1',
      title: '스터디 정보',
      display: [
        '백오피스 신청 폼과 같은 설문지 제목 · 설명',
        '등록 폼 항목: 주제 · 진행 일정 · 모집 마감 · 상세 설명',
      ],
      policy: [
        '제목·설명은 applicationFormTitle / applicationFormDescription, 없으면 스터디 제목·한 줄 소개',
        '이름·이메일은 이 카드에 두지 않는다',
        '일정이 없으면 「일정 미정」',
      ],
      data: [
        'study.applicationFormTitle ?? study.title · applicationFormDescription ?? study.summary',
        'study.description / schedule / recruitment.deadline / categoriesOf(study)',
      ],
      when: '신청 폼 다이얼로그가 열려 있을 때',
    },
    {
      n: '2',
      title: '디스코드 서버 별명',
      display: ['"[스터디 클럽++] 디스코드 서버 별명" 단답형. 예시 placeholder "홍길동/SWE/산호세/시스템디자인"'],
      policy: [
        '계정(ACCOUNT.DISCORD_NICKNAME)에 값이 있으면 그 값으로 채운다. 지원자가 고칠 수 있다',
        '고친 값은 계정에 다시 저장한다',
        'Empty 불가 · MIN 1자 · MAX 100자 · ENUM 없음 · 기본값 계정 별명(없으면 빈 칸)',
        '빈 값 제출 시 "디스코드 서버 별명을 입력해 주세요." · 상한 초과 시 "100자 이내로 입력해 주세요." — 이 카드로 화면을 옮긴다',
      ],
      data: ['getDiscordNickname() / setDiscordNickname()'],
      when: '신청 폼 다이얼로그가 열려 있을 때',
    },
    {
      n: '3',
      title: '일정 참여 확인 체크박스',
      display: ['"{스터디 일정} 참여 가능합니다" 체크박스 하나'],
      policy: [
        '스터디에 확정된 일정(study.schedule)이 있을 때만 보인다',
        'Empty 불가(일정 있을 때) · ENUM true · 기본값 false',
        '체크하지 않고 제출하면 오류(7) "일정 참여 가능 여부를 확인해 주세요."로 막고 이 카드로 화면을 옮긴다',
      ],
      when: '스터디에 확정된 일정이 있을 때',
    },
    {
      n: '4',
      title: '참여 가능한 요일',
      display: ['월요일부터 일요일까지 체크박스. 여러 요일을 고를 수 있다'],
      behavior: ['누르면 그 요일이 토글된다'],
      policy: [
        '모든 신청 폼에 보인다 — 진행 일정 유무와 관계없다',
        'Empty 불가 · MIN 1개 · MAX 7개 · ENUM mon|tue|wed|thu|fri|sat|sun · 기본값 없음',
        '미선택 시 "참여 가능한 요일을 하나 이상 선택해 주세요." · ENUM 밖 "참여 가능한 요일을 다시 선택해 주세요."',
      ],
      data: ['신청 응답 cells — 요일 키 ENUM: mon·tue·wed·thu·fri·sat·sun'],
      when: '신청 폼 다이얼로그가 열려 있을 때',
    },
    {
      n: '5',
      title: '캡틴이 설계한 추가 질문',
      display: ['질문마다 카드 하나. 단답형·장문형·객관식·체크박스·드롭다운 중 캡틴이 고른 타입 그대로 렌더링'],
      policy: [
        '스터디에 캡틴이 설계한 신청 폼(study.applicationForm)이 있을 때만 보인다 — 없으면 디스코드 별명만 받는다',
        '단답 Empty(필수면 불가) MIN 1 MAX 200 · 장문 MIN 1 MAX 2000 · 객관식·드롭다운 MIN 1 MAX 1 ENUM=options · 체크박스 MIN 1 MAX=옵션수 ENUM=options · 기타 자유입력 MIN 1 MAX 100',
        '필수 빈 값 "필수 질문에 답해 주세요." · 상한 "{N}자 이내로 입력해 주세요." · ENUM 밖 "선택지를 다시 골라 주세요."',
        '캡틴이 폼을 설계할 때 미리 보는 편집 카드와 같은 컴포넌트(QuestionFillView)를 쓴다 — 지원자가 실제로 보는 모양 그대로다',
      ],
      data: ['study.applicationForm 중 id 가 discord 가 아닌 질문 전부 — DEMO_APPLICATION_FORM (백오피스 신청 폼과 동일)'],
      when: '캡틴이 설계한 추가 질문이 있을 때',
    },
    {
      n: '7',
      title: '오류 메시지',
      display: ['답하지 않은 항목 카드 안, 빨간 글씨 한 줄'],
      policy: [
        '한 번에 하나만 보여준다',
        '해당 카드를 화면 가운데로 옮기고 첫 입력칸에 포커스를 둔다',
        '카드는 빨간 테두리·연한 빨간 배경으로 강조하고 한 번 깜빡인다 — 다시 신청을 누르면 같은 칸을 다시 가리킨다',
        '그 항목을 입력하면 강조와 문구를 걷는다',
        '검사 순서: 디스코드 별명(2) → 참여 가능한 요일(4) → 필수 추가 질문(5) → 일정 확인(3)',
      ],
      when: '필수 입력을 채우지 않고 신청을 눌렀을 때',
    },
    {
      n: '8',
      title: '취소 버튼',
      behavior: ['누르면 입력한 내용을 전부 버리고 다이얼로그를 닫는다'],
      policy: ['제출 처리 중에는 비활성화된다'],
      when: '신청 폼 다이얼로그가 열려 있을 때',
    },
    {
      n: '9',
      title: '신청 버튼',
      behavior: [
        '누르면 검증 후 통과 시 저장하고 완료 팝업으로 바뀐다',
        '처리 중에는 로딩 스피너로 바뀌며 중복 제출을 막는다',
      ],
      policy: [
        '저장은 화면 상태(localStorage)로만 처리한다',
        '이미 제출한 스터디면 저장하지 않는다 — 덮어쓰지 않는다',
      ],
      data: ['TODO(api): POST /api/studies/{id}/applications'],
      when: '신청 폼 다이얼로그가 열려 있을 때',
    },
  ],
};

/** 스터디 신청 전 디스코드 연동. */
export const DISCORD_GATE_SPEC: ScreenSpec = {
  screen: '스터디 신청',
  chip: '디스코드 연동',
  scope: 'discord',
  notes: [
    '상세의 신청하기를 누르면 로그인 여부, 그다음 디스코드 연동 여부를 본다 — 이 팝업은 로그인한 뒤에만 뜬다',
    '이미 연동돼 있으면 이 팝업을 건너뛰고 신청 폼이 열린다',
    '프로토는 OAuth 대신 화면에서 바로 연결한다 — POST /api/me/discord/link 가 아직 없다',
    '마이페이지에서 연결을 해제하면 이 게이트를 다시 볼 수 있다',
  ],
  entries: [
    {
      n: '1',
      title: '연동 필수 안내',
      display: [
        '"스터디 신청 전 디스코드 연동은 필수입니다."',
        '스터디가 디스코드에서 진행된다는 설명',
      ],
      policy: ['연동이 끝나기 전에는 신청 폼을 열지 않는다'],
      when: '디스코드가 연동되지 않은 채로 신청하기를 눌렀을 때',
    },
    {
      n: '2',
      title: '디스코드 연동하기 버튼',
      behavior: ['누르면 연동을 마친 뒤 신청 폼을 연다'],
      data: ['setDiscord() — 프로토는 고정 핸들 jiwon_dev'],
      when: '디스코드 연동 팝업이 열려 있을 때',
    },
    {
      n: '3',
      title: '취소 버튼',
      behavior: ['누르면 연동하지 않고 팝업을 닫는다. 신청 폼은 열리지 않는다'],
      when: '디스코드 연동 팝업이 열려 있을 때',
    },
  ],
};

/** 스터디 신청 완료 랜딩 팝업. */
export const APPLY_COMPLETE_SPEC: ScreenSpec = {
  screen: '스터디 신청',
  chip: '신청 완료',
  scope: 'complete',
  notes: [
    '신청 폼의 신청 버튼을 눌러 검증을 통과한 뒤에만 보인다',
    '장바구니에 담은 뒤 장바구니로 갈지 묻는 것과 같다 — X 는 지금 화면에 머물고, 버튼은 내 스터디로 간다',
    '제출한 내용은 이 화면에서 고치지 않는다',
  ],
  entries: [
    {
      n: '1',
      title: '신청 완료 안내',
      display: [
        '"스터디 신청이 완료되었습니다. 내 스터디로 이동할까요?"',
        '"제출한 내용은 수정할 수 없습니다."',
      ],
      when: '신청을 제출한 뒤',
    },
    {
      n: '2',
      title: '닫기(X)',
      display: ['제목 오른쪽 X'],
      behavior: ['누르면 팝업만 닫고 지금 화면(목록 또는 상세)에 머문다'],
      policy: ['바깥을 누르거나 Esc 를 눌러도 같다'],
      when: '신청을 제출한 뒤',
    },
    {
      n: '3',
      title: '내 스터디로 이동하기',
      display: ['하단 주 버튼 「내 스터디로 이동하기」'],
      behavior: ['누르면 내 스터디(참여 모음)로 간다'],
      when: '신청을 제출한 뒤',
    },
  ],
};
