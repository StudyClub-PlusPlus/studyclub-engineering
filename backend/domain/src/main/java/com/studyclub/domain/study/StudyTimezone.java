package com.studyclub.domain.study;

/** 스터디 진행 시간대. 일정 문구에서 판정한다 — {@link Study#timezone} 참고. */
public enum StudyTimezone {
    KST,
    PST,
    /** 시간대 표기가 없다 — 두 지역을 같이 모집한다. */
    BOTH
}
