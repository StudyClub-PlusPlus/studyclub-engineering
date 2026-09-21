package com.studyclub.domain.participant;

import java.util.Map;

/** 스터디 하나의 참여자 수를 상태별로 센 값. 목록 정렬(사람 많은 순·완주율 순)과 정원 판정이 같은 집계를 쓰도록 한곳에서 해석한다. */
public record StudyParticipantCounts(long active, long paused, long completed, long withdrawn) {

    public static final StudyParticipantCounts EMPTY = new StudyParticipantCounts(0, 0, 0, 0);

    public static StudyParticipantCounts of(Map<ParticipantStatus, Long> byStatus) {
        return new StudyParticipantCounts(
                byStatus.getOrDefault(ParticipantStatus.ACTIVE, 0L),
                byStatus.getOrDefault(ParticipantStatus.PAUSED, 0L),
                byStatus.getOrDefault(ParticipantStatus.COMPLETED, 0L),
                byStatus.getOrDefault(ParticipantStatus.WITHDRAWN, 0L));
    }

    /** 정원을 차지하는 인원 (ACTIVE + PAUSED). 모집 마감 판정의 기준. */
    public long occupying() {
        return active + paused;
    }

    /** 참여 인원 — 하차자를 뺀 전부. 종료 후 ACTIVE 가 COMPLETED 로 바뀌어도 줄지 않는다. */
    public long participated() {
        return active + paused + completed;
    }

    /** 완주율 0~100 (반올림). 참여 이력이 없으면 {@code null}. 하차자도 분모에 넣는다. */
    public Integer completionRate() {
        long total = participated() + withdrawn;
        return total == 0 ? null : Math.round(completed * 100f / total);
    }
}
