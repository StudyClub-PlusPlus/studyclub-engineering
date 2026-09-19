import type { ScreenSpec } from '@/proto/annotate';

export const SPEC: ScreenSpec = {
  screen: '스터디 목록 필터링',
  notes: [
    '필터는 제출 버튼 없이 선택·입력 즉시 결과 목록에 반영된다',
    '모집 상태·시간대·카테고리는 한 번에 하나의 값만 선택한다',
    '현재 필터 상태는 주소에 저장하지 않는다',
    '결과 카드는 같은 번호가 여러 번 표시될 수 있으므로 첫 번째 카드에만 배지가 붙는다',
  ],
  entries: [
    {
      n: '1',
      title: '스터디 제목 검색',
      display: ['검색 아이콘과 제목 검색 입력창'],
      behavior: ['입력한 검색어가 포함된 스터디만 즉시 남긴다'],
      policy: ['앞뒤 공백을 제거한다', '한국어·영어 제목과 소개 문구를 대상으로 대소문자를 구분하지 않는다'],
      data: ['query', 'study.title.ko · study.title.en · study.summary.ko · study.summary.en'],
    },
    {
      n: '2',
      title: '모집 상태 필터',
      display: ['모집 상태 셀렉트'],
      behavior: ['선택한 모집 상태의 스터디만 결과 목록에 남긴다'],
      policy: ['기본값은 모집 상태 전체', '모집 예정 · 모집 중 · 종료 임박 · 모집 마감 · 상시 모집을 제공한다', '공개일·마감일과 모집 상태를 기준으로 계산한다'],
      data: ['recruitment'],
    },
    {
      n: '3',
      title: '시간대 필터',
      display: ['시간대 셀렉트'],
      behavior: ['선택한 시간대에 맞는 스터디만 결과 목록에 남긴다'],
      policy: ['전체 · KST · PST · 동시 모집을 제공한다', '일정과 킥오프 문구의 시간대 표기를 기준으로 판정한다'],
      data: ['timezone', 'study.schedule · study.recruitment.kickoff'],
    },
    {
      n: '4',
      title: '카테고리 필터',
      display: ['카테고리 선택 버튼 목록', '선택된 버튼은 채워진 원형 표시와 브랜드 색으로 구분'],
      behavior: ['카테고리를 누르면 해당 카테고리의 스터디만 즉시 남긴다'],
      policy: ['기본값은 카테고리 전체', '한 번에 하나만 선택한다', '화면에 제공된 canonical 카테고리 옵션을 사용한다', 'PM과 커리어는 카테고리·제목·소개 문구의 매칭 규칙을 사용한다'],
      data: ['category', 'study.category'],
    },
    {
      n: '5',
      title: '스터디 결과 목록',
      display: ['조건에 맞는 스터디 카드 그리드'],
      policy: ['검색어·모집 상태·시간대·카테고리 조건을 모두 만족하는 카드만 표시한다'],
      data: ['filtered studies'],
    },
    {
      n: '5-1',
      title: '스터디 카드',
      display: ['카테고리 아이콘·제목·소개·일정·모집 정보'],
      behavior: ['카드를 누르면 해당 스터디 상세 화면으로 이동한다', '모집 링크가 있으면 신청 링크로 이동한다'],
      data: ['study'],
      when: '필터 결과가 1개 이상일 때',
    },
    {
      n: '6',
      title: '검색 결과 없음',
      display: ['조건에 맞는 결과가 없다는 안내 문구'],
      policy: ['오류가 아니라 정상적인 빈 상태로 표시한다'],
      when: '필터 결과가 없을 때',
    },
  ],
};
