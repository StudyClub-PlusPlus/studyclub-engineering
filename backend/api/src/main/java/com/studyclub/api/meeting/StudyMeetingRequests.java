package com.studyclub.api.meeting;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;

/** 회차 추가·수정 요청. 개수·날짜·제목 길이 규칙은 도메인({@code MeetingSchedule} · {@code StudyMeeting})이 본다. */
public final class StudyMeetingRequests {

    private StudyMeetingRequests() {}

    /** 반복은 화면이 날짜로 펼쳐 보낸다 — 미리보기와 저장 결과가 같은 목록이 된다 (specs/study-meeting/spec.md 결정 8). */
    public record Create(
            @NotNull Long studyGroupId,
            @NotEmpty List<@NotNull Instant> scheduledAts,
            String title) {}

    /** 시각·제목을 함께 보낸다. {@code title} 이 null·공백이면 제목을 지운다. */
    public record Update(@NotNull Instant scheduledAt, String title) {}
}
