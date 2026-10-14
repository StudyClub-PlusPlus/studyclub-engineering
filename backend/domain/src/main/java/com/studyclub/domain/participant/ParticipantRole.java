package com.studyclub.domain.participant;

import java.util.List;

public enum ParticipantRole {
    MEMBER,
    /** 네비게이터 (현장 이름 「반장」). 스터디 안의 운영 역할은 이것 하나다 — 부반장은 두지 않는다 (POL-0001). */
    LEADER;

    /** 정원을 차지하는 역할 (POL-0004). 신청 검사와 목록의 모집 상태 판정이 같은 목록을 본다. */
    public static final List<ParticipantRole> CAPACITY_ROLES = List.of(MEMBER, LEADER);
}
