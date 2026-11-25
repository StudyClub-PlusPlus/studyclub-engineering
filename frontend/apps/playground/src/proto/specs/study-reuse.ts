import type { ScreenSpec } from '@/proto/annotate';

export const REUSE_SPEC: ScreenSpec = {
  prd: 'captain-reuse-ended-study',
  chip: '스터디 복제',
  scope: 'reuse',
  screen: '스터디 상세 및 등록 창',
  entries: [
    { n: '1', title: '스터디 복제', when: '캡틴 · 일반 스터디 · ENDED 또는 CLOSED', behavior: ['원본이 선택된 새 프로그램 등록 창을 연다. 클럽은 다음 기수 만들기를 사용한다.'] },
    { n: '2', title: '지난 스터디 불러오기', when: '스터디 등록 › 새 프로그램 › 스터디', behavior: ['종료된 원본을 제목과 ID로 선택한다. 제목·한 줄 소개·상세 설명·카테고리·썸네일과 신청 질문을 가져온다. 썸네일은 원본을 기본으로 채우고 복제본에서 교체·제거할 수 있다.'] },
    { n: '3', title: '미공개로 등록', behavior: ['마감일을 비우면 공개 후 상시 모집한다. 성공하면 창을 닫고 「등록되었습니다」 토스트를 표시한 뒤 새 ID의 상세로 이동한다. 취소하면 생성하지 않는다.'] },
  ],
};
