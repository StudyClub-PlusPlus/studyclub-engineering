package com.studyclub.api.meeting;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;

/** 회차 추가·수정·규칙 요청. 개수·날짜·제목 길이 규칙은 도메인({@code MeetingSchedule} · {@code StudyMeeting})이 본다. */
public final class StudyMeetingRequests {

    private StudyMeetingRequests() {}

    /** 반복은 화면이 날짜로 펼쳐 보낸다 — 미리보기와 저장 결과가 같은 목록이 된다 (specs/study-meeting/spec.md 결정 8). */
    public record Create(
            @NotNull Long studyGroupId,
            @NotEmpty List<@NotNull Instant> scheduledAts,
            String title) {}

    /**
     * 시각·제목은 늘 함께 보낸다. {@code title} 이 null·공백이면 제목을 지운다.
     *
     * <p>발표자 두 칸은 <b>필드가 없으면 그대로, {@code null} 이면 비운다</b> — 화면을 연 사이 크루가 신청한 칸을 옛 값으로 덮지 않기 위해서다.
     * 레코드로는 「없음」 과 「null」 을 가를 수 없어 세터가 불렸는지로 가른다 (JSON 에 키가 있으면 값이 null 이어도 세터가 불린다).
     */
    public static final class Update {

        @NotNull private Instant scheduledAt;
        private String title;
        private Long presenter1ParticipantId;
        private Long presenter2ParticipantId;
        private boolean presenter1Sent;
        private boolean presenter2Sent;

        public Update() {}

        public Instant getScheduledAt() {
            return scheduledAt;
        }

        public void setScheduledAt(Instant scheduledAt) {
            this.scheduledAt = scheduledAt;
        }

        public String getTitle() {
            return title;
        }

        public void setTitle(String title) {
            this.title = title;
        }

        public Long getPresenter1ParticipantId() {
            return presenter1ParticipantId;
        }

        public void setPresenter1ParticipantId(Long presenter1ParticipantId) {
            this.presenter1ParticipantId = presenter1ParticipantId;
            this.presenter1Sent = true;
        }

        public Long getPresenter2ParticipantId() {
            return presenter2ParticipantId;
        }

        public void setPresenter2ParticipantId(Long presenter2ParticipantId) {
            this.presenter2ParticipantId = presenter2ParticipantId;
            this.presenter2Sent = true;
        }

        /** 발표자1 칸을 바꾸라는 요청인지 — JSON 에 키가 있었다. */
        boolean presenter1Sent() {
            return presenter1Sent;
        }

        boolean presenter2Sent() {
            return presenter2Sent;
        }
    }

    /** 스터디 규칙. null·공백이면 지운다. */
    public record Rules(String rules) {}
}
