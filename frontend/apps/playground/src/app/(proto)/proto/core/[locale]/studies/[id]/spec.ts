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

/** 스터디 상세보기 — 신청 버튼을 누르기 전, 상세 페이지 자체. */
export const VIEW_SPEC: ScreenSpec = {
  screen: '스터디 상세',
  chip: '스터디 상세보기',
  scope: 'view',
  entries: [
    {
      n: '1',
      title: '모집 마감 배지',
      display: ['버튼이 아니라 "모집 마감" 고정 문구만 있는 pill'],
      policy: [
        'recruitState() 가 closed 일 때 — 스터디 상태가 recruiting 이 아니거나, 모집 마감일이 지났거나, 운영자가 모집을 닫았을 때',
      ],
      when: '모집 상태가 마감일 때',
    },
    {
      n: '2',
      title: '신청하기 버튼',
      display: [
        '모집 상태 문구가 라벨인 pill 버튼',
        '이미 신청한 스터디면 라벨이 「신청 완료」이고 누를 수 없다',
      ],
      behavior: [
        '누르면 로그인 여부를 확인한다',
        '로그인하지 않았으면 로그인 화면으로 이동한다 — 돌아올 주소(이 상세 화면)를 `next` 로 함께 전달한다',
        '로그인했으면 디스코드 연동 여부를 확인한다',
        '연동되어 있으면 신청 폼이 열린다',
        '연동되어 있지 않으면 디스코드 연동 안내 팝업이 열린다',
        '이미 신청한 스터디면 폼이 열리지 않는다',
      ],
      policy: [
        '모집 마감일은 필수다 — 상시 모집은 없다. 마감일이 지나면 이 버튼 대신 「모집 마감」이 선다',
        '제출한 신청서는 수정할 수 없다',
      ],
      when: '모집 상태가 모집중일 때',
    },
    {
      n: '3',
      title: '참여 인원 · 모집 마감',
      display: ['「참여 현재/정원명」 뒤에 「· 날짜까지 모집」. 정원이 없으면 「참여 N명 · 정원 제한 없음」'],
      policy: ['목록 카드와 같은 값이다', '모집 정원은 모집 회차 단위다'],
      data: ['study.recruitment.capacity · deadline', '신청 명부의 참여자 수'],
    },
    {
      n: '4',
      title: '참여 신청 안내',
      display: ['한 줄 안내 — 종류에 따라 문구가 다르다'],
      policy: [
        '**클럽**: 같은 프로그램의 새 기수 공고에서 이전 기수 참여자의 참여가 자동 유지된다 — 다시 신청하지 않는다',
        '**스터디**: 참여 신청이 필요하다',
        '상시 모집은 없다. 이어지는 참여는 클럽의 기수 이월로 표현한다',
        '자동 유지가 실제로 어떻게 동작하는지(이월 명단 표시 등)는 이 프로토에서 보여주지 않는다',
      ],
      data: ['study.kind (club / study)'],
    },
  ],
};

export { APPLY_COMPLETE_SPEC, APPLY_SPEC, DISCORD_GATE_SPEC };

export const SPECS = [VIEW_SPEC, APPLY_SPEC, DISCORD_GATE_SPEC, APPLY_COMPLETE_SPEC];
