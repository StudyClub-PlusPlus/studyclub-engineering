package com.studyclub.domain.study;

/**
 * 스터디 목록의 모집 상태 탭 — 저장하지 않고 매 조회마다 계산한다. {@link StudyStatus}(사람이 정하는 라이프사이클)와 {@link
 * RecruitStatus}(모집 마감 여부)를 날짜와 합쳐 사용자가 보는 단계 하나로 접는다.
 *
 * <p>판정 순서는 {@link Study#phase} 가 정본이다. 선언 순서가 기본 정렬 순서다.
 */
public enum StudyPhase {
    /** 시작 전이고 모집 마감 전·정원 미달. */
    RECRUITING,
    /** 시작했고 아직 끝나지 않았다. */
    ONGOING,
    /** 운영자가 종료했거나, 종료 시각이 지났거나, 시작 전인데 모집이 마감됐다. */
    CLOSED
}
