package com.studyclub.api.study;

/** 스터디 목록 정렬. 동률이면 최근 등록(id 큰) 순. */
public enum StudyListSort {
    /** 모집 중 → 진행 중 → 종료. */
    DEFAULT,
    /** 모집 마감이 가까운 순. 상시 모집(마감 없음)은 맨 뒤. */
    DEADLINE,
    /** 참여 인원이 많은 순 (하차 제외). */
    PARTICIPANTS,
    /** 최근에 끝난 순 ({@code END_AT} 내림차순). 종료일 없으면 맨 뒤. */
    ENDED,
    /** 완주율이 높은 순. 참여 이력 없으면 맨 뒤. */
    COMPLETION
}
