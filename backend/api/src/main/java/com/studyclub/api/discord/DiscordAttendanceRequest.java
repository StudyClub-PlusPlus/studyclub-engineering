package com.studyclub.api.discord;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 보이스 채널 참가자 스냅샷. 회차(studyMeetingId)는 받지 않는다 — 판정 근거인 START_AT/END_AT 이 전부 백엔드에 있으므로 백엔드가 고른다
 * (specs/discord-attendance/spec.md).
 */
public record DiscordAttendanceRequest(
        @NotBlank @Pattern(regexp = SNOWFLAKE) String callerDiscordUserId,
        @NotEmpty @Size(max = 100) List<@NotBlank @Pattern(regexp = SNOWFLAKE) String> discordUserIds) {

    static final String SNOWFLAKE = "^[0-9]{17,20}$";
}
