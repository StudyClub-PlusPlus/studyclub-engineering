package com.studyclub.api.meeting;

import java.time.Instant;
import java.util.List;

public record StudyMeetingListResponse(StudyGroupView studyGroup, List<MeetingView> meetings) {

    /** {@code startTime} 은 분반 시간대의 현지 {@code HH:mm} — 추가 창 시작 시각 기본값. */
    public record StudyGroupView(Long id, String name, String timezone, String startTime) {}

    /** {@code number} 는 저장하지 않고 예정 시각 순서로 센다. */
    public record MeetingView(
            Long id, int number, Instant scheduledAt, String title, boolean started) {}
}
