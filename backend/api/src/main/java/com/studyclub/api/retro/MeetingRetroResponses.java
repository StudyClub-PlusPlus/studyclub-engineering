package com.studyclub.api.retro;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class MeetingRetroResponses {

    private MeetingRetroResponses() {}

    /**
     * GET /api/me/studies/{studyId}/meetings/{meetingId}/retros
     *
     * <p>{@code liked}: retroId → { 섹션명: 눌렀는지 }. 한 섹션이라도 누른 회고만 항목이 있다. 아무것도 안 눌렀으면 {@code {}}.
     */
    public record ViewerContext(
            Long participantId, Long retroId, Map<Long, Map<String, Boolean>> liked) {}

    /**
     * GET /api/studies/{studyId}/meetings/{meetingId}/retros
     *
     * <p>{@code targets}: 쓸 사람 수. 네비게이터·캡틴에게만 채운다 — 크루에게는 {@code null}.
     */
    public record RetroList(
            Long meetingId,
            Instant deadline,
            boolean open,
            Integer targets,
            List<RetroItem> retros,
            List<MissingItem> missing) {}

    public record RetroItem(
            Long retroId,
            Author author,
            String good,
            String improve,
            String feeling,
            Instant writtenAt,
            Map<String, Integer> likes) {}

    public record Author(Long participantId, String displayName, String role) {}

    /** 아직 회고를 쓰지 않은 쓸 사람 — 네비게이터·캡틴에게만 내려준다. */
    public record MissingItem(Long participantId, String displayName) {}

    /** PUT/DELETE .../likes/{section} */
    public record LikeResult(int count, boolean liked) {}

    /** GET /api/me/studies/{studyId}/retros/status */
    public record RetroStatus(List<MeetingRetroStatus> meetings) {}

    /** {@code meetingEndAt}: 미팅 종료 — 실제 종료 시각, 없으면 예정 시각 + 기본 진행 시간. 킥오프는 null. */
    public record MeetingRetroStatus(
            Long meetingId,
            Instant meetingEndAt,
            Instant retroDeadline,
            Boolean retroOpen,
            Boolean retroMine) {}
}
