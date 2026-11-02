package com.studyclub.domain.participant;

import java.time.Instant;

/** 명부에 속했던 기간. 종료 시각이 없으면 참여 중이거나 기록 미확인이라 휴면으로 단정하지 않는다. */
public record ParticipationPeriod(Instant joinedAt, Instant endedAt) {

    public boolean endedBefore(Instant cutoff) {
        return joinedAt != null
                && endedAt != null
                && !endedAt.isBefore(joinedAt)
                && endedAt.isBefore(cutoff);
    }
}
