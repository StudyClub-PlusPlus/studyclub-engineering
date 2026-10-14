package com.studyclub.domain.study;

/**
 * 회차 종류 (specs/study-meeting/spec.md 결정 11).
 *
 * <p>킥오프는 분반마다 하나, 번호 0 이다. 규칙·일정·발표자를 정하는 첫 모임이라 발표자가 없고, 출석은 찍지만 출석률에 넣지 않는다. 지울 수 없다.
 */
public enum MeetingType {
    KICKOFF,
    REGULAR
}
