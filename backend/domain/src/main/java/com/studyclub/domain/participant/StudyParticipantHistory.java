package com.studyclub.domain.participant;

public record StudyParticipantHistory(
        Long accountId, long previousParticipationCount, long completedParticipationCount) {

    public Integer completionRate() {
        if (previousParticipationCount == 0) {
            return null;
        }
        return Math.toIntExact(Math.round(completedParticipationCount * 100.0 / previousParticipationCount));
    }
}
