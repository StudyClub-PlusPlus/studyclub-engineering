package com.studyclub.domain.participant;

import java.util.List;

public enum ParticipantRole {
    MEMBER,
    LEADER,
    CO_LEADER;

    /** 정원을 차지하는 역할 (POL-0004). 신청 검사와 목록의 모집 상태 판정이 같은 목록을 본다. */
    public static final List<ParticipantRole> CAPACITY_ROLES = List.of(MEMBER, LEADER, CO_LEADER);
}
