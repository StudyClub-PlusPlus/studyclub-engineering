package com.studyclub.api.notice;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/** 공지 보내기 요청. 제목·본문 길이와 채널·받는 사람 규칙은 도메인({@code StudyNotice})이 본다. */
public final class StudyNoticeRequests {

    private StudyNoticeRequests() {}

    /**
     * @param participantIds 받는 사람 — 이 반의 명부 행(STUDY_PARTICIPANT.ID). 모두 {@code ACTIVE}·{@code
     *     PAUSED} 여야 하고, 하나라도 아니면 일부만 보내지 않고 전체를 거절한다
     */
    public record Send(
            @NotNull String title,
            @NotNull String body,
            @NotEmpty List<@NotNull NoticeChannel> channels,
            @NotEmpty List<@NotNull Long> participantIds) {}
}
