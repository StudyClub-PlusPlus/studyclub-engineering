import type { ScreenSpec } from '@/proto/annotate';
import { APPLY_COMPLETE_SPEC, APPLY_SPEC, DISCORD_GATE_SPEC } from '@/proto/specs/study-apply';

/**
 * 스터디 상세 — Story 별 번호 명세.
 *
 * 한 지면에 Story 가 둘 산다 — 상세를 보는 것과 신청 폼을 제출하는 것. **번호는 Story 마다 1 부터
 * 다시 매긴다.** 요소에는 `data-anno="<scope>:<n>"` 으로 단다.
 *
 * Story ID 는 `stories.md` 발번 대장에서 실제로 발급받기 전에는 적지 않는다.
 */

/** 스터디 상세보기. 번호는 crew-view-study-detail PRD 와 같다. */
export const VIEW_SPEC: ScreenSpec = {
  screen: '스터디 상세',
  chip: '스터디 상세보기',
  scope: 'view',
  notes: [
    '이 화면은 study_id(STUDY.ID)로만 연다. 슬러그 주소는 열리지 않는다',
    '목록·내 스터디·참여·찜에서 들어오는 주소 키도 study_id다',
  ],
  entries: [
    {
      n: '1',
      title: '스터디 목록',
      display: ['스터디 목록'],
      behavior: ['누르면 스터디 목록으로 간다'],
    },
    {
      n: '2',
      title: '모집 상태',
      display: [
        '모집 중이고 마감일이 있으면 모집중 (D-N). 마감 당일은 모집중 (D-DAY)',
        '마감일이 없으면 상시 모집',
        '진행 중이면 진행중',
        '모집이 끝났으면 모집 마감',
      ],
      policy: [
        '문구는 recruitBadge() 한 곳이다. 목록과 여기서 따로 계산하지 않는다',
        'D-N은 마감일에서 오늘을 뺀 일수다. 0 이하면 D-DAY',
        '마감까지 3일 이하면 마감 임박으로 구분한다. 구분 값은 D-N 숫자다',
      ],
      data: ['study.status', 'study.recruitment.deadline'],
    },
    {
      n: '3',
      title: '분야',
      display: ['스터디 분야 이름'],
      data: ['study.category'],
    },
    {
      n: '4',
      title: '제목',
      display: ['보는 언어의 스터디 제목'],
      data: ['study.title'],
    },
    {
      n: '5',
      title: '한 줄 소개',
      display: ['보는 언어의 한 줄 소개'],
      data: ['study.summary'],
    },
    {
      n: '6',
      title: '일정·시간대',
      display: [
        '일정이 있으면 일정 문구와 시간대를 함께 알려 준다',
        '일정이 없으면 시간대만 알려 준다',
        '시간대는 KST, PST, 표기가 없으면 동시 모집(KST·PST)',
      ],
      policy: ['시간대는 studyTimezone() 한 곳이다. 목록 필터·목록·상세가 같은 함수를 쓴다'],
      data: ['study.schedule', 'study.recruitment.kickoff'],
    },
    {
      n: '7',
      title: '스터디 소개',
      display: ['제목은 스터디 소개. 본문은 상세 소개 원문'],
      policy: ['study.description 이 있을 때만 보인다'],
      data: ['study.description'],
      when: '상세 소개가 있을 때',
    },
    {
      n: '8',
      title: '시작 예정일',
      display: ['시작 예정일 {날짜}. 값이 없으면 시작 예정일 미정'],
      policy: [
        '표시 값은 studyStartValue() 한 곳이다. 목록과 여기서 따로 계산하지 않는다',
        '모집 마감일은 여기 두지 않는다. 모집 상태(2)가 이미 말한다',
      ],
      data: ['study.start_at'],
    },
    {
      n: '9',
      title: '신청',
      display: ['모집중이면 신청하기', '이미 신청했으면 신청 완료', '마감이면 모집 마감'],
      behavior: ['신청하기만 누를 수 있다. 누르면 신청 흐름이 시작된다'],
      policy: [
        '마감 판정은 recruitState()다. 모집 중이 아니거나, 마감일이 지났거나, 모집을 닫았으면 마감이다',
        '마감일이 없으면 상시 모집이다. 신청하기를 보여 준다',
        '신청 완료와 모집 마감은 누르지 못한다',
        '누른 뒤의 로그인·디스코드·폼은 신청 스토리가 정한다',
      ],
      data: ['recruitState(study)', '이 스터디의 신청 여부'],
    },
  ],
};

export { APPLY_COMPLETE_SPEC, APPLY_SPEC, DISCORD_GATE_SPEC };

export const SPECS = [VIEW_SPEC, APPLY_SPEC, DISCORD_GATE_SPEC, APPLY_COMPLETE_SPEC];
