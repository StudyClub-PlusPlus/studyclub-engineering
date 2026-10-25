package com.studyclub.api.discord;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.time.Instant;

/**
 * 디스코드에서 한 사람의 captain · navigator role 이 바뀌었다 (specs/discord-role-sync/spec.md). 봇이 자기 API 로 바꾼 것은
 * 오지 않는다.
 */
public record DiscordRoleChangeRequest(
        @NotBlank @Pattern(regexp = DiscordAttendanceRequest.SNOWFLAKE) String discordUserId,
        @NotNull Role role,
        @NotNull Change change,
        @NotNull Instant occurredAt) {

    public enum Role {
        CAPTAIN,
        NAVIGATOR
    }

    public enum Change {
        ADDED,
        REMOVED
    }
}
