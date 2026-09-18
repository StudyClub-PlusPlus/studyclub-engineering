package com.studyclub.domain.study;

/**
 * 코호트 모집 상태 — 저장하지 않고 매 조회마다 계산한다. {@link StudyCohortStatus} 는 사람이 정하는 라이프사이클이고, 이쪽은 날짜·정원이 정하는 파생
 * 상태다. 둘을 한 컬럼에 겹치지 않는다.
 *
 * <p>ERD {@code docs/erd/STUDY_COHORT.md} § "모집 상태" 의 5개 값 중 {@code UPCOMING}(모집 시작 컬럼 미확정) ·
 * {@code ONGOING} · {@code ENDED}(진행 상태라 모집과 축이 다름) 는 아직 구현하지 않았다.
 */
public enum RecruitStatus {
    /** 모집 마감 전이고 정원도 남았다. */
    RECRUITING,
    /** 마감 시각이 지났거나 정원이 찼다. */
    RECRUIT_CLOSED
}
